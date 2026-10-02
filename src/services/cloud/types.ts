/**
 * Schnittstelle zum Cloud-Backend (V2: Supabase). Die Sync-Engine kennt nur dieses Interface –
 * dadurch lässt sie sich mit einem In-Memory-Backend testen und später austauschen.
 */

export interface CloudSession {
  userId: string;
  email: string;
}

/** Ein synchronisierter Datensatz (eine Zeile in `lifeos_records`). */
export interface RemoteRecord {
  collection: string;
  id: string;
  data: unknown | null;
  deleted: boolean;
  /** Zeitpunkt der Änderung auf dem Gerät (ISO) – entscheidet Konflikte (neuer gewinnt). */
  updatedAt: string;
  /** Vom Server vergeben – Cursor für "alles seit dem letzten Abgleich". */
  serverUpdatedAt?: string;
}

export interface PullResult {
  records: RemoteRecord[];
  cursor: string | null;
}

export interface SignUpResult {
  session: CloudSession | null;
  /** Supabase verschickt eine Bestätigungs-Mail, bevor man sich anmelden kann. */
  needsConfirmation: boolean;
}

export interface CloudAuth {
  getSession(): Promise<CloudSession | null>;
  onChange(cb: (session: CloudSession | null) => void): () => void;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<CloudSession>;
  signOut(): Promise<void>;
}

export interface CloudRecords {
  /** Alle eigenen Datensätze, die seit `since` (Server-Zeit) geändert wurden. */
  pull(userId: string, since: string | null): Promise<PullResult>;
  /** Hochladen; ältere Stände überschreiben neuere nie (Last-Write-Wins auf dem Server). */
  push(userId: string, records: RemoteRecord[]): Promise<void>;
}

export interface CloudBackend {
  kind: 'supabase' | 'mock' | 'memory';
  auth: CloudAuth;
  records: CloudRecords;
}

export type CloudErrorCode = 'network' | 'auth' | 'setup' | 'unknown';

export class CloudError extends Error {
  readonly code: CloudErrorCode;
  constructor(message: string, code: CloudErrorCode) {
    super(message);
    this.name = 'CloudError';
    this.code = code;
  }
}

export function isNetworkError(e: unknown): boolean {
  if (e instanceof CloudError) return e.code === 'network';
  const msg = e instanceof Error ? e.message : String(e);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg);
}
