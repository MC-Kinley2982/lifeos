import { stamp } from '../../domain/factories';
import type { CalendarEvent } from '../../domain/types';
import { patchEntity, removeById } from '../helpers';
import type { EventActions, SliceCreator } from '../types';

export interface EventsSlice extends EventActions {
  events: CalendarEvent[];
}

export const createEventsSlice: SliceCreator<EventsSlice> = (set) => ({
  events: [],

  addEvent: (input) => {
    const event = stamp(input, 'event');
    set((state) => ({ events: [...state.events, event] }));
    return event.id;
  },

  updateEvent: (id, patch) => set((state) => ({ events: patchEntity(state.events, id, patch) })),

  removeEvent: (id) => set((state) => ({ events: removeById(state.events, id) })),

  replaceGoogleEvents: (calendarId, incoming, range) =>
    set((state) => {
      const inRange = (e: CalendarEvent) => !range || (e.date >= range.from && e.date < range.to);
      // Bleiben: eigene Termine und Google-Termine dieses Kalenders außerhalb des gelesenen Zeitraums.
      const keep = (e: CalendarEvent) => e.source !== 'google' || (calendarId !== null && e.calendarId === calendarId && !inRange(e));
      const kept = state.events.filter(keep);
      const before = state.events.filter((e) => !keep(e));
      const byId = (a: CalendarEvent, b: CalendarEvent) => a.id.localeCompare(b.id);
      if (JSON.stringify([...before].sort(byId)) === JSON.stringify([...incoming].sort(byId))) return {};
      return { events: [...kept, ...incoming] };
    }),
});
