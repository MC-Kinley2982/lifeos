import { describe, expect, it } from 'vitest';
import { createExampleData } from '../../domain/defaults';
import { weekDays } from '../../domain/time';
import type { DateKey, FocusDay, Goal } from '../../domain/types';
import { emptyData, normalizeData } from '../../store/persistence';
import { computeGoalProgress } from '../planner/goals';
import type { PlannerData } from '../planner/types';
import { applyRecords, toRecords } from '../sync/records';
import { focusMinutesFor, focusWeek, isFocusDay, knownFocusNames } from './days';

const day = (date: DateKey, patch: Partial<FocusDay> = {}): FocusDay => ({
  id: date,
  date,
  totalMin: 120,
  byCategory: { productive: 90, neutral: 20, unproductive: 10 },
  groups: [],
  ...patch,
});

const goal = (patch: Partial<Goal> = {}): Goal => ({
  id: 'g_chess',
  title: 'Schach',
  color: '#fff',
  categoryId: 'cat_hobby',
  target: { type: 'weeklyMinutes', minutes: 180 },
  sessionMin: 30,
  energy: 'medium',
  active: true,
  log: [],
  focusMatch: ['Schach'],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...patch,
});

describe('Rechnerzeit einem Ziel zuordnen', () => {
  it('nimmt eine Gruppe, ohne Groß-/Kleinschreibung', () => {
    const d = day('2026-09-30', { groups: [{ name: 'SCHACH', minutes: 40 }] });
    expect(focusMinutesFor(goal(), d)).toBe(40);
  });

  it('Gruppe hat Vorrang vor einer gleichnamigen App – nichts wird doppelt gezählt', () => {
    const d = day('2026-09-30', { groups: [{ name: 'Blender', minutes: 60 }], activities: [{ name: 'Blender', minutes: 55, kind: 'app' }] });
    expect(focusMinutesFor(goal({ focusMatch: ['blender'] }), d)).toBe(60);
  });

  it('ohne Gruppe zählen gleichnamige Apps/Websites zusammen', () => {
    const d = day('2026-09-30', {
      activities: [
        { name: 'Chess.com', minutes: 25, kind: 'web' },
        { name: 'chess.com', minutes: 5, kind: 'app' },
        { name: 'YouTube', minutes: 90, kind: 'web' },
      ],
    });
    expect(focusMinutesFor(goal({ focusMatch: ['Chess.com'] }), d)).toBe(30);
  });

  it('mehrere Namen werden addiert; ohne Treffer, ohne Tag oder ohne Namen sind es 0 Minuten', () => {
    const d = day('2026-09-30', { groups: [{ name: 'Schach', minutes: 20 }], activities: [{ name: 'Blender', minutes: 15, kind: 'app' }] });
    expect(focusMinutesFor(goal({ focusMatch: ['Schach', 'Blender'] }), d)).toBe(35);
    expect(focusMinutesFor(goal({ focusMatch: ['Fußball'] }), d)).toBe(0);
    expect(focusMinutesFor(goal(), undefined)).toBe(0);
    expect(focusMinutesFor(goal({ focusMatch: undefined }), d)).toBe(0);
  });

  it('gleichnamige Gruppen werden nicht addiert (sie überschneiden sich meist)', () => {
    const d = day('2026-09-30', { groups: [{ name: 'Schach', minutes: 20 }, { name: 'schach', minutes: 35 }] });
    expect(focusMinutesFor(goal(), d)).toBe(35);
  });
});

describe('Wochen-Zusammenfassung und Vorschläge', () => {
  const days = [
    day('2026-09-28', { totalMin: 100, groups: [{ name: 'Blender', minutes: 60 }], activities: [{ name: 'Blender', minutes: 58, kind: 'app' }] }),
    day('2026-09-30', { totalMin: 200, groups: [{ name: 'blender', minutes: 30 }, { name: 'Schach', minutes: 20 }], activities: [{ name: 'Chess.com', minutes: 20, kind: 'web' }] }),
    day('2026-10-07', { totalMin: 999 }), // andere Woche
  ];

  it('fasst nur die Tage der Woche zusammen, größte Einträge zuerst', () => {
    const w = focusWeek(days, weekDays('2026-09-30', 0));
    expect(w.daysTracked).toBe(2);
    expect(w.totalMin).toBe(300);
    expect(w.groups.map((g) => [g.name.toLowerCase(), g.minutes])).toEqual([['blender', 90], ['schach', 20]]);
    expect(w.byCategory).toEqual({ productive: 180, neutral: 40, unproductive: 20 });
    expect(w.perDay.map((p) => p.date)).toEqual(['2026-09-28', '2026-09-30']);
  });

  it('leere Woche ergibt leere Zusammenfassung', () => {
    expect(focusWeek(days, weekDays('2026-11-18', 0)).daysTracked).toBe(0);
    expect(focusWeek(undefined, ['2026-09-28']).totalMin).toBe(0);
  });

  it('schlägt bekannte Namen vor – Gruppen vor Apps', () => {
    const names = knownFocusNames(days);
    expect(names[0].kind).toBe('group');
    expect(names.map((n) => n.name.toLowerCase())).toEqual(['blender', 'schach', 'chess.com']);
  });
});

