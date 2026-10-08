import { useEffect } from 'react';
import { create } from 'zustand';
import { addDays } from '../domain/time';
import { createGoogleCalendarApi, GoogleApiError, type GCalendar } from '../services/google/api';
import { clearGoogleToken, currentGoogleToken, loadGoogleIdentity, requestGoogleToken, revokeGoogleToken } from '../services/google/auth';
import { googleConfigured } from '../services/google/config';
import { pushEvents, syncFingerprint, syncGoogleCalendar, syncRange, type PushSummary } from '../services/google/sync';
import { pickData } from './persistence';
import { useAppStore } from './useAppStore';

/**
 * Google Kalender in der App: Verbindungsstatus (pro Gerät), Verbinden/Trennen, Kalenderwahl
 * und Abgleich. Die Auswahl (Konto, Kalender, was übertragen wird) liegt in den Einstellungen
 * und wird mit synchronisiert; das Zugriffstoken bleibt immer nur auf dem jeweiligen Gerät.
 */
export type GoogleStatus =
  | 'unconfigured' // Client-ID fehlt (Einrichtung außerhalb des Codes nötig)
  | 'disconnected' // kein Kalender verbunden
  | 'needsAuth' // verbunden, aber auf diesem Gerät (wieder) anmelden
  | 'ready'
  | 'error';

export interface GoogleUiState {
  status: GoogleStatus;
  busy: boolean;
  error?: string;
  calendars: GCalendar[];
  lastSync?: { at: string; push: PushSummary; imported: number };
}

const linkedCalendar = () => useAppStore.getState().settings.integrations.googleCalendar.calendarId;

function baseStatus(): GoogleStatus {
  if (!googleConfigured) return 'unconfigured';
  if (!linkedCalendar()) return 'disconnected';
  return currentGoogleToken() ? 'ready' : 'needsAuth';
}

export const useGoogle = create<GoogleUiState>(() => ({ status: baseStatus(), busy: false, calendars: [] }));

const api = createGoogleCalendarApi(async () => {
  const token = currentGoogleToken();
  if (!token) throw new GoogleApiError(401, 'Google-Anmeldung abgelaufen.');
  return token;
});

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';

let running: Promise<void> | null = null;
let lastFingerprint: string | null = null;
let lastSyncAt = 0;

function fail(e: unknown): void {
  if (e instanceof GoogleApiError && e.status === 401) {
    clearGoogleToken();
    useGoogle.setState({ status: 'needsAuth', error: undefined });
    return;
  }
  useGoogle.setState({ status: linkedCalendar() ? 'error' : baseStatus(), error: e instanceof Error ? e.message : String(e) });
}

async function withBusy<T>(fn: () => Promise<T>): Promise<T | undefined> {
  useGoogle.setState({ busy: true, error: undefined });
  try {
    return await fn();
  } catch (e) {
    fail(e);
    return undefined;
  } finally {
    useGoogle.setState({ busy: false });
  }
}

async function runSync(): Promise<void> {
  const state = useAppStore.getState();
  const settings = state.settings.integrations.googleCalendar;
  if (!settings.calendarId || !currentGoogleToken()) {
    useGoogle.setState({ status: baseStatus() });
    return;
  }
  const now = new Date();
  const data = pickData(state);
  const result = await syncGoogleCalendar(api, data, now, timeZone());
  const fresh = useAppStore.getState();
  if (settings.importEvents) fresh.replaceGoogleEvents(settings.calendarId, result.imported, result.range);
  else fresh.replaceGoogleEvents(null, []);
  fresh.setTodoCalendarEventIds(result.todoEventIds);
  lastFingerprint = syncFingerprint(pickData(useAppStore.getState()), now, timeZone());
  lastSyncAt = Date.now();
  useGoogle.setState({ status: 'ready', error: undefined, lastSync: { at: new Date().toISOString(), push: result.push, imported: result.imported.length } });
}

/** Abgleich – nie doppelt gleichzeitig. */
function syncOnce(): Promise<void> {
  running ??= runSync().finally(() => (running = null));
  return running;
}

