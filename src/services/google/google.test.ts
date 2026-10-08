import { describe, expect, it } from 'vitest';
import { createExampleData, defaultIntegrationSettings } from '../../domain/defaults';
import type { CalendarEvent, DateKey, GoogleCalendarSettings, Todo } from '../../domain/types';
import { GoogleApiError, type GEvent, type GoogleCalendarApi } from './api';
import { eventIdFor, LIFEOS_MARK, mapGoogleEvents, syncGoogleCalendar, type GoogleSyncData } from './sync';

const TODAY: DateKey = '2026-10-06';
const NOW = new Date(`${TODAY}T09:00:00`);
const TZ = 'Europe/Berlin';
const ts = '2026-10-01T08:00:00.000Z';

/** Test-Kalender im Speicher – verhält sich für LifeOS wie die Google Calendar API. */
function fakeGoogle(initial: GEvent[] = []) {
  const events = new Map<string, GEvent>(initial.map((e) => [e.id, e]));
  const calls = { insert: 0, update: 0, delete: 0 };
  const startOf = (e: GEvent) => new Date(e.start.dateTime ?? `${e.start.date}T00:00:00`);
  const endOf = (e: GEvent) => new Date(e.end.dateTime ?? `${e.end.date}T00:00:00`);
  const api: GoogleCalendarApi = {
    listCalendars: async () => [{ id: 'tim@example.com', summary: 'Tim', primary: true }],
    listEvents: async (_cal, q) =>
      [...events.values()].filter(
        (e) =>
          e.status !== 'cancelled' &&
          endOf(e) > new Date(q.timeMin) &&
          startOf(e) < new Date(q.timeMax) &&
          (!q.privateExtendedProperty || e.extendedProperties?.private?.[LIFEOS_MARK] === '1'),
      ),
    insertEvent: async (_cal, e) => {
      if (events.has(e.id)) throw new GoogleApiError(409, 'Die ID gibt es schon.');
      calls.insert++;
      events.set(e.id, structuredClone(e));
      return e;
    },
    updateEvent: async (_cal, id, e) => {
      calls.update++;
      events.set(id, structuredClone({ ...e, id }));
      return e;
    },
    deleteEvent: async (_cal, id) => {
      calls.delete++;
      events.delete(id);
    },
  };
  return { api, events, calls, lifeos: () => [...events.values()].filter((e) => e.extendedProperties?.private?.[LIFEOS_MARK] === '1') };
}

function makeData(push: Partial<GoogleCalendarSettings['push']> = {}): GoogleSyncData {
  const ex = createExampleData(TODAY, 'Tim');
  const google = defaultIntegrationSettings().googleCalendar;
  return {
    settings: {
      ...ex.settings,
      integrations: { googleCalendar: { ...google, calendarId: 'tim@example.com', calendarName: 'Tim', push: { ...google.push, ...push } } },
    },
    routines: ex.routines,
    events: ex.events,
    tasks: [],
    goals: [],
    dailyStates: {},
    vacations: [],
    specialDays: [],
    subjects: ex.subjects,
    timetable: ex.timetable,
    homework: [],
    exams: [],
    todos: [],
  };
}

/** Lokale Uhrzeit als Zeitpunkt, wie Google ihn liefert – unabhängig von der Zeitzone des Rechners (CI läuft in UTC). */
const local = (date: DateKey, time: string) => new Date(`${date}T${time}:00`).toISOString();

const ownEvent: GEvent = {
  id: 'privat123',
  summary: 'Zahnarzt',
  start: { dateTime: local(TODAY, '16:00') },
  end: { dateTime: local(TODAY, '17:00') },
};

