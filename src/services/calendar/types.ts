import type { CalendarEvent, DateKey, EventSource } from '../../domain/types';

/**
 * Schnittstelle für Kalender-Quellen.
 *
 * V1: nur lokale Termine (im Store). Später implementiert z. B. ein `googleCalendarProvider`
 * dieses Interface. Ein Sync-Service merged dessen Termine (source: 'google', externalId)
 * in die Event-Liste – Planer und UI bleiben unverändert.
 */
export interface CalendarProvider {
  id: EventSource;
  name: string;
  /** Ist die Quelle verbunden/aktiv? */
  isConnected(): boolean;
  listEvents(range: { from: DateKey; to: DateKey }): Promise<CalendarEvent[]>;
}
