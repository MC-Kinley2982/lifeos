import { describe, expect, it } from 'vitest';
import { createExampleData } from '../../domain/defaults';
import { toMinutes, weekDays } from '../../domain/time';
import type { DateKey, Goal, Routine, Task } from '../../domain/types';
import { planTasks } from './autoPlan';
import { freeMinutesFrom } from './freeTime';
import { rebalanceDays } from './rebalance';
import { buildDaySchedule } from './schedule';
import type { PlannerData, PlanItem } from './types';

const TUE: DateKey = '2026-09-29';
const SAT: DateKey = '2026-10-03';
const SUN: DateKey = '2026-10-04';
const at = (date: DateKey, time: string) => new Date(`${date}T${time}:00`);
const ts = '2026-09-01T00:00:00.000Z';

function makeData(): PlannerData {
  const ex = createExampleData(TUE, 'Test');
  return {
    settings: ex.settings,
    routines: ex.routines,
    events: ex.events,
    tasks: [],
    goals: ex.goals,
    dailyStates: {},
    vacations: [],
    specialDays: [],
    subjects: ex.subjects,
    timetable: ex.timetable,
    homework: [],
    exams: [],
  };
}

function goal(id: string, title: string, minutes: number, sessionMin: number): Goal {
  return { id, title, color: '#f472b6', categoryId: 'cat_hobby', target: { type: 'weeklyMinutes', minutes }, sessionMin, energy: 'medium', active: true, log: [], createdAt: ts, updatedAt: ts };
}

function autoTask(id: string, title: string, date: DateKey, start: string, minutes: number, goalId?: string): Task {
  return { id, title, estimatedMin: minutes, priority: 'medium', categoryId: 'cat_hobby', goalId, energy: 'medium', status: 'todo', schedule: { date, start, auto: true }, createdAt: ts, updatedAt: ts };
}

/** Planungsvorschlag übernehmen (wie "Übernehmen" in der App). */
function accept(data: PlannerData, items: PlanItem[]): PlannerData {
  const tasks = [...data.tasks];
  for (const i of items) {
    const schedule = { date: i.date, start: `${String(Math.floor(i.start / 60)).padStart(2, '0')}:${String(i.start % 60).padStart(2, '0')}`, auto: true };
    if (i.taskId) {
      const idx = tasks.findIndex((t) => t.id === i.taskId);
      tasks[idx] = { ...tasks[idx], schedule };
    } else tasks.push(autoTask(`g-${i.id}`, i.title, i.date, schedule.start, i.end - i.start, i.goalId));
  }
  return { ...data, tasks };
}

const weekFromTue = () => weekDays(TUE).filter((d) => d >= TUE);

describe('Verteilung nach freier Zeit', () => {
  it('Ziel-Einheiten landen bevorzugt an Tagen mit viel Freizeit – auch am Wochenende', () => {
    const data = makeData();
    const plan = planTasks(data, { dates: weekFromTue(), now: at(TUE, '07:00'), includeGoals: true });
    const dates = plan.items.filter((i) => i.kind === 'goal').map((i) => i.date);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.some((d) => d === SAT || d === SUN)).toBe(true);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('lässt an jedem Tag mindestens die eingestellte Freizeit frei', () => {
    const data = makeData();
    data.settings.planning.minFreeTimeMin = 180;
    data.goals = [goal('g1', 'Blender', 300, 60), goal('g2', 'Gitarre', 240, 45)];
    const now = at(TUE, '07:00');
    const planned = accept(data, planTasks(data, { dates: weekFromTue(), now, includeGoals: true }).items);
    for (const date of weekFromTue()) {
      const from = date === TUE ? toMinutes('07:00') : 0;
      const before = freeMinutesFrom(buildDaySchedule(data, date), from);
      const after = freeMinutesFrom(buildDaySchedule(planned, date), from);
      if (after < before) expect(after, date).toBeGreaterThanOrEqual(180);
    }
  });
});

describe('Jede Aktivität höchstens einmal pro Tag', () => {
  it('keine Schach-Einheit an einem Tag mit Schachtraining und kein zweites Mal am selben Tag', () => {
    const data = makeData();
    data.goals = [goal('chess', 'Schach', 150, 30)];
    const training: Routine = {
      id: 'chess-training', name: 'Schachtraining', categoryId: 'cat_hobby', color: '#fb923c', weekdays: [5], start: '15:00', end: '16:30',
      priority: 'medium', blocksFreeTime: true, enabled: true, travelBeforeMin: 0, travelAfterMin: 0, createdAt: ts, updatedAt: ts,
    };
    data.routines = [...data.routines, training];
    data.tasks = [autoTask('t1', 'Schach', SUN, '10:00', 30, 'chess')];
    const sessions = planTasks(data, { dates: weekFromTue(), now: at(TUE, '07:00'), includeGoals: true }).items.filter((i) => i.goalId === 'chess');
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.some((s) => s.date === SAT || s.date === SUN)).toBe(false);
    expect(new Set(sessions.map((s) => s.date)).size).toBe(sessions.length);
  });
});

