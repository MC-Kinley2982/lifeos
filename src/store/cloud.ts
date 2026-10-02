import { create } from 'zustand';
import { cloudMode, SUPABASE_KEY, SUPABASE_URL, type CloudMode } from '../services/cloud/config';
import { SyncEngine, type DataPort, type MetaStorage, type SyncMeta, type SyncState } from '../services/sync/engine';
import { pickData } from './persistence';
import { useAppStore } from './useAppStore';

/**
 * Verbindet die Sync-Engine mit der App: Store als Datenquelle, localStorage für den
 * Sync-Zustand, ein kleiner Zustand-Store für die Anzeige (Status, Konto, Dialoge).
 */
const META_KEY = 'lifeos-sync-meta';
const BACKUP_KEY = 'lifeos-backup-before-cloud';

export interface CloudUiState extends SyncState {
  mode: CloudMode;
}

export const useCloud = create<CloudUiState>(() => ({
  mode: cloudMode,
  status: cloudMode === 'off' ? 'disabled' : 'signedOut',
  session: null,
  pending: 0,
  ready: cloudMode === 'off',
}));

let engine: SyncEngine | null = null;

const port: DataPort = {
  get: () => pickData(useAppStore.getState()),
  replace: (data) => useAppStore.getState().replaceData(data),
  subscribe: (listener) => useAppStore.subscribe(listener),
  backup: (data) => {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ app: 'lifeos', savedAt: new Date().toISOString(), data }));
    } catch {
      /* Speicher voll – ignorieren */
    }
  },
};

const metaStorage: MetaStorage = {
  load: () => {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as SyncMeta | null;
    } catch {
      return null;
    }
  },
  save: (meta) => {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {
      /* ignorieren */
    }
  },
  clear: () => localStorage.removeItem(META_KEY),
};

/** Einmal beim App-Start aufrufen. */
export async function initCloud(): Promise<void> {
  if (cloudMode === 'off' || engine) return;
  try {
    const backend =
      cloudMode === 'supabase'
        ? await (await import('../services/cloud/supabaseBackend')).createSupabaseBackend(SUPABASE_URL, SUPABASE_KEY)
        : import.meta.env.DEV
          ? (await import('../services/cloud/mockBackend')).createMockBackend() // im Produktions-Build entfernt
          : null;
    if (!backend) return;
    engine = new SyncEngine(backend, port, metaStorage, { auto: true });
    engine.subscribe((s) => useCloud.setState(s));
    useCloud.setState(engine.getState());
    await engine.init();
  } catch (e) {
    useCloud.setState({ status: 'error', error: e instanceof Error ? e.message : String(e), ready: true });
  }
}

function requireEngine(): SyncEngine {
  if (!engine) throw new Error('Cloud-Synchronisierung ist nicht eingerichtet.');
  return engine;
}

export const cloud = {
  signUp: (email: string, password: string) => requireEngine().signUp(email, password),
  signIn: (email: string, password: string) => requireEngine().signIn(email, password),
  signOut: () => requireEngine().signOut(),
  syncNow: () => engine?.syncNow() ?? Promise.resolve(),
  resolveLink: (choice: 'local' | 'cloud') => requireEngine().resolveLink(choice),
  /** Abmelden und dieses Gerät vom Konto trennen (z. B. vor "Alle Daten löschen"). */
  forgetDevice: () => engine?.forgetDevice() ?? Promise.resolve(),
  hasBackup: () => !!localStorage.getItem(BACKUP_KEY),
  backupJson: () => localStorage.getItem(BACKUP_KEY),
};