describe('Google Kalender: Übertragen', () => {
  it('überträgt standardmäßig nichts', async () => {
    const g = fakeGoogle();
    const result = await syncGoogleCalendar(g.api, makeData(), NOW, TZ);
    expect(result.push).toMatchObject({ created: 0, updated: 0, deleted: 0 });
    expect(g.events.size).toBe(0);
  });

  it('keine doppelten Events durch wiederholte Synchronisierung – auch nicht von zwei Geräten', async () => {
    const g = fakeGoogle();
    const data = makeData({ events: true });
    const first = await syncGoogleCalendar(g.api, data, NOW, TZ);
    expect(first.push.created).toBe(data.events.length);
    const second = await syncGoogleCalendar(g.api, data, NOW, TZ);
    expect(second.push).toMatchObject({ created: 0, updated: 0, deleted: 0, unchanged: data.events.length });
    // Zweites Gerät mit denselben Daten: gleiche IDs → keine neuen Termine
    await syncGoogleCalendar(g.api, structuredClone(data), NOW, TZ);
    expect(g.lifeos()).toHaveLength(data.events.length);
    expect(g.calls.insert).toBe(data.events.length);
  });

  it('geänderter Termin → vorhandenes Google-Event wird aktualisiert, nicht neu angelegt', async () => {
    const g = fakeGoogle();
    const data = makeData({ events: true });
    await syncGoogleCalendar(g.api, data, NOW, TZ);
    const moved = { ...data, events: data.events.map((e, i) => (i === 0 ? { ...e, start: '15:00', end: '17:30' } : e)) };
    const result = await syncGoogleCalendar(g.api, moved, NOW, TZ);
    expect(result.push).toMatchObject({ created: 0, updated: 1, deleted: 0 });
    expect(g.events.get(eventIdFor(`event:${data.events[0].id}`))?.start.dateTime).toContain('T15:00:00');
  });

  it('gelöschter LifeOS-Termin → nur dessen Google-Event wird gelöscht; eigene Google-Termine bleiben', async () => {
    const g = fakeGoogle([ownEvent]);
    const data = makeData({ events: true });
    await syncGoogleCalendar(g.api, data, NOW, TZ);
    const removed = data.events[0];
    await syncGoogleCalendar(g.api, { ...data, events: data.events.slice(1) }, NOW, TZ);
    expect(g.events.has(eventIdFor(`event:${removed.id}`))).toBe(false);
    expect(g.events.get('privat123')).toEqual(ownEvent);
  });

  it('Kategorie ausgeschaltet → LifeOS räumt seine Einträge wieder auf, fremde bleiben', async () => {
    const g = fakeGoogle([ownEvent]);
    await syncGoogleCalendar(g.api, makeData({ events: true }), NOW, TZ);
    const result = await syncGoogleCalendar(g.api, makeData(), NOW, TZ);
    expect(result.push.deleted).toBeGreaterThan(0);
    expect(g.lifeos()).toHaveLength(0);
    expect([...g.events.keys()]).toEqual(['privat123']);
  });

  it('existiert die ID schon in Google (409), wird aktualisiert statt doppelt angelegt', async () => {
    const data = makeData({ events: true });
    const id = eventIdFor(`event:${data.events[0].id}`);
    const g = fakeGoogle([{ id, status: 'cancelled', summary: 'alt', start: { date: '2025-01-01' }, end: { date: '2025-01-02' } }]);
    await syncGoogleCalendar(g.api, data, NOW, TZ);
    expect(g.events.get(id)).toMatchObject({ status: 'confirmed', summary: data.events[0].title });
    expect(g.lifeos()).toHaveLength(data.events.length);
  });

  it('Event-IDs erfüllen Googles Format (a–v, 0–9)', () => {
    expect(eventIdFor('todo:abc')).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(eventIdFor('todo:abc')).toBe(eventIdFor('todo:abc'));
    expect(eventIdFor('todo:abc')).not.toBe(eventIdFor('todo:abd'));
  });
});

