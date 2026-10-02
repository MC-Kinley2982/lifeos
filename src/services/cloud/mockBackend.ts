import { CloudError, type CloudBackend, type CloudSession } from './types';

const SESSION_KEY = 'lifeos-mock-session';

/** NUR ENTWICKLUNG: spricht mit dem Mock-Server im Vite-Dev-Server (dev/mockCloudPlugin.ts). */
export function createMockBackend(): CloudBackend {
  const listeners = new Set<(s: CloudSession | null) => void>();
  const load = (): { session: CloudSession; token: string } | null => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    } catch {
      return null;
    }
  };
  let current = load();

  const call = async (path: string, init?: RequestInit) => {
    let res: Response;
    try {
      res = await fetch(`/__mock-cloud${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(current ? { Authorization: `Bearer ${current.token}` } : {}) },
      });
    } catch {
      throw new CloudError('Keine Verbindung zum Server.', 'network');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new CloudError(body.error ?? 'Fehler', res.status === 401 || res.status === 400 ? 'auth' : 'unknown');
    return body;
  };

  const setSession = (next: { session: CloudSession; token: string } | null) => {
    current = next;
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
    listeners.forEach((l) => l(next?.session ?? null));
  };

  return {
    kind: 'mock',
    auth: {
      getSession: async () => current?.session ?? null,
      onChange: (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      signUp: async (email, password) => {
        const body = await call('/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
        setSession(body);
        return { session: body.session, needsConfirmation: false };
      },
      signIn: async (email, password) => {
        const body = await call('/signin', { method: 'POST', body: JSON.stringify({ email, password }) });
        setSession(body);
        return body.session;
      },
      signOut: async () => setSession(null),
    },
    records: {
      pull: async (_userId, since) => call(`/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`),
      push: async (_userId, records) => {
        await call('/push', { method: 'POST', body: JSON.stringify({ records }) });
      },
    },
  };
}
