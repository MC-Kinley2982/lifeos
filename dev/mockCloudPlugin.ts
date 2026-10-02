import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { MemoryCloudStore } from '../src/services/cloud/memoryStore';
import { CloudError } from '../src/services/cloud/types';

/**
 * NUR FÜR DIE ENTWICKLUNG: simuliert die Cloud im Vite-Dev-Server (gleiche Regeln wie Supabase:
 * nur eigene Daten, Last-Write-Wins). Zwei Browser-Ursprünge (localhost / 127.0.0.1) haben getrennte
 * lokale Speicher – damit lässt sich PC ↔ iPhone ohne echtes Supabase durchspielen.
 * POST /__mock-cloud/offline {"offline":true} simuliert einen Verbindungsabbruch.
 */
export function mockCloudPlugin(): Plugin {
  const store = new MemoryCloudStore();
  let offline = false;

  const readBody = (req: IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolve) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          resolve({});
        }
      });
    });

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  return {
    name: 'lifeos-mock-cloud',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__mock-cloud', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = url.pathname;
        try {
          if (path === '/offline') {
            offline = !!(await readBody(req)).offline;
            return send(res, 200, { offline });
          }
          if (offline) {
            req.socket.destroy(); // wie ein echter Netzwerkfehler
            return;
          }
          if (path === '/signup' || path === '/signin') {
            const body = await readBody(req);
            const email = String(body.email ?? '');
            const password = String(body.password ?? '');
            const session = path === '/signup' ? store.signUp(email, password) : store.signIn(email, password);
            return send(res, 200, { session, token: `mock:${session.userId}` });
          }
          const auth = req.headers.authorization ?? '';
          const userId = auth.startsWith('Bearer mock:') ? auth.slice('Bearer mock:'.length) : '';
          if (!userId) return send(res, 401, { error: 'Nicht angemeldet.' });
          if (path === '/pull') return send(res, 200, store.pull(userId, url.searchParams.get('since')));
          if (path === '/push') {
            const body = await readBody(req);
            store.push(userId, Array.isArray(body.records) ? body.records : []);
            return send(res, 200, { ok: true });
          }
          send(res, 404, { error: 'Unbekannter Endpunkt' });
        } catch (e) {
          send(res, e instanceof CloudError ? 400 : 500, { error: e instanceof Error ? e.message : String(e) });
        }
      });
    },
  };
}