describe('Google Kalender: To-dos', () => {
  const todo = (patch: Partial<Todo>): Todo => ({ id: 'td', title: 'Im Garten etwas machen', completed: false, horizon: 'day', date: TODAY, order: 1, createdAt: ts, updatedAt: ts, ...patch });

  it('nur ausdrücklich markierte To-dos – ohne Erinnerung, außer der Nutzer setzt eine', async () => {
    const g = fakeGoogle();
    const data = makeData({ todos: true });
    data.todos = [todo({ id: 'plain' }), todo({ id: 'marked', googleCalendarSync: true }), todo({ id: 'remind', googleCalendarSync: true, time: '18:00', reminder: { minutesBefore: 10 } })];
    const result = await syncGoogleCalendar(g.api, data, NOW, TZ);
    expect(result.push.created).toBe(2);
    const marked = g.events.get(eventIdFor('todo:marked'))!;
    expect(marked.start).toEqual({ date: TODAY }); // ohne Uhrzeit: ganztägig
    expect(marked.reminders).toEqual({ useDefault: false, overrides: [] });
    expect(g.events.get(eventIdFor('todo:remind'))!.reminders).toEqual({ useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] });
    expect(result.todoEventIds).toEqual({ marked: eventIdFor('todo:marked'), remind: eventIdFor('todo:remind') });

    // Erledigt → wieder aus Google entfernt
    data.todos = data.todos.map((t) => ({ ...t, completed: true }));
    expect((await syncGoogleCalendar(g.api, data, NOW, TZ)).push.deleted).toBe(2);
  });

  it('ohne die Kategorie "To-dos" wird auch ein markiertes To-do nicht übertragen', async () => {
    const g = fakeGoogle();
    const data = makeData();
    data.todos = [todo({ googleCalendarSync: true })];
    await syncGoogleCalendar(g.api, data, NOW, TZ);
    expect(g.events.size).toBe(0);
  });
});

describe('Google Kalender: Lesen', () => {
  it('liest fremde Termine (nicht die eigenen) – sie blockieren Zeit, "frei" markierte nicht', async () => {
    const free: GEvent = { ...ownEvent, id: 'frei1', summary: 'Vielleicht Kino', transparency: 'transparent' };
    const g = fakeGoogle([ownEvent, free]);
    const result = await syncGoogleCalendar(g.api, makeData({ events: true }), NOW, TZ);
    const titles = result.imported.map((e) => e.title).sort();
    expect(titles).toEqual(['Vielleicht Kino', 'Zahnarzt']);
    const dentist = result.imported.find((e) => e.title === 'Zahnarzt')!;
    expect(dentist).toMatchObject({ source: 'google', externalId: 'privat123', date: TODAY, start: '16:00', end: '17:00', blocksFreeTime: true });
    expect(result.imported.find((e) => e.title === 'Vielleicht Kino')?.blocksFreeTime).toBe(false);
  });

  it('verteilt Termine über Mitternacht auf beide Tage und ganztägige auf jeden Tag', () => {
    const range = { from: TODAY, to: '2026-10-20' };
    const night: GEvent = { id: 'n', summary: 'Nachtzug', start: { dateTime: local(TODAY, '22:00') }, end: { dateTime: local('2026-10-07', '02:00') } };
    const trip: GEvent = { id: 't', summary: 'Ausflug', start: { date: '2026-10-08' }, end: { date: '2026-10-10' } };
    const mapped: CalendarEvent[] = mapGoogleEvents('cal', [night, trip], range, 'cat_other');
    expect(mapped.map((e) => `${e.title} ${e.date} ${e.allDay ? 'ganztägig' : `${e.start}-${e.end}`}`)).toEqual([
      `Nachtzug ${TODAY} 22:00-24:00`,
      'Nachtzug 2026-10-07 00:00-02:00',
      'Ausflug 2026-10-08 ganztägig',
      'Ausflug 2026-10-09 ganztägig',
    ]);
    expect(new Set(mapped.map((e) => e.id)).size).toBe(4);
  });
});
