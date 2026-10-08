import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './config';

/**
 * Google-Anmeldung im Browser über Google Identity Services (OAuth 2.0 Token-Modell).
 *
 * - Kein Client-Secret, kein Server nötig – passt zu einer statischen PWA (GitHub Pages).
 * - Das Zugriffstoken gilt ca. 1 Stunde und bleibt nur auf diesem Gerät (sessionStorage),
 *   es wird nie mit der Cloud synchronisiert.
 * - Ist es abgelaufen, genügt ein Tipp auf "Synchronisieren": Google meldet ohne erneute
 *   Zustimmung an (Popup braucht eine Nutzeraktion, deshalb nie automatisch im Hintergrund).
 */

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const TOKEN_KEY = 'lifeos-google-token';

export class GoogleAuthError extends Error {}

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

let token: StoredToken | null = readToken();
let gisLoading: Promise<void> | null = null;

function readToken(): StoredToken | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as StoredToken | null;
    return t && t.expiresAt > Date.now() ? t : null;
  } catch {
    return null;
  }
}

function writeToken(t: StoredToken | null): void {
  token = t;
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* privater Modus o. Ä. – Token bleibt nur im Speicher */
  }
}

/** Google-Skript laden (einmal). Vorab aufrufen, damit der Klick auf "Verbinden" sofort ein Popup öffnen kann. */
export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoading = null;
      reject(new GoogleAuthError('Google-Anmeldung konnte nicht geladen werden (offline?).'));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

/** Gültiges Zugriffstoken dieses Geräts (oder null, wenn abgelaufen bzw. nie angemeldet). */
export function currentGoogleToken(): string | null {
  if (token && token.expiresAt - 60_000 > Date.now()) return token.accessToken;
  return null;
}

export function clearGoogleToken(): void {
  writeToken(null);
}

/**
 * Anmelden bzw. Token erneuern – muss aus einem Klick heraus aufgerufen werden (Popup).
 * prompt "consent" beim ersten Verbinden, "" danach (keine erneute Zustimmung nötig).
 */
export function requestGoogleToken(prompt: 'consent' | '' = '', loginHint?: string): Promise<string> {
  const start = (oauth2: GoogleOAuth2) =>
    new Promise<string>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES.join(' '),
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new GoogleAuthError(response.error_description || response.error || 'Google-Anmeldung fehlgeschlagen.'));
            return;
          }
          if (!oauth2.hasGrantedAllScopes(response, ...GOOGLE_SCOPES)) {
            reject(new GoogleAuthError('Bitte erlaube LifeOS den Zugriff auf deine Kalender (beide Häkchen setzen).'));
            return;
          }
          writeToken({ accessToken: response.access_token, expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 });
          resolve(response.access_token);
        },
        error_callback: (error) =>
          reject(
            new GoogleAuthError(
              error.type === 'popup_closed'
                ? 'Google-Anmeldung abgebrochen.'
                : error.type === 'popup_failed_to_open'
                  ? 'Das Google-Fenster wurde blockiert – bitte Popups für LifeOS erlauben.'
                  : 'Google-Anmeldung fehlgeschlagen.',
            ),
          ),
      });
      client.requestAccessToken({ prompt, ...(loginHint ? { login_hint: loginHint } : {}) });
    });

  // Ist das Skript schon da, öffnet sich das Popup direkt im Klick (wichtig für Safari/iPhone).
  const oauth2 = window.google?.accounts?.oauth2;
  if (oauth2) return start(oauth2);
  return loadGoogleIdentity().then(() => start(window.google!.accounts!.oauth2!));
}

/** Zugriff bei Google widerrufen und das Token auf diesem Gerät löschen. */
export function revokeGoogleToken(): Promise<void> {
  const t = token?.accessToken;
  writeToken(null);
  const oauth2 = window.google?.accounts?.oauth2;
  if (!t || !oauth2) return Promise.resolve();
  return new Promise((resolve) => oauth2.revoke(t, () => resolve()));
}
