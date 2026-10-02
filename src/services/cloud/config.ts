/**
 * Cloud-Konfiguration über Umgebungsvariablen (siehe .env.example).
 * Ohne Konfiguration läuft LifeOS wie bisher rein lokal.
 */
const env = import.meta.env;

export const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? '').trim();
export const SUPABASE_KEY = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();

export type CloudMode = 'supabase' | 'mock' | 'off';

export const cloudMode: CloudMode = SUPABASE_URL && SUPABASE_KEY ? 'supabase' : env.DEV && env.VITE_MOCK_CLOUD === 'true' ? 'mock' : 'off';

/** Wohin Bestätigungs-Links aus E-Mails zurückführen. */
export function authRedirectUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
