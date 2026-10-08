/**
 * Google-Kalender-Konfiguration über Umgebungsvariablen (siehe .env.example / README).
 * Die OAuth-Client-ID ist öffentlich (sie steht in jeder Web-App im Code) – ein Client-Secret
 * gibt es bei diesem Ablauf nicht und darf nie in den Code.
 * Ohne Client-ID zeigt LifeOS nur an, was noch eingerichtet werden muss.
 */
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

export const googleConfigured = GOOGLE_CLIENT_ID.length > 0;

/**
 * Möglichst wenige Rechte: Liste der Kalender lesen + Termine lesen/schreiben.
 * Keine Kalender-Einstellungen, keine Freigaben, kein Gmail o. Ä.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

/** So viele Tage ab heute werden gelesen und abgeglichen. */
export const GOOGLE_SYNC_DAYS = 28;
