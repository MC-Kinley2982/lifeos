import { CloudError, type CloudSession, type RemoteRecord } from './types';

interface StoredRow extends RemoteRecord {
  userId: string;
  serverUpdatedAt: string;
}

/**
 * Server-Nachbildung im Speicher – verhält sich wie `lifeos_records` + Trigger in Supabase:
 * nur eigene Zeilen, Last-Write-Wins nach `updatedAt`, Server-Zeitstempel als Cursor.
 * Wird von Tests und vom Entwicklungs-Mock (vite-Plugin) genutzt.
 */
export class MemoryCloudStore {
  private users = new Map<string, { id: string; email: string; password: string }>();
  private rows = new Map<string, StoredRow>();
  private clock = 0;

  private serverNow(): string {
    const t = Math.max(Date.now(), this.clock + 1);
    this.clock = t;
    return new Date(t).toISOString();
  }

  signUp(email: string, password: string): CloudSession {
    const key = email.trim().toLowerCase();
    if (!key.includes('@')) throw new CloudError('Bitte gib eine gültige E-Mail-Adresse ein.', 'auth');
    if (password.length < 6) throw new CloudError('Das Passwort muss mindestens 6 Zeichen haben.', 'auth');
    if (this.users.has(key)) throw new CloudError('Für diese E-Mail gibt es schon ein Konto – bitte anmelden.', 'auth');
    const user = { id: `user-${this.users.size + 1}-${Math.random().toString(36).slice(2, 8)}`, email: key, password };
    this.users.set(key, user);
    return { userId: user.id, email: user.email };
  }

  signIn(email: string, password: string): CloudSession {
    const user = this.users.get(email.trim().toLowerCase());
    if (!user || user.password !== password) throw new CloudError('E-Mail oder Passwort ist falsch.', 'auth');
    return { userId: user.id, email: user.email };
  }

  pull(userId: string, since: string | null): { records: RemoteRecord[]; cursor: string | null } {
    const records = [...this.rows.values()]
      .filter((r) => r.userId === userId && (!since || r.serverUpdatedAt > since))
      .sort((a, b) => a.serverUpdatedAt.localeCompare(b.serverUpdatedAt))
      .map(({ userId: _u, ...rest }) => ({ ...rest }));
    const cursor = records.length ? records[records.length - 1].serverUpdatedAt! : since;
    return { records, cursor };
  }

  push(userId: string, records: RemoteRecord[]): void {
    for (const r of records) {
      const key = `${userId}/${r.collection}/${r.id}`;
      const existing = this.rows.get(key);
      if (existing && r.updatedAt < existing.updatedAt) continue; // älterer Stand verliert
      this.rows.set(key, { ...r, userId, serverUpdatedAt: this.serverNow() });
    }
  }

  hasData(userId: string): boolean {
    return [...this.rows.values()].some((r) => r.userId === userId && !r.deleted);
  }

  /** Nur für Tests: Datensätze eines Nutzers. */
  dump(userId: string): RemoteRecord[] {
    return this.pull(userId, null).records;
  }
}