describe('Entlasten (Freizeit-Schutz im Nachhinein)', () => {
  it('"Mehr Freizeit" verlegt Geplantes auf andere Tage', () => {
    const data = makeData();
    data.tasks = [autoTask('blender', 'Blender verbessern', SAT, '10:00', 60, data.goals[0].id)];
    const before = freeMinutesFrom(buildDaySchedule(data, SAT), 0);
    data.dailyStates[SAT] = { date: SAT, skippedSources: [], freeTarget: before + 60 };
    const result = rebalanceDays(data, at(TUE, '07:00'), { dates: [SAT], includeManual: true });
    expect(result.moved.map((m) => m.title)).toEqual(['Blender verbessern']);
    expect(result.tasks.blender.date).not.toBe(SAT);
    // … und zwar möglichst bald (noch diese Woche), nicht unnötig weit nach hinten
    expect(result.tasks.blender.date <= SUN).toBe(true);
    const after = { ...data, tasks: data.tasks.map((t) => ({ ...t, schedule: result.tasks[t.id] ?? t.schedule })) };
    expect(freeMinutesFrom(buildDaySchedule(after, SAT), 0)).toBeGreaterThanOrEqual(before + 60);
  });

  it('räumt doppelte Aktivitäten am selben Tag auf', () => {
    const data = makeData();
    const goalId = data.goals[0].id;
    data.tasks = [autoTask('a', 'Blender verbessern', SAT, '10:00', 60, goalId), autoTask('b', 'Blender verbessern', SAT, '18:30', 60, goalId)];
    const result = rebalanceDays(data, at(TUE, '07:00'));
    expect(result.moved).toHaveLength(1);
    expect(Object.values(result.tasks)[0].date).not.toBe(SAT);
  });

  it('sichert die Mindest-Freizeit, wenn ein Tag nachträglich voller wird', () => {
    const data = makeData();
    data.tasks = [autoTask('blender', 'Blender verbessern', SAT, '10:00', 60, data.goals[0].id)];
    const busy: Routine = {
      id: 'busy', name: 'Ausflug', categoryId: 'cat_leisure', color: '#2dd4bf', weekdays: [5], start: '11:00', end: '23:15',
      priority: 'high', blocksFreeTime: true, enabled: true, travelBeforeMin: 0, travelAfterMin: 0, createdAt: ts, updatedAt: ts,
    };
    data.routines = [...data.routines, busy];
    // Samstag: nur noch 09:00–09:30 und 23:15–23:30 frei → unter der Mindest-Freizeit von 1 h
    expect(freeMinutesFrom(buildDaySchedule(data, SAT), 0)).toBeLessThan(data.settings.planning.minFreeTimeMin);
    const result = rebalanceDays(data, at(TUE, '07:00'));
    expect(result.tasks.blender?.date).toBeDefined();
    expect(result.tasks.blender.date).not.toBe(SAT);
  });

  it('dünnt heute nichts aus, nur weil der Tag schon fortgeschritten ist', () => {
    const data = makeData();
    data.tasks = [autoTask('zimmer', 'Zimmer aufräumen', SAT, '22:00', 60)];
    // Ab 21:35 bleiben nur noch 55 min frei – über den ganzen Tag ist aber reichlich Freizeit.
    expect(freeMinutesFrom(buildDaySchedule(data, SAT), toMinutes('21:35'))).toBeLessThan(data.settings.planning.minFreeTimeMin);
    expect(rebalanceDays(data, at(SAT, '21:35')).moved).toHaveLength(0);
  });

  it('"Mehr Freizeit" für heute bleibt im Laufe des Tages stabil', () => {
    const data = makeData();
    data.tasks = [autoTask('blender', 'Blender verbessern', SAT, '17:00', 60, data.goals[0].id), autoTask('zimmer', 'Zimmer aufräumen', SAT, '21:00', 45)];
    // Wie makeFreeTime: Ziel für den ganzen Tag = jetzige freie Zeit + 1 h
    const target = freeMinutesFrom(buildDaySchedule(data, SAT), 0) + 60;
    data.dailyStates[SAT] = { date: SAT, skippedSources: [], freeTarget: target };
    const first = rebalanceDays(data, at(SAT, '12:00'), { dates: [SAT], includeManual: true });
    expect(first.moved.map((m) => m.title)).toEqual(['Blender verbessern']);
    const after = { ...data, tasks: data.tasks.map((t) => ({ ...t, schedule: first.tasks[t.id] ?? t.schedule })) };
    expect(freeMinutesFrom(buildDaySchedule(after, SAT), 0)).toBeGreaterThanOrEqual(target);
    // Später am Tag (automatische Pflege) wird nicht noch mehr verschoben.
    expect(rebalanceDays(after, at(SAT, '18:00')).moved).toHaveLength(0);
  });

  it('lässt manuell Geplantes ohne ausdrücklichen Wunsch in Ruhe', () => {
    const data = makeData();
    const manual = autoTask('m', 'Blender verbessern', SAT, '10:00', 60, data.goals[0].id);
    manual.schedule = { date: SAT, start: '10:00' };
    data.tasks = [manual, { ...manual, id: 'm2', schedule: { date: SAT, start: '18:30' } }];
    expect(rebalanceDays(data, at(TUE, '07:00')).moved).toHaveLength(0);
  });
});
