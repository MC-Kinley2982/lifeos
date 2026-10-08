import { describe, expect, it } from 'vitest';
import { createExampleData, morningRoutinePeriod } from '../../domain/defaults';
import { toHHMM, toMinutes } from '../../domain/time';
import type { DateKey, Goal, Homework, Routine, Task } from '../../domain/types';
import { createHomeworkInput } from '../school/homework';
import { planSchoolWork } from '../school/schoolPlanner';
import { planTasks } from './autoPlan';
import { plannableSlots } from './freeTime';
import { buildDaySchedule } from './schedule';
import { suggestNow } from './suggest';
import type { PlannerData } from './types';

const TUE: DateKey = '2026-09-29';
const WED: DateKey = '2026-09-30';
const at = (date: DateKey, time: string) => new Date(`${date}T${time}:00`);
const ts = '2026-09-01T00:00:00.000Z';

/** Beispiel-Alltag: Aufstehen 07:00, Frühstück 07:15–07:35, Schule ab 08:00. */
function makeData(): PlannerData {
  const ex = createExampleData(TUE, 'Test');
  return {
    settings: ex.settings,
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
  };
}

function task(id: string, title: string, minutes: number, extra: Partial<Task> = {}): Task {
  return { id, title, estimatedMin: minutes, priority: 'high', categoryId: 'cat_learning', energy: 'low', status: 'todo', createdAt: ts, updatedAt: ts, ...extra };
}

const slotsText = (data: PlannerData, date: DateKey) => plannableSlots(buildDaySchedule(data, date), data.settings.planning).map((s) => `${toHHMM(s.start)}-${toHHMM(s.end)}`);

describe('Morgenroutine als geschützter Zeitraum', () => {
  it('15 Minuten zwischen Aufstehen und Frühstück sind frei, aber nicht planbar', () => {
    const data = makeData();
    const schedule = buildDaySchedule(data, TUE);
    // Die Lücke ist weiterhin freie Zeit …
    expect(schedule.freeSlots.some((s) => toHHMM(s.start) === '07:00' && toHHMM(s.end) === '07:15')).toBe(true);
    // … aber nicht für die automatische Planung (Morgenroutine: ab Aufstehen 45 min).
    expect(slotsText(data, TUE).some((s) => s < '07:45')).toBe(false);

    data.settings.planning.protectedPeriods = [];
    expect(slotsText(data, TUE)[0]).toBe('07:00-07:15');
  });

  it('Planner legt dort keine normale Aufgabe ab – auch keine kurze', () => {
    const data = makeData();
    data.tasks = [task('mathe', 'Mathe üben', 15, { deadline: TUE })];
    const plan = planTasks(data, { dates: [TUE], now: at(TUE, '06:30'), includeGoals: false });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].start).toBeGreaterThanOrEqual(toMinutes('07:45'));
  });

  it('"Morgenroutine endet um 07:45" – vorher wird nichts eingeplant (Beispiel aus der Anforderung)', () => {
    const data = makeData();
    const dressing: Routine = {
      id: 'dress', name: 'Anziehen', categoryId: 'cat_other', color: '#888', weekdays: [1], start: '07:00', end: '07:20',
      priority: 'medium', blocksFreeTime: true, enabled: true, travelBeforeMin: 0, travelAfterMin: 0, createdAt: ts, updatedAt: ts,
    };
    data.routines = [...data.routines, dressing];
    data.settings.planning.protectedPeriods = [{ ...morningRoutinePeriod(), until: { at: 'time', time: '07:45' } }];
    data.tasks = [task('t1', 'Vokabeln', 15, { deadline: TUE }), task('t2', 'Mathe', 20, { deadline: TUE })];
    const plan = planTasks(data, { dates: [TUE], now: at(TUE, '06:30'), includeGoals: false });
    expect(plan.items.every((i) => i.start >= toMinutes('07:45'))).toBe(true);
  });

  it('gilt auch für Hausaufgaben – keine künstlichen Mini-Lernblöcke am Morgen', () => {
    const data = makeData();
    const math = data.subjects.find((s) => s.shortName === 'Ma')!;
    const hw: Homework = { ...createHomeworkInput(data, math.id, TUE, { estimatedMinutes: 45 }), id: 'hw', createdAt: ts, updatedAt: ts };
    data.homework = [hw];
    const result = planSchoolWork(data, at(TUE, '06:30'));
    const blocks = result.homework.hw ?? [];
    for (const b of blocks) {
      const guarded = buildDaySchedule(data, b.date).protectedSlots;
      const start = toMinutes(b.start);
      expect(guarded.some((p) => start < p.end && start + b.durationMin > p.start), `${b.date} ${b.start}`).toBe(false);
      expect(b.durationMin).toBeGreaterThanOrEqual(data.settings.school.minBlockMin);
    }
  });

  it('wandert am Wochenende mit dem späteren Aufstehen mit', () => {
    const data = makeData();
    data.settings.sleep.perWeekday = { 5: { wakeTime: '09:00', bedtime: '23:30' } };
    const sat = buildDaySchedule(data, '2026-10-03');
    expect(sat.protectedSlots.map((p) => `${toHHMM(p.start)}-${toHHMM(p.end)} ${p.name}`)).toEqual(['09:00-09:45 Morgenroutine']);
  });

  it('weitere geschützte Zeiten (z. B. Familienzeit) funktionieren genauso', () => {
    const data = makeData();
    data.settings.planning.protectedPeriods = [
      { id: 'fam', name: 'Familienzeit', enabled: true, weekdays: [1], from: { at: 'time', time: '15:00' }, until: { at: 'time', time: '19:30' } },
    ];
    expect(slotsText(data, TUE).every((s) => s.slice(6) <= '15:00' || s.slice(0, 5) >= '19:30')).toBe(true);
  });

  it('"Was soll ich jetzt machen?" schlägt während der Morgenroutine nichts für jetzt vor', () => {
    const data = makeData();
    data.tasks = [task('mathe', 'Mathe üben', 15)];
    const s = suggestNow(data, at(TUE, '07:05'));
    expect(s.fromMinute).toBeGreaterThanOrEqual(toMinutes('07:45'));
    expect(s.lines[0]).toContain('Morgenroutine');
  });
});

describe('Keine künstlichen Kurz-Einheiten', () => {
  it('Ziel-Einheiten sind mindestens eine halbe Sitzung lang', () => {
    const data = makeData();
    const goal: Goal = {
      id: 'g', title: 'Gitarre', color: '#f472b6', categoryId: 'cat_hobby', target: { type: 'weeklyMinutes', minutes: 140 }, sessionMin: 60,
      energy: 'low', active: true, log: [], createdAt: ts, updatedAt: ts,
    };
    data.goals = [goal];
    const items = planTasks(data, { dates: [WED, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'], now: at(WED, '06:00'), includeGoals: true }).items;
    const sessions = items.filter((i) => i.goalId === 'g').map((i) => i.end - i.start);
    expect(sessions.length).toBeGreaterThan(0);
    expect(Math.min(...sessions)).toBeGreaterThanOrEqual(30);
  });
});
