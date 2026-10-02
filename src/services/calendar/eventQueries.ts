import type { CalendarEvent, DateKey } from '../../domain/types';

/** Reine Abfragen auf Termin-Listen – unabhängig davon, woher die Termine stammen. */

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

export function upcomingEvents(events: CalendarEvent[], from: DateKey): CalendarEvent[] {
  return sortEvents(events.filter((e) => e.date >= from));
}

export function pastEvents(events: CalendarEvent[], before: DateKey): CalendarEvent[] {
  return sortEvents(events.filter((e) => e.date < before)).reverse();
}
