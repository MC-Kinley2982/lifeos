import { beforeEach, describe, expect, it } from 'vitest';
import { createExampleData } from '../../domain/defaults';
import type { DateKey, Task, Todo } from '../../domain/types';
import { migrate, normalizeData } from '../../store/persistence';
import { planTodo, unplanTodo } from '../../store/todoPlanning';
import { useAppStore } from '../../store/useAppStore';
import { planTasks } from '../planner/autoPlan';
import { planningBudget } from '../planner/freeTime';
import { buildDaySchedule } from '../planner/schedule';
import type { PlannerData } from '../planner/types';
import { groupTodos, todosForDay, whenToFields } from './todos';

const MON: DateKey = '2026-10-05';
const TUE: DateKey = '2026-10-06';
const SAT: DateKey = '2026-10-10';
const ts = '2026-10-05T08:00:00.000Z';
const store = () => useAppStore.getState();

function todo(id: string, title: string, patch: Partial<Todo> = {}): Todo {
  return { id, title, completed: false, horizon: 'later', order: 1, createdAt: ts, updatedAt: ts, ...patch };
}

describe('To-do-Liste', () => {
  beforeEach(() => {
    store().resetAll();
    store().completeOnboarding({ name: '', withExample: true, today: TUE });
  });

  it('To-do erstellen und abhaken – erledigt bleibt gespeichert', () => {
    const id = store().addTodo({ title: 'Spiel für Papa und mich suchen', ...whenToFields('today', TUE, 0) });
    expect(store().todos.find((t) => t.id === id)).toMatchObject({ completed: false, horizon: 'day', date: TUE });

    store().toggleTodo(id);
    const done = store().todos.find((t) => t.id === id)!;
    expect(done.completed).toBe(true);
    expect(done.completedAt).toBeTruthy();
    expect(store().todos).toHaveLength(1); // nicht gelöscht

    store().toggleTodo(id);
    expect(store().todos.find((t) => t.id === id)).toMatchObject({ completed: false, completedAt: undefined });
  });

  it('ein normales To-do erzeugt keine Aufgabe, blockiert keine Zeit und wird nicht geplant', () => {
    const tasksBefore = store().tasks.length;
    store().addTodo({ title: 'Im Garten etwas machen', ...whenToFields('today', TUE, 0) });
    expect(store().tasks).toHaveLength(tasksBefore);
    const plan = planTasks(store() as PlannerData, { dates: [TUE, SAT], now: new Date(`${TUE}T06:00:00`), includeGoals: false });
    expect(plan.items.some((i) => i.title === 'Im Garten etwas machen')).toBe(false);
  });

  it('"Planen" übernimmt ein To-do optional in die Planung – Haken und Löschen laufen gemeinsam', () => {
    const id = store().addTodo({ title: 'Schulsachen packen', ...whenToFields('date', TUE, 0, SAT) });
    const outcome = planTodo(id, 30, new Date(`${TUE}T06:00:00`));
    expect(outcome.placed?.date).toBe(SAT);
    const linked = store().tasks.find((t) => t.todoId === id)!;
    expect(linked).toMatchObject({ estimatedMin: 30, schedule: { date: SAT, auto: true } });
    expect(store().todos.find((t) => t.id === id)?.taskId).toBe(linked.id);

    store().toggleTaskDone(linked.id);
    expect(store().todos.find((t) => t.id === id)?.completed).toBe(true);
    store().toggleTodo(id);
    expect(store().tasks.find((t) => t.id === linked.id)?.status).toBe('todo');

    unplanTodo(id);
    expect(store().tasks.some((t) => t.todoId === id)).toBe(false);
    expect(store().todos.find((t) => t.id === id)).toMatchObject({ title: 'Schulsachen packen', taskId: undefined });

    planTodo(id, 30, new Date(`${TUE}T06:00:00`));
    store().removeTodo(id);
    expect(store().tasks.some((t) => t.todoId === id)).toBe(false);
  });

  it('geplante To-dos kommen nach normalen Aufgaben dran (vor Zielen)', () => {
    const data = store() as PlannerData;
    const base = { estimatedMin: 60, categoryId: 'cat_other', energy: 'low' as const, status: 'todo' as const, createdAt: ts, updatedAt: ts };
    const normal: Task = { ...base, id: 'normal', title: 'Referat', priority: 'medium' };
    const fromTodo: Task = { ...base, id: 'fromTodo', title: 'Garten', priority: 'urgent', todoId: 'td' };
    // Samstag darf nur so knapp verplant werden, dass genau eine der beiden Stunden passt.
    const tight = { ...data, tasks: [fromTodo, normal], settings: { ...data.settings, planning: { ...data.settings.planning, maxPlannedShare: 0.15 } } };
    const budget = planningBudget(buildDaySchedule(tight, SAT), tight.settings.planning);
    expect(budget).toBeGreaterThanOrEqual(60);
    expect(budget).toBeLessThan(120);
    const plan = planTasks(tight, { dates: [SAT], now: new Date(`${TUE}T06:00:00`), includeGoals: false });
    expect(plan.items.map((i) => i.taskId)).toEqual(['normal']);
    expect(plan.unplanned.map((u) => u.taskId)).toEqual(['fromTodo']);
  });
});

