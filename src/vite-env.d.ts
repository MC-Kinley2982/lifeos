/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase-Projekt-URL, z. B. https://abcd1234.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Öffentlicher Client-Schlüssel ("publishable key", sb_publishable_…) */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Älterer Name für den öffentlichen Schlüssel ("anon key") – wird ebenfalls akzeptiert. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Nur Entwicklung: simulierte Cloud über den Vite-Dev-Server. */
  readonly VITE_MOCK_CLOUD?: string;
  /** Google-OAuth-Client-ID (Typ "Webanwendung", öffentlich) für Google Kalender – ohne Client-Secret. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
