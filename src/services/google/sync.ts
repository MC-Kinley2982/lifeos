import { CATEGORY_IDS } from '../../domain/defaults';
import { addDays, MINUTES_PER_DAY, minutesSinceMidnight, toDateKey, toHHMM, toMinutes } from '../../domain/time';
import type { CalendarEvent, DateKey, GoogleCalendarSettings, GoogleReminder, ID, Todo } from '../../domain/types';
import { buildDaySchedule } from '../planner/schedule';
import type { PlannerData } from '../planner/types';
import { subjectById, subjectLabel } from '../school/timetable';
import { GOOGLE_SYNC_DAYS } from './config';
import { GoogleApiError, type GDateTime, type GEvent, type GoogleCalendarApi, type GReminders } from './api';

/**
 * Abgleich LifeOS ↔ Google Kalender.
 *
 * Schreiben (nur was der Nutzer ausdrücklich einschaltet):
 * - Jeder LifeOS-Eintrag bekommt eine stabile Google-Event-ID, abgeleitet aus seinem LifeOS-Schlüssel.
 *   Wiederholtes Synchronisieren – auch von mehreren Geräten – erzeugt so nie Duplikate,
 *   sondern aktualisiert denselben Termin.
 * - Von LifeOS angelegte Termine tragen eine private Markierung (lifeos=1). Gelöscht wird
 *   ausschließlich, was diese Markierung hat – persönliche Google-Termine werden nie angefasst.
 *
 * Lesen: Google-Termine (ohne die eigenen) werden als Termine mit source "google" übernommen
 * und blockieren im Tagesplan Zeit wie feste Termine.
 */

export type GoogleSyncData = PlannerData & { todos: Todo[] };

/** Zeitraum from ≤ Datum < to. */
export interface SyncRange {
  from: DateKey;
  to: DateKey;
}

export const LIFEOS_MARK = 'lifeos';
/** Dauer eines To-do-Termins mit Uhrzeit (ohne eingeplante Zeit). */
const TODO_EVENT_MIN = 15;
const NOTE = 'Eingetragen von LifeOS';

// ─── IDs & Fingerabdrücke ────────────────────────────────────