export const googleCalendar = {
  /** Skript vorladen, damit "Verbinden" auf dem iPhone direkt ein Fenster öffnen kann. */
  preload: () => (googleConfigured ? loadGoogleIdentity().catch(() => undefined) : Promise.resolve()),

  /** Erstes Verbinden (aus einem Klick): Zustimmung bei Google, Kalender laden, Hauptkalender wählen. */
  connect: () =>
    withBusy(async () => {
      await requestGoogleToken('consent');
      const calendars = await api.listCalendars();
      const primary = calendars.find((c) => c.primary) ?? calendars[0];
      if (!primary) throw new Error('In diesem Google-Konto wurde kein beschreibbarer Kalender gefunden.');
      useAppStore.getState().updateGoogleCalendar({
        accountEmail: calendars.find((c) => c.primary)?.id,
        calendarId: primary.id,
        calendarName: primary.summary,
      });
      useGoogle.setState({ calendars, status: 'ready' });
      await syncOnce();
    }),

  /** Auf diesem Gerät (wieder) anmelden – ohne erneute Zustimmung. */
  signIn: () =>
    withBusy(async () => {
      await requestGoogleToken('', useAppStore.getState().settings.integrations.googleCalendar.accountEmail);
      useGoogle.setState({ status: 'ready' });
      await syncOnce();
    }),

  /** Kalenderliste (für "Kalender ändern"). */
  loadCalendars: () =>
    withBusy(async () => {
      if (!currentGoogleToken()) await requestGoogleToken('', useAppStore.getState().settings.integrations.googleCalendar.accountEmail);
      useGoogle.setState({ calendars: await api.listCalendars(), status: 'ready' });
    }),

  /** Anderen Kalender wählen: LifeOS-Einträge im alten Kalender werden entfernt (nur die eigenen). */
  chooseCalendar: (calendar: GCalendar) =>
    withBusy(async () => {
      const store = useAppStore.getState();
      const previous = store.settings.integrations.googleCalendar.calendarId;
      if (previous && previous !== calendar.id && currentGoogleToken()) {
        const range = syncRange(new Date());
        await pushEvents(api, previous, [], { from: range.from, to: addDays(range.from, 365) });
      }
      store.replaceGoogleEvents(null, []);
      store.updateGoogleCalendar({ calendarId: calendar.id, calendarName: calendar.summary });
      lastFingerprint = null;
      await syncOnce();
    }),

  /**
   * Trennen: Zugriff bei Google widerrufen und gelesene Google-Termine aus LifeOS entfernen.
   * Was LifeOS in Google eingetragen hat, bleibt dort stehen (es sind jetzt deine Termine) –
   * außer removeEntries: dann werden vorher nur die von LifeOS angelegten Einträge gelöscht.
   */
  disconnect: (removeEntries: boolean) =>
    withBusy(async () => {
      const store = useAppStore.getState();
      const calendarId = store.settings.integrations.googleCalendar.calendarId;
      if (removeEntries && calendarId && currentGoogleToken()) {
        const range = syncRange(new Date());
        await pushEvents(api, calendarId, [], { from: range.from, to: addDays(range.from, 365) });
      }
      await revokeGoogleToken();
      store.replaceGoogleEvents(null, []);
      store.setTodoCalendarEventIds(Object.fromEntries(store.todos.filter((t) => t.googleCalendarEventId).map((t) => [t.id, undefined])));
      store.updateGoogleCalendar({ accountEmail: undefined, calendarId: undefined, calendarName: undefined });
      lastFingerprint = null;
      useGoogle.setState({ status: baseStatus(), calendars: [], lastSync: undefined });
    }),

  /** "Jetzt synchronisieren" (Klick) – meldet bei Bedarf kurz neu an. */
  syncNow: () =>
    withBusy(async () => {
      if (!currentGoogleToken()) {
        await requestGoogleToken('', useAppStore.getState().settings.integrations.googleCalendar.accountEmail);
      }
      lastFingerprint = null;
      await syncOnce();
    }),
};

const AUTO_DEBOUNCE_MS = 5_000;
const RESYNC_MS = 10 * 60_000;

/**
 * Automatischer Abgleich – nur wenn verbunden UND auf diesem Gerät angemeldet (nie ein ungefragtes Popup):
 * beim Start, nach Änderungen (gebündelt), beim Zurückkehren in die App und alle 10 Minuten.
 * Ändert sich am gewünschten Stand nichts, wird Google nicht unnötig abgefragt.
 */
export function useGoogleCalendarSync(ready: boolean): void {
  useEffect(() => {
    if (!ready || !googleConfigured) return;
    useGoogle.setState({ status: baseStatus() });
    if (linkedCalendar()) void googleCalendar.preload();

    let timer: number | undefined;
    const run = (force = false) => {
      if (!linkedCalendar() || !currentGoogleToken() || !navigator.onLine) {
        useGoogle.setState((s) => (s.status === 'error' ? {} : { status: baseStatus() }));
        return;
      }
      const fp = syncFingerprint(pickData(useAppStore.getState()), new Date(), timeZone());
      if (!force && fp === lastFingerprint && Date.now() - lastSyncAt < RESYNC_MS) return;
      void syncOnce().catch(fail);
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => run(), AUTO_DEBOUNCE_MS);
    };

    run(true);
    const unsubscribe = useAppStore.subscribe(schedule);
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', schedule);
    const interval = window.setInterval(() => run(true), RESYNC_MS);
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', schedule);
    };
  }, [ready]);
}
