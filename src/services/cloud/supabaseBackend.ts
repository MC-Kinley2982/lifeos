import type { AuthError, PostgrestError, Session } from '@supabase/supabase-js';
import { authRedirectUrl } from './config';
import { CloudError, isNetworkError, type CloudBackend, type CloudSession, type RemoteRecord } from './types';

const TABLE = 'lifeos_records';
const PAGE = 1000;
/** Überlappung beim Abholen – fängt Einträge ab, deren Transaktion etwas später sichtbar wurde. */
const OVERLAP_MS = 5000;

interface Row {
  collection: string;
  id: string;
  data: unknown;
  deleted: boolean;
  updated_at: string;
  server_updated_at: string;
}

const iso = (t: string) => new Date(t).toISOString();

function authError(error: AuthError): CloudError {
  if (isNetworkError(error) || error.name === 'AuthRetryableFetchError') return new CloudError('Keine Verbindung zum Server.', 'network');
  const code = error.code ?? '';
  const msg = error.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return new CloudError('E-Mail oder Passwort ist falsch.', 'auth');
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg))
    return new CloudError('Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Bestätigungs-Mail).', 'auth');
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return new CloudError('Für diese E-Mail gibt es schon ein Konto – bitte anmelden.', 'auth');
  if (code === 'weak_password' || /password/i.test(msg)) return new CloudError('Das Passwort ist zu schwach (mindestens 6 Zeichen, besser 8+).', 'auth');
  if (code.includes('rate_limit')) return new CloudError('Zu viele Versuche in kurzer Zeit – bitte etwas später erneut probieren.', 'auth');
  if (code === 'signup_disabled') return new CloudError('Registrierung ist in Supabase deaktiviert.', 'setup');
  return new CloudError(msg || 'Anmeldung fehlgeschlagen.', 'auth');
}

function dbError(error: PostgrestError): CloudError {
  if (isNetworkError(error)) return new CloudError('Keine Verbindung zum Server.', 'network');
  if (error.code === '42P01' || /relation .* does not exist|could not find the table/i.test(error.message))
    return new CloudError('Die Tabelle "lifeos_records" fehlt – bitte die SQL-Migration in Supabase ausführen.', 'setup');
  if (error.code === '42501') return new CloudError('Keine Berechtigung – bitte neu anmelden.', 'auth');
  return new CloudError(error.message || 'Synchronisierung fehlgeschlagen.', 'unknown');
}

/** Supabase-Anbindung (Auth + Postgres). supabase-js wird erst geladen, wenn die Cloud konfiguriert ist. */
export async function createSupabaseBackend(url: string, key: string): Promise<CloudBackend> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'lifeos-auth' },
  });
  const toSession = (s: Session | null): CloudSession | null => (s?.user ? { userId: s.user.id, email: s.user.email ?? '' } : null);

  return {
    kind: 'supabase',
    auth: {
      async getSession() {
        const { data } = await client.auth.getSession();
        return toSession(data.session);
      },
      onChange(cb) {
        const { data } = client.auth.onAuthStateChange((_event, session) => cb(toSession(session)));
        return () => data.subscription.unsubscribe();
      },
      async signUp(email, password) {
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl() } });
        if (error) throw authError(error);
        return { session: toSession(data.session), needsConfirmation: !data.session };
      },
      async signIn(email, password) {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw authError(error);
        const session = toSession(data.session);
        if (!session) throw new CloudError('Anmeldung fehlgeschlagen.', 'auth');
        return session;
      },
      async signOut() {
        // "local": funktioniert auch offline; die Sitzung auf diesem Gerät wird beendet.
        await client.auth.signOut({ scope: 'local' });
      },
    },
    records: {
      async pull(userId, since) {
        const sinceTs = since ? new Date(Date.parse(since) - OVERLAP_MS).toISOString() : null;
        const rows: Row[] = [];
        for (let from = 0; ; from += PAGE) {
          let query = client
            .from(TABLE)
            .select('collection,id,data,deleted,updated_at,server_updated_at')
            .eq('user_id', userId)
            .order('server_updated_at', { ascending: true })
            .range(from, from + PAGE - 1);
          if (sinceTs) query = query.gt('server_updated_at', sinceTs);
          const { data, error } = await query;
          if (error) throw dbError(error);
          rows.push(...((data ?? []) as Row[]));
          if (!data || data.length < PAGE) break;
        }
        const records: RemoteRecord[] = rows.map((r) => ({
          collection: r.collection,
          id: r.id,
          data: r.data,
          deleted: r.deleted,
          updatedAt: iso(r.updated_at),
          serverUpdatedAt: iso(r.server_updated_at),
        }));
        return { records, cursor: records.length ? records[records.length - 1].serverUpdatedAt! : since };
      },
      async push(userId, records) {
        for (let i = 0; i < records.length; i += 500) {
          const chunk = records.slice(i, i + 500).map((r) => ({
            user_id: userId,
            collection: r.collection,
            id: r.id,
            data: r.data,
            deleted: r.deleted,
            updated_at: r.updatedAt,
          }));
          const { error } = await client.from(TABLE).upsert(chunk, { onConflict: 'user_id,collection,id' });
          if (error) throw dbError(error);
        }
      },
    },
  };
}