function cyrb53(str: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const hex = (n: number) => n.toString(16).padStart(14, '0');

/**
 * Stabile Google-Event-ID für einen LifeOS-Schlüssel (z. B. "event:abc").
 * Google erlaubt nur Kleinbuchstaben a–v und Ziffern – "lifeos" + Hex erfüllt das.
 */
export function eventIdFor(key: string): string {
  return `lifeos${hex(cyrb53(key, 1))}${hex(cyrb53(key, 2))}`;
}

function fingerprint(value: unknown): string {
  return hex(cyrb53(JSON.stringify(value), 3));
}

// ─── Zeitangaben ─────────────────────────────────────────────

function timed(date: DateKey, startMin: number, endMin: number, timeZone: string): { start: GDateTime; end: GDateTime } {
  const at = (m: number): GDateTime => {
    const day = addDays(date, Math.floor(m / MINUTES_PER_DAY));
    return { dateTime: `${day}T${toHHMM(((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY)}:00`, timeZone };
  };
  return { start: at(startMin), end: at(Math.max(endMin, startMin + 5)) };
}

function allDay(date: DateKey): { start: GDateTime; end: GDateTime } {
  return { start: { date }, end: { date: addDays(date, 1) } };
}

/** Lokale Mitternacht als RFC-3339-Zeitpunkt (für timeMin/timeMax). */
function dayStartIso(date: DateKey): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

export function remindersFor(r: GoogleReminder): GReminders {
  if (r.type === 'calendarDefault') return { useDefault: true };
  if (r.type === 'none') return { useDefault: false, overrides: [] };
  return { useDefault: false, overrides: [{ method: 'popup', minutes: Math.max(0, Math.round(r.minutes)) }] };
}

// ─── Was soll in Google stehen? ──────────────────────────────

export interface DesiredEvent {
  key: string;
  event: GEvent;
  todoId?: ID;
}

function desired(key: string, body: Omit<GEvent, 'id'>, todoId?: ID): DesiredEvent {
  const hash = fingerprint(body);
  return {
    key,
    todoId,
    event: { id: eventIdFor(key), ...body, extendedProperties: { private: { [LIFEOS_MARK]: '1', lifeosKey: key, lifeosHash: hash } } },
  };
}

/** Alle LifeOS-Einträge im Zeitraum, die laut Einstellungen in Google stehen sollen. */
export function buildDesiredEvents(data: GoogleSyncData, settings: GoogleCalendarSettings, range: SyncRange, timeZone: string): DesiredEvent[] {
  const inRange = (d: DateKey) => d >= range.from && d < range.to;
  const { push } = settings;
  const reminders = remindersFor(settings.reminder);
  const out: DesiredEvent[] = [];

  if (push.events) {
    for (const e of data.events) {
      if (e.source !== 'local' || !inRange(e.date)) continue; // Google-Termine nie zurückschreiben
      if (!e.allDay && toMinutes(e.end) <= toMinutes(e.start)) continue;
      out.push(
        desired(`event:${e.id}`, {
          summary: e.title || 'Termin',
          description: e.description ? `${e.description}\n\n${NOTE}` : NOTE,
          ...(e.location ? { location: e.location } : {}),
          ...(e.allDay ? allDay(e.date) : timed(e.date, toMinutes(e.start), toMinutes(e.end), timeZone)),
          reminders,
        }),
      );
    }
  }

  if (push.homework) {
    for (const hw of data.homework) {
      if (hw.status === 'done') continue;
      const label = subjectLabel(subjectById(data, hw.subjectId));
      for (const b of hw.plannedBlocks) {
        if (b.done || !inRange(b.date)) continue;
        const start = toMinutes(b.start);
        out.push(
          desired(`homework:${hw.id}:${b.id}`, {
            summary: `${label.name}: ${hw.title || 'Hausaufgabe'}`,
            description: `Hausaufgabe · ${NOTE}`,
            ...timed(b.date, start, start + b.durationMin, timeZone),
            reminders,
          }),
        );
      }
    }
  }

  if (push.study) {
    for (const exam of data.exams) {
      const label = subjectLabel(subjectById(data, exam.subjectId));
      for (const s of exam.studySessions) {
        if (s.done || !inRange(s.date)) continue;
        const start = toMinutes(s.start);
        out.push(
          desired(`study:${exam.id}:${s.id}`, {
            summary: `Lernen: ${label.name} · ${exam.title}`,
            description: `Lernzeit · ${NOTE}`,
            ...timed(s.date, start, start + s.durationMin, timeZone),
            reminders,
          }),
        );
      }
    }
  }

  // To-dos nur, wenn sie einzeln dafür markiert sind – nie automatisch.
  if (push.todos) {
    for (const todo of data.todos) {
      if (!todo.googleCalendarSync || todo.completed || todo.horizon !== 'day' || !todo.date) continue;
      const task = todo.taskId ? data.tasks.find((t) => t.id === todo.taskId) : undefined;
      let date = todo.date;
      let when: { start: GDateTime; end: GDateTime };
      if (task?.schedule?.start && task.status !== 'done') {
        date = task.schedule.date;
        const start = toMinutes(task.schedule.start);
        when = timed(date, start, start + task.estimatedMin, timeZone);
      } else if (todo.time) {
        const start = toMinutes(todo.time);
        when = timed(date, start, start + TODO_EVENT_MIN, timeZone);
      } else {
        when = allDay(date);
      }
      if (!inRange(date)) continue;
      // Standard: keine Erinnerung. Nur wenn der Nutzer eine gesetzt hat (und es eine Uhrzeit gibt).
      const todoReminders: GReminders =
        todo.reminder && when.start.dateTime ? { useDefault: false, overrides: [{ method: 'popup', minutes: todo.reminder.minutesBefore }] } : { useDefault: false, overrides: [] };
      out.push(
        desired(
          `todo:${todo.id}`,
          { summary: todo.title, description: todo.note ? `${todo.note}\n\n${NOTE}` : `To-do · ${NOTE}`, ...when, reminders: todoReminders },
          todo.id,
        ),
      );
    }
  }

  if (push.routines) {
    for (let d = range.from; d < range.to; d = addDays(d, 1)) {
      for (const b of buildDaySchedule(data, d).blocks) {
        if (b.kind !== 'routine' && b.kind !== 'school') continue;
        out.push(desired(`routine:${b.sourceKey}:${d}`, { summary: b.title, description: `Routine · ${NOTE}`, ...timed(d, b.start, b.end, timeZone), reminders }));
      }
    }
  }

  return out;
}

// ─── Schreiben ───────────────────────────────────────────────

export interface PushSummary {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
}

function eventStartDate(e: GEvent): DateKey {
  if (e.start?.date) return e.start.date;
  return e.start?.dateTime ? toDateKey(new Date(e.start.dateTime)) : '';
}

/**
 * Google an den gewünschten Stand angleichen: anlegen, ändern, entfernen.
 * Entfernt wird nur, was LifeOS selbst angelegt hat (Markierung) und nicht in der Vergangenheit liegt.
 */
export async function pushEvents(api: GoogleCalendarApi, calendarId: string, wanted: DesiredEvent[], range: SyncRange): Promise<PushSummary> {
  const remote = await api.listEvents(calendarId, {
    timeMin: dayStartIso(range.from),
    timeMax: dayStartIso(range.to),
    privateExtendedProperty: `${LIFEOS_MARK}=1`,
  });
  const byId = new Map(remote.map((e) => [e.id, e]));
  const summary: PushSummary = { created: 0, updated: 0, deleted: 0, unchanged: 0 };

  for (const w of wanted) {
    const existing = byId.get(w.event.id);
    if (!existing) {
      try {
        await api.insertEvent(calendarId, w.event);
        summary.created++;
      } catch (e) {
        // Gibt es die ID schon (z. B. außerhalb des Zeitraums oder früher gelöscht) → aktualisieren statt doppelt anlegen.
        if (!(e instanceof GoogleApiError && e.status === 409)) throw e;
        await api.updateEvent(calendarId, w.event.id, { ...w.event, status: 'confirmed' });
        summary.updated++;
      }
    } else if (existing.status === 'cancelled' || existing.extendedProperties?.private?.lifeosHash !== w.event.extendedProperties?.private?.lifeosHash) {
      await api.updateEvent(calendarId, w.event.id, w.event);
      summary.updated++;
    } else {
      summary.unchanged++;
    }
  }

  const wantedIds = new Set(wanted.map((w) => w.event.id));
  for (const e of remote) {
    if (wantedIds.has(e.id)) continue;
    if (e.extendedProperties?.private?.[LIFEOS_MARK] !== '1') continue; // fremde Termine: niemals löschen
    if (eventStartDate(e) < range.from) continue; // Vergangenes bleibt als Verlauf stehen
    await api.deleteEvent(calendarId, e.id);
    summary.deleted++;
  }
  return summary;
}

// ─── Lesen ───────────────────────────────────────────────────

/** Google-Termine → LifeOS-Termine (source "google"), über Mitternacht reichende auf die Tage verteilt. */
export function mapGoogleEvents(calendarId: string, events: GEvent[], range: SyncRange, categoryId: ID): CalendarEvent[] {
  const inRange = (d: DateKey) => d >= range.from && d < range.to;
  const out: CalendarEvent[] = [];
  for (const ev of events) {
    if (ev.status === 'cancelled' || ev.extendedProperties?.private?.[LIFEOS_MARK] === '1') continue;
    const title = ev.summary?.trim() || '(Ohne Titel)';
    const ts = ev.updated ?? `${range.from}T00:00:00.000Z`;
    const base = {
      title,
      ...(ev.location ? { location: ev.location } : {}),
      categoryId,
      blocksFreeTime: ev.transparency !== 'transparent',
      travelBeforeMin: 0,
      travelAfterMin: 0,
      source: 'google' as const,
      externalId: ev.id,
      calendarId,
      createdAt: ts,
      updatedAt: ts,
    };
    const idFor = (date: DateKey) => `gcal-${hex(cyrb53(`${calendarId}|${ev.id}|${date}`, 4))}`;

    if (ev.start?.date) {
      const endExclusive = ev.end?.date && ev.end.date > ev.start.date ? ev.end.date : addDays(ev.start.date, 1);
      for (let d = ev.start.date; d < endExclusive; d = addDays(d, 1)) {
        if (inRange(d)) out.push({ ...base, id: idFor(d), date: d, start: '00:00', end: '24:00', allDay: true });
      }
      continue;
    }
    if (!ev.start?.dateTime || !ev.end?.dateTime) continue;
    const start = new Date(ev.start.dateTime);
    const end = new Date(ev.end.dateTime);
    if (!(end > start)) continue;
    const firstDay = toDateKey(start);
    const lastDay = toDateKey(new Date(end.getTime() - 1));
    for (let d = firstDay; d <= lastDay; d = addDays(d, 1)) {
      const from = d === firstDay ? minutesSinceMidnight(start) : 0;
      const to = d === toDateKey(end) ? minutesSinceMidnight(end) : MINUTES_PER_DAY;
      if (to > from && inRange(d)) out.push({ ...base, id: idFor(d), date: d, start: toHHMM(from), end: toHHMM(to), allDay: false });
    }
  }
  return out;
}

// ─── Gesamter Abgleich ───────────────────────────────────────

export interface GoogleSyncResult {
  range: SyncRange;
  push: PushSummary;
  /** Gelesene Google-Termine (leer, wenn das Lesen ausgeschaltet ist). */
  imported: CalendarEvent[];
  /** Google-Event-ID je To-do (undefined = kein Termin mehr). */
  todoEventIds: Record<ID, string | undefined>;
}

export function syncRange(now: Date): SyncRange {
  const today = toDateKey(now);
  return { from: today, to: addDays(today, GOOGLE_SYNC_DAYS) };
}

/** Fingerabdruck des gewünschten Stands – ändert er sich nicht, ist kein erneuter Abgleich nötig. */
export function syncFingerprint(data: GoogleSyncData, now: Date, timeZone: string): string {
  const settings = data.settings.integrations.googleCalendar;
  const wanted = buildDesiredEvents(data, settings, syncRange(now), timeZone);
  return fingerprint({ c: settings.calendarId, i: settings.importEvents, w: wanted.map((w) => w.event.extendedProperties?.private?.lifeosHash + w.event.id) });
}

export async function syncGoogleCalendar(api: GoogleCalendarApi, data: GoogleSyncData, now: Date, timeZone: string): Promise<GoogleSyncResult> {
  const settings = data.settings.integrations.googleCalendar;
  if (!settings.calendarId) throw new Error('Kein Google-Kalender ausgewählt.');
  const range = syncRange(now);
  const wanted = buildDesiredEvents(data, settings, range, timeZone);
  const push = await pushEvents(api, settings.calendarId, wanted, range);

  let imported: CalendarEvent[] = [];
  if (settings.importEvents) {
    const remote = await api.listEvents(settings.calendarId, { timeMin: dayStartIso(range.from), timeMax: dayStartIso(range.to) });
    const categoryId = data.settings.categories.some((c) => c.id === CATEGORY_IDS.other) ? CATEGORY_IDS.other : (data.settings.categories[0]?.id ?? CATEGORY_IDS.other);
    imported = mapGoogleEvents(settings.calendarId, remote, range, categoryId);
  }

  const todoEventIds: Record<ID, string | undefined> = {};
  const byTodo = new Map(wanted.filter((w) => w.todoId).map((w) => [w.todoId!, w.event.id]));
  for (const todo of data.todos) {
    if (byTodo.has(todo.id) || todo.googleCalendarEventId) todoEventIds[todo.id] = byTodo.get(todo.id);
  }
  return { range, push, imported, todoEventIds };
}