describe('Abschnitte: Heute · Diese Woche · Später', () => {
  it('ordnet To-dos zu – Liegengebliebenes bleibt unter Heute', () => {
    const list = [
      todo('a', 'Heute', { horizon: 'day', date: TUE }),
      todo('b', 'Gestern liegengeblieben', { horizon: 'day', date: MON }),
      todo('c', 'Samstag', { horizon: 'day', date: SAT }),
      todo('d', 'Irgendwann diese Woche', { horizon: 'week', date: MON }),
      todo('e', 'Nächste Woche', { horizon: 'day', date: '2026-10-14' }),
      todo('f', 'Ohne Datum'),
    ];
    const g = groupTodos(list, TUE, 0);
    expect(g.today.map((t) => t.id)).toEqual(['b', 'a']);
    expect(g.week.map((t) => t.id).sort()).toEqual(['c', 'd']);
    expect(g.later.map((t) => t.id).sort()).toEqual(['e', 'f']);
  });

  it('heute Erledigtes bleibt durchgestrichen stehen, älteres wandert ins Archiv; ausblenden ist möglich', () => {
    const list = [
      todo('a', 'Heute erledigt', { horizon: 'day', date: TUE, completed: true, completedAt: `${TUE}T10:00:00` }),
      todo('b', 'Letzte Woche erledigt', { horizon: 'day', date: '2026-09-29', completed: true, completedAt: '2026-09-29T10:00:00' }),
    ];
    const g = groupTodos(list, TUE, 0);
    expect(g.today.map((t) => t.id)).toEqual(['a']);
    expect(g.done.map((t) => t.id)).toEqual(['b']);
    const hidden = groupTodos(list, TUE, 0, true);
    expect([...hidden.today, ...hidden.done]).toHaveLength(0);
    expect(todosForDay(list, TUE, TUE).map((t) => t.id)).toEqual(['a']);
  });
});

describe('Migration', () => {
  it('alte Daten (V3) laden weiter: To-dos leer, Morgenroutine geschützt, keine 15-Minuten-Schulblöcke mehr', () => {
    const ex = createExampleData(TUE, 'Josh');
    const old = JSON.parse(JSON.stringify({ ...ex, settings: { ...ex.settings, school: { ...ex.settings.school, minBlockMin: 15 } } }));
    delete old.settings.planning.protectedPeriods;
    delete old.settings.integrations;
    delete old.todos;
    const data = normalizeData(migrate(old, 3));
    expect(data.todos).toEqual([]);
    expect(data.routines).toEqual(ex.routines);
    expect(data.settings.planning.protectedPeriods.map((p) => p.name)).toEqual(['Morgenroutine']);
    expect(data.settings.school.minBlockMin).toBe(30);
    expect(data.settings.integrations.googleCalendar.push).toEqual({ events: false, homework: false, study: false, todos: false, routines: false });
  });
});
