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
});