describe('Ziel-Fortschritt mit Rechnerzeit', () => {
  const WED: DateKey = '2026-09-30';
  const now = new Date('2026-10-01T12:00:00');

  function setup(focusDays: FocusDay[]): { data: PlannerData; goalId: string } {
    const ex = createExampleData(WED, 'Test');
    const chessRoutine = ex.routines.find((r) => r.name === 'Schach-AG')!;
    chessRoutine.goalId = 'g_chess'; // Mittwoch 16:30–18:00 = 90 min
    const data: PlannerData = {
      settings: ex.settings,
      routines: ex.routines,
      events: ex.events,
      tasks: [],
      goals: [goal()],
      dailyStates: {},
      vacations: [],
      specialDays: [],
      subjects: ex.subjects,
      timetable: ex.timetable,
      homework: [],
      exams: ex.exams,
      focusDays,
    };
    return { data, goalId: 'g_chess' };
  }
  const week = weekDays(WED, 0);

  it('ohne Rechner-Daten bleibt es bei der bisherigen Annahme (Routine hat stattgefunden)', () => {
    const { data, goalId } = setup([]);
    expect(computeGoalProgress(data, week, now)[goalId].doneMin).toBe(90);
  });

  it('echte Zeit ersetzt an einem erfassten Tag die Annahme – und zählt nicht doppelt', () => {
    const { data, goalId } = setup([day(WED, { groups: [{ name: 'Schach', minutes: 40 }] })]);
    const p = computeGoalProgress(data, week, now)[goalId];
    expect(p.doneMin).toBe(40);
    expect(p.trackedMin).toBe(40);
  });

  it('erfasster Tag ohne Schach heißt: nicht gemacht (0 Minuten statt der Routine-Annahme)', () => {
    const { data, goalId } = setup([day(WED, { groups: [{ name: 'Blender', minutes: 60 }] })]);
    expect(computeGoalProgress(data, week, now)[goalId].doneMin).toBe(0);
  });

  it('andere Tage ohne Daten behalten die Annahme, erfasste Tage zählen echt', () => {
    const { data, goalId } = setup([day('2026-09-28', { groups: [{ name: 'Schach', minutes: 20 }] })]);
    const p = computeGoalProgress(data, week, now)[goalId];
    expect(p.doneMin).toBe(110); // 90 (Mittwoch ohne Daten, laut Routine) + 20 (Montag gemessen)
    expect(p.trackedMin).toBe(20);
  });

  it('ohne focusMatch am Ziel ändert Rechnerzeit nichts', () => {
    const { data, goalId } = setup([day(WED, { groups: [{ name: 'Schach', minutes: 40 }] })]);
    data.goals = [goal({ focusMatch: undefined })];
    const p = computeGoalProgress(data, week, now)[goalId];
    expect(p.doneMin).toBe(90);
    expect(p.trackedMin).toBeUndefined();
  });

  it('heute: der noch kommende Teil der Routine bleibt geplant', () => {
    const { data, goalId } = setup([day(WED, { groups: [{ name: 'Schach', minutes: 10 }] })]);
    const p = computeGoalProgress(data, week, new Date('2026-09-30T17:00:00'))[goalId];
    expect(p.doneMin).toBe(10); // gemessen, nicht "30 min seit Beginn der Routine"
    expect(p.plannedMin).toBe(60); // 17:00–18:00
  });
});

describe('Synchronisierung und Speicher', () => {
  it('focusDays werden mit der Cloud abgeglichen und vom Co-Pilot gelieferte Tage übernommen', () => {
    const data = { ...emptyData(), focusDays: [day('2026-09-30', { groups: [{ name: 'Schach', minutes: 40 }] })] };
    expect(toRecords(data).has('focusDays/2026-09-30')).toBe(true);

    const next = applyRecords(emptyData(), [
      { collection: 'focusDays', id: '2026-10-01', data: day('2026-10-01'), deleted: false, updatedAt: '2026-10-01T20:00:00.000Z' },
    ]);
    expect(next.focusDays.map((d) => d.date)).toEqual(['2026-10-01']);

    const gone = applyRecords(next, [{ collection: 'focusDays', id: '2026-10-01', data: null, deleted: true, updatedAt: '2026-10-02T08:00:00.000Z' }]);
    expect(gone.focusDays).toEqual([]);
  });

  it('ältere Daten ohne focusDays bleiben gültig, ungültige Einträge werden verworfen', () => {
    const old = { ...emptyData() } as Partial<ReturnType<typeof emptyData>>;
    delete old.focusDays;
    expect(normalizeData(old).focusDays).toEqual([]);

    const mixed = normalizeData({ ...emptyData(), focusDays: [day('2026-09-30'), { id: 'x' } as unknown as FocusDay] });
    expect(mixed.focusDays).toHaveLength(1);
    expect(isFocusDay({ id: '2026-09-30', date: '2026-09-30', totalMin: 5, groups: [], byCategory: {} })).toBe(true);
    expect(isFocusDay(null)).toBe(false);
  });
});
