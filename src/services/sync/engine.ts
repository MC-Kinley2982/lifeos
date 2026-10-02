import { emptyData } from '../../store/persistence';
import type { AppData } from '../../store/types';
import { isNetworkError, type CloudBackend, type CloudSession, type RemoteRecord, type SignUpResult } from '../cloud/types';
import { applyRecords, hashValue, recordKey, splitKey, summarize, toRecords, type DataSummary } from './records';

/**
 * Offline-first-Synchronisierung.
 *
 * - Die lokalen Daten (localStorage) bleiben die Quelle für die App – sie funktioniert immer.
 * - Änderungen werden per Vergleich mit dem zuletzt synchronisierten Stand ("Schatten") erkannt
 *   und mit Zeitstempel in einer Warteschlange ("Outbox") gesammelt – auch offline.
 * - Abgleich: erst Änderungen anderer Geräte holen (Pull), dann eigene hochladen (Push).
 * - Konflikte: pro Eintrag gewinnt die neuere Änderung (Last-Write-Wins), auch auf dem Server.
 */

export type SyncStatus = 'disabled' | 'signedOut' | 'linking' | 'syncing' | 'synced' | 'offline' | 'error';

export interface LinkDecision {
  local: DataSummary;
  remote: DataSummary;
}

export interface SyncState {
  status: SyncStatus;
  session: CloudSession | null;
  /** Noch nicht hochgeladene Änderungen. */
  pending: number;
  lastSyncedAt?: string;
  error?: string;
  /** Erster Login mit vorhandenen Daten auf beiden Seiten – der Nutzer muss entscheiden. */
  linkDecision?: LinkDecision;
  /** Start-Abgleich erledigt (oder nicht nötig) – erst dann plant die App automatisch. */
  ready: boolean;
}

export interface SyncMeta {
  /** Konto, mit dem dieses Gerät verbunden ist. */
  linkedUserId?: string;
  /** Server-Zeitstempel des zuletzt geholten Datensatzes. */
  cursor: string | null;
  /** Fingerabdruck + Zeitstempel des zuletzt synchronisierten Stands je Datensatz. */
  shadow: Record<string, { h: string; t: string }>;
  /** Lokale Änderungen, die noch hochgeladen werden müssen. */
  outbox: Record<string, { t: string; deleted: boolean; h?: string }>;
  lastSyncedAt?: string;
}

/** Zugriff auf die App-Daten (in der App: der Zustand-Store). */
export interface DataPort {
  get(): AppData;
  replace(data: AppData): void;
  subscribe(listener: () => void): () => void;
  /** Sicherheitskopie, bevor lokale Daten durch Cloud-Daten ersetzt werden. */
  backup?(data: AppData): void;
}

export interface MetaStorage {
  load(): SyncMeta | null;
  save(meta: SyncMeta): void;
  clear(): void;
}

export interface EngineOptions {
  now?: () => Date;
  isOnline?: () => boolean;
  /** Automatik (Timer, Online-/Fokus-Ereignisse, Erkennung lokaler Änderungen). In Tests aus. */
  auto?: boolean;
  debounceMs?: number;
  intervalMs?: number;
}

const emptyMeta = (): SyncMeta => ({ cursor: null, shadow: {}, outbox: {} });
const later = (a: string, b: string) => Date.parse(a) > Date.parse(b);

function maxCursor(records: RemoteRecord[], start: string | null): string | null {
  return records.reduce<string | null>((max, r) => (r.serverUpdatedAt && (!max || later(r.serverUpdatedAt, max)) ? r.serverUpdatedAt : max), start);
}

export class SyncEngine {
  private state: SyncState;
  private listeners = new Set<(s: SyncState) => void>();
  private meta: SyncMeta;
  private session: CloudSession | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  private applying = false;
  private captureTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanups: Array<() => void> = [];
  private unsubscribePort: (() => void) | null = null;
  private linkingFor: string | null = null;

  constructor(
    private backend: CloudBackend,
    private port: DataPort,
    private store: MetaStorage,
    private opts: EngineOptions = {},
  ) {
    this.meta = store.load() ?? emptyMeta();
    this.state = { status: 'signedOut', session: null, pending: Object.keys(this.meta.outbox).length, lastSyncedAt: this.meta.lastSyncedAt, ready: false };
    // Auch ohne Anmeldung Änderungen mit Zeitstempel vormerken, solange das Gerät verbunden ist.
    if (this.meta.linkedUserId) this.watchLocalChanges();
  }

