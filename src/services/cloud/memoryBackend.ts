import { MemoryCloudStore } from './memoryStore';
import { CloudError, type CloudBackend, type CloudSession } from './types';

/**
 * Backend für Tests: ein gemeinsamer MemoryCloudStore ("Server"), pro Gerät eine eigene Instanz.
 * `setOnline(false)` simuliert einen Verbindungsabbruch.
 */
export function createMemoryBackend(store: MemoryCloudStore): CloudBackend & { setOnline(v: boolean): void } {
  let online = true;
  let session: CloudSession | null = null;
  const listeners = new Set<(s: CloudSession | null) => void>();
  const net = () => {
    if (!online) throw new CloudError('Keine Verbindung zum Server.', 'network');
  };
  const emit = () => listeners.forEach((l) => l(session));

  return {
    kind: 'memory',
    setOnline: (v) => {
      online = v;
    },
    auth: {
      getSession: async () => session,
      onChange: (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      signUp: async (email, password) => {
        net();
        session = store.signUp(email, password);
        emit();
        return { session, needsConfirmation: false };
      },
      signIn: async (email, password) => {
        net();
        session = store.signIn(email, password);
        emit();
        return session;
      },
      signOut: async () => {
        session = null;
        emit();
      },
    },
    records: {
      pull: async (userId, since) => {
        net();
        return store.pull(userId, since);
      },
      push: async (userId, records) => {
        net();
        store.push(userId, records);
      },
    },
  };
}
