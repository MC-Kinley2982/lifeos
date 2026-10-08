/**
 * Schlanker Client für die Google Calendar REST API v3 (nur was LifeOS braucht).
 * Hinter einem Interface, damit die Synchronisierung ohne echtes Google getestet werden kann.
 */
const BASE = 'https://www.googleapis.com/calendar/v3';

export interface GCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
}

export interface GDateTime {
  /** Ganztägig: "YYYY-MM-DD" */
  date?: string;
  /** Mit Uhrzeit: RFC 3339 bzw. lokale Zeit + timeZone */
  dateTime?: string;
  timeZone?: string;
}

export interface GReminders {
  useDefault: boolean;
  overrides?: Array<{ method: 'popup' | 'email'; minutes: number }>;
}

export interface GEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GDateTime;
  end: GDateTime;
  transparency?: 'opaque' | 'transparent';
  reminders?: GReminders;
  extendedProperties?: { private?: Record<string, string> };
  updated?: string;
}

export interface EventQuery {
  timeMin: string;
  timeMax: string;
  /** z. B. "lifeos=1" – nur Termine mit dieser privaten Markierung */
  privateExtendedProperty?: string;
}

export interface GoogleCalendarApi {
  listCalendars(): Promise<GCalendar[]>;
  listEvents(calendarId: string, query: EventQuery): Promise<GEvent[]>;
  insertEvent(calendarId: string, event: GEvent): Promise<GEvent>;
  updateEvent(calendarId: string, eventId: string, event: GEvent): Promise<GEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function describe(status: number, body: string): string {
  if (status === 401) return 'Google-Anmeldung abgelaufen.';
  if (status === 403) return `Google hat den Zugriff verweigert${body.includes('rateLimit') ? ' (zu viele Anfragen – später erneut versuchen)' : ''}.`;
  if (status === 404) return 'Kalender oder Termin nicht gefunden.';
  return `Google Kalender antwortet mit Fehler ${status}.`;
}

export function createGoogleCalendarApi(getToken: () => Promise<string>, fetchImpl: typeof fetch = (...args) => fetch(...args)): GoogleCalendarApi {
  async function call<T>(method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<T | null> {
    const token = await getToken();
    let res: Response;
    try {
      res = await fetchImpl(`${BASE}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GoogleApiError(0, 'Keine Verbindung zu Google – LifeOS funktioniert offline weiter.');
    }
    if (okStatuses.includes(res.status)) return null;
    if (!res.ok) throw new GoogleApiError(res.status, describe(res.status, await res.text().catch(() => '')));
    if (res.status === 204) return null;
    return (await res.json()) as T;
  }

  async function paged<T>(path: string, params: URLSearchParams): Promise<T[]> {
    const out: T[] = [];
    let pageToken: string | undefined;
    for (let guard = 0; guard < 50; guard++) {
      if (pageToken) params.set('pageToken', pageToken);
      const page = await call<{ items?: T[]; nextPageToken?: string }>('GET', `${path}?${params.toString()}`);
      out.push(...(page?.items ?? []));
      pageToken = page?.nextPageToken;
      if (!pageToken) break;
    }
    return out;
  }

  const cal = (id: string) => `/calendars/${encodeURIComponent(id)}`;

  return {
    // Nur Kalender, in die LifeOS auch schreiben darf.
    listCalendars: () => paged<GCalendar>('/users/me/calendarList', new URLSearchParams({ minAccessRole: 'writer', maxResults: '250' })),

    listEvents: (calendarId, q) => {
      const params = new URLSearchParams({ timeMin: q.timeMin, timeMax: q.timeMax, singleEvents: 'true', maxResults: '2500' });
      if (q.privateExtendedProperty) params.set('privateExtendedProperty', q.privateExtendedProperty);
      return paged<GEvent>(`${cal(calendarId)}/events`, params);
    },

    insertEvent: async (calendarId, event) => (await call<GEvent>('POST', `${cal(calendarId)}/events`, event))!,

    updateEvent: async (calendarId, eventId, event) =>
      (await call<GEvent>('PUT', `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, event))!,

    // Schon gelöscht (404/410) zählt als erledigt.
    deleteEvent: async (calendarId, eventId) => {
      await call('DELETE', `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, undefined, [404, 410]);
    },
  };
}