  // ─── Zustand ──────────────────────────────────────────────────

  getState(): SyncState {
    return this.state;
  }

  subscribe(listener: (s: SyncState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private iso(): string {
    return (this.opts.now?.() ?? new Date()).toISOString();
  }

  private online(): boolean {
    if (this.opts.isOnline) return this.opts.isOnline();
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  private persist() {
    this.store.save(this.meta);
  }

  // ─── Lebenszyklus & Konto ─────────────────────────────────────

  async init(): Promise<void> {
    this.cleanups.push(this.backend.auth.onChange((s) => void this.handleSession(s)));
    if (this.opts.auto) this.installAuto();
    let session: CloudSession | null = null;
    try {
      session = await this.backend.auth.getSession();
    } catch {
      /* offline – gespeicherte Sitzung fehlt */
    }
    await this.handleSession(session);
  }

  async signUp(email: string, password: string): Promise<SignUpResult> {
    const res = await this.backend.auth.signUp(email, password);
    if (res.session) await this.handleSession(res.session);
    return res;
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.handleSession(await this.backend.auth.signIn(email, password));
  }

  async signOut(): Promise<void> {
    await this.backend.auth.signOut();
    await this.handleSession(null);
  }

  /** Abmelden und dieses Gerät vom Konto trennen (lokale Daten bleiben, werden aber nicht mehr synchronisiert). */
  async forgetDevice(): Promise<void> {
    try {
      await this.backend.auth.signOut();
    } catch {
      /* egal */
    }
    this.unsubscribePort?.();
    this.unsubscribePort = null;
    this.meta = emptyMeta();
    this.store.clear();
    await this.handleSession(null);
    this.setState({ pending: 0, lastSyncedAt: undefined });
  }

  private async handleSession(session: CloudSession | null): Promise<void> {
    if (!session) {
      this.session = null;
      this.linkingFor = null;
      this.setState({ status: 'signedOut', session: null, linkDecision: undefined, error: undefined, ready: true });
      return;
    }
    if (this.session?.userId === session.userId && this.state.status !== 'signedOut') return; // schon aktiv
    this.session = session;
    this.setState({ session, error: undefined });
    if (this.meta.linkedUserId === session.userId) await this.syncNow();
    else await this.link(session);
    this.setState({ ready: true });
  }

  /**
   * Erste Anmeldung auf diesem Gerät:
   * - Cloud leer → lokale Daten hochladen
   * - Gerät noch nicht eingerichtet → Cloud-Daten übernehmen
   * - beides vorhanden → der Nutzer entscheidet (nichts wird ungefragt überschrieben)
   */
  private async link(session: CloudSession): Promise<void> {
    if (this.linkingFor === session.userId) return;
    this.linkingFor = session.userId;
    this.setState({ status: 'linking' });
    try {
      const remote = (await this.backend.records.pull(session.userId, null)).records;
      const local = this.port.get();
      const remoteHas = remote.some((r) => !r.deleted);
      const localHas = local.settings.onboardingDone;
      if (!remoteHas) await this.adoptLocal(localHas, remote);
      else if (!localHas) await this.adoptCloud(remote);
      else this.setState({ linkDecision: { local: summarize(local), remote: summarize(applyRecords(emptyData(), remote)) } });
    } catch (e) {
      this.linkingFor = null;
      this.fail(e);
    }
  }

  /** Antwort auf den Dialog "Lokale Daten gefunden". */
  async resolveLink(choice: 'local' | 'cloud'): Promise<void> {
    if (!this.session) return;
    this.setState({ linkDecision: undefined });
    try {
      const remote = (await this.backend.records.pull(this.session.userId, null)).records;
      if (choice === 'local') await this.adoptLocal(true, remote);
      else await this.adoptCloud(remote);
    } catch (e) {
      this.linkingFor = null;
      this.fail(e);
    }
  }

  /** Lokale Daten werden zum Stand des Kontos (Cloud-Einträge ohne lokales Gegenstück werden gelöscht). */
  private async adoptLocal(pushAll: boolean, remote: RemoteRecord[]): Promise<void> {
    const userId = this.session!.userId;
    const now = this.iso();
    const local = toRecords(this.port.get());
    const meta: SyncMeta = { ...emptyMeta(), linkedUserId: userId, cursor: maxCursor(remote, null) };
    if (pushAll) {
      // Cloud-Stand als bekannt registrieren – sonst würden die Löschungen unten wieder verworfen.
      for (const r of remote) if (!r.deleted) meta.shadow[recordKey(r.collection, r.id)] = { h: hashValue(r.data), t: r.updatedAt };
      for (const [k, rec] of local) meta.outbox[k] = { t: now, deleted: false, h: hashValue(rec.data) };
      for (const r of remote) {
        const k = recordKey(r.collection, r.id);
        if (!r.deleted && !local.has(k)) meta.outbox[k] = { t: now, deleted: true };
      }
    } else {
      // Gerät noch nicht eingerichtet: aktuellen Stand als synchron merken – erst echte Änderungen werden hochgeladen.
      for (const [k, rec] of local) meta.shadow[k] = { h: hashValue(rec.data), t: now };
    }
    this.meta = meta;
    this.persist();
    this.watchLocalChanges();
    await this.syncNow();
  }

  /** Cloud-Daten werden zum Stand dieses Geräts (vorher wird eine lokale Sicherung angelegt). */
  private async adoptCloud(remote: RemoteRecord[]): Promise<void> {
    const userId = this.session!.userId;
    this.port.backup?.(this.port.get());
    const live = remote.filter((r) => !r.deleted);
    const next = applyRecords(emptyData(), live);
    this.applying = true;
    try {
      this.port.replace({ ...next, settings: { ...next.settings, onboardingDone: true } });
    } finally {
      this.applying = false;
    }
    const meta: SyncMeta = { ...emptyMeta(), linkedUserId: userId, cursor: maxCursor(remote, null) };
    const applied = toRecords(this.port.get());
    for (const r of live) {
      const k = recordKey(r.collection, r.id);
      const rec = applied.get(k);
      if (rec) meta.shadow[k] = { h: hashValue(rec.data), t: r.updatedAt };
    }
    const now = this.iso();
    for (const [k, rec] of applied) if (!meta.shadow[k]) meta.shadow[k] = { h: hashValue(rec.data), t: now };
    meta.lastSyncedAt = now;
    this.meta = meta;
    this.persist();
    this.watchLocalChanges();
    this.setState({ status: 'synced', pending: 0, lastSyncedAt: now });
  }

  // ─── Änderungen erkennen ──────────────────────────────────────

  /** Vergleicht die aktuellen Daten mit dem Schatten und merkt Änderungen in der Outbox vor. */
  captureChanges(): void {
    if (!this.meta.linkedUserId) return;
    const now = this.iso();
    const current = toRecords(this.port.get());
    let changed = false;

    for (const [k, rec] of current) {
      const h = hashValue(rec.data);
      const shadow = this.meta.shadow[k];
      const queued = this.meta.outbox[k];
      if (shadow && shadow.h === h) {
        if (queued) {
          delete this.meta.outbox[k]; // auf den synchronen Stand zurückgeändert
          changed = true;
        }
        continue;
      }
      if (queued && !queued.deleted && queued.h === h) continue; // schon vorgemerkt
      this.meta.outbox[k] = { t: now, deleted: false, h };
      changed = true;
    }
    for (const k of new Set([...Object.keys(this.meta.shadow), ...Object.keys(this.meta.outbox)])) {
      if (current.has(k)) continue;
      if (this.meta.shadow[k]) {
        if (!this.meta.outbox[k]?.deleted) {
          this.meta.outbox[k] = { t: now, deleted: true };
          changed = true;
        }
      } else if (this.meta.outbox[k]) {
        delete this.meta.outbox[k]; // nie hochgeladen, schon wieder gelöscht
        changed = true;
      }
    }
    if (changed) {
      this.persist();
      this.setState({ pending: Object.keys(this.meta.outbox).length });
    }
  }

  private watchLocalChanges() {
    if (this.unsubscribePort) return;
    this.unsubscribePort = this.port.subscribe(() => {
      if (this.applying || !this.opts.auto) return;
      if (this.captureTimer) clearTimeout(this.captureTimer);
      this.captureTimer = setTimeout(() => {
        this.captureTimer = null;
        this.captureChanges();
        if (this.session) void this.syncNow();
      }, this.opts.debounceMs ?? 1200);
    });
    this.cleanups.push(() => this.unsubscribePort?.());
  }

  // ─── Abgleich ─────────────────────────────────────────────────

  async syncNow(): Promise<void> {
    if (!this.session || this.meta.linkedUserId !== this.session.userId) return;
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.runSync().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.syncNow();
      }
    });
    return this.running;
  }

  private async runSync(): Promise<void> {
    this.captureChanges();
    if (!this.online()) {
      this.setState({ status: 'offline' });
      return;
    }
    this.setState({ status: 'syncing', error: undefined });
    const userId = this.session!.userId;
    try {
      // 1. Änderungen anderer Geräte holen
      const pulled = await this.backend.records.pull(userId, this.meta.cursor);
      this.applyRemote(pulled.records);
      this.meta.cursor = maxCursor(pulled.records, this.meta.cursor);

      // 2. Eigene Änderungen hochladen
      const entries = Object.entries(this.meta.outbox);
      if (entries.length) {
        const current = toRecords(this.port.get());
        const batch: RemoteRecord[] = entries.map(([k, queued]) => {
          const { collection, id } = splitKey(k);
          const rec = current.get(k);
          const deleted = queued.deleted || !rec;
          return { collection, id, data: deleted ? null : rec!.data, deleted, updatedAt: queued.t };
        });
        await this.backend.records.push(userId, batch);
        for (const r of batch) {
          const k = recordKey(r.collection, r.id);
          const queued = this.meta.outbox[k];
          if (!queued || queued.t !== r.updatedAt) continue; // zwischenzeitlich erneut geändert
          delete this.meta.outbox[k];
          if (r.deleted) delete this.meta.shadow[k];
          else this.meta.shadow[k] = { h: hashValue(r.data), t: r.updatedAt };
        }
      }
      this.meta.lastSyncedAt = this.iso();
      this.persist();
      this.setState({ status: 'synced', lastSyncedAt: this.meta.lastSyncedAt, pending: Object.keys(this.meta.outbox).length, error: undefined });
    } catch (e) {
      this.persist();
      this.fail(e);
    }
  }

  /** Fremde Änderungen übernehmen – außer, die lokale Änderung ist neuer. */
  private applyRemote(records: RemoteRecord[]): void {
    const toApply: RemoteRecord[] = [];
    for (const r of records) {
      const k = recordKey(r.collection, r.id);
      const shadow = this.meta.shadow[k];
      const queued = this.meta.outbox[k];
      if (shadow && !later(r.updatedAt, shadow.t)) continue; // kennen wir schon
      if (queued && !later(r.updatedAt, queued.t)) continue; // lokale Änderung ist neuer → wird hochgeladen
      if (!shadow && !queued && r.deleted) continue; // Löschung von etwas, das wir nie hatten
      toApply.push(r);
      if (queued) delete this.meta.outbox[k];
    }
    if (toApply.length === 0) return;
    this.applying = true;
    try {
      this.port.replace(applyRecords(this.port.get(), toApply));
    } finally {
      this.applying = false;
    }
    const now = toRecords(this.port.get());
    for (const r of toApply) {
      const k = recordKey(r.collection, r.id);
      const rec = now.get(k);
      if (r.deleted || !rec) delete this.meta.shadow[k];
      else this.meta.shadow[k] = { h: hashValue(rec.data), t: r.updatedAt };
    }
  }

  private fail(e: unknown) {
    if (isNetworkError(e) || !this.online()) this.setState({ status: 'offline' });
    else this.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }

  // ─── Automatik (nur im Browser) ───────────────────────────────

  private installAuto() {
    if (typeof window === 'undefined') return;
    const sync = () => void this.syncNow();
    const onOffline = () => this.session && this.setState({ status: 'offline' });
    const onVisible = () => document.visibilityState === 'visible' && sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(sync, this.opts.intervalMs ?? 30_000);
    this.cleanups.push(() => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    });
  }

  dispose(): void {
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
    if (this.captureTimer) clearTimeout(this.captureTimer);
  }
}
