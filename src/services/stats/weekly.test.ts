import { beforeEach, describe, expect, it } from 'vitest';
import type { DateKey } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { isoWeek, weekHistory, weekStats, type StatsData } from './weekly';

const MON: DateKey = '2026-10-05';
const store = () => useAppStore.getState();
const at = (date: DateKey, time = '18:00') => `${date}T${time}:00`;

describe('Kalenderwoche', () => {
  it.each([
    ['2026-01-01', 1],
    ['2026-10-05', 41],
    ['2026-10-20', 43],
    ['2026-12-31', 53],
    ['2027-01-03', 53],
    ['2027-01-04', 1],
    ['2024-12-30', 1],
  ])('%s → KW %d', (date, week) => {
    expect(isoWeek(date)).toBe(week);
  });
});

describe('Wochenrückblick', () => {
  beforeEach(() => {
    store().resetAll();
    store().completeOnboarding({ name: '', withExample: true, today: MON });
  });

  function data(): StatsData {
    return store() as unknown as StatsData;
  }

  it('zählt Erledigtes der Woche – geplante To-dos nicht doppelt', () => {
    const s = store();
    const taskId = s.addTask({ title: 'Referat', estimatedMin: 60, actualMin: 75, priority: 'medium', categoryId: 'cat_other', energy: 'medium', status: 'todo' });
    const todoId = s.addTodo({ title: 'Garten', horizon: 'day', date: MON });
    const linked = s.addTask({ title: 'Garten', estimatedMin: 30, priority: 'medium', categoryId: 'cat_other', energy: 'low', status: 'todo', todoId });
    s.updateTodo(todoId, { taskId: linked });
    const sub = s.subjects[0].id;
    const hwId = s.addHomework({ subjectId: sub, title: 'S. 1', estimatedMinutes: 30, priority: 'medium', energy: 'medium', assignedDate: MON, deadline: { date: '2026-10-06', source: 'manual' }, status: 'todo', plannedBlocks: [] });
    // Erledigt am Mittwoch bzw. in der Vorwoche
    useAppStore.setState((st) => ({
      tasks: st.tasks.map((t) => (t.id === taskId || t.id === linked ? { ...t, status: 'done', completedAt: at('2026-10-07') } : t)),
      todos: st.todos.map((t) => (t.id === todoId ? { ...t, completed: true, completedAt: at('2026-10-07') } : t)),
      homework: st.homework.map((h) => (h.id === hwId ? { ...h, status: 'done', actualMinutes: 40, completedAt: at('2026-10-08') } : h)),
    }));
    s.addTodo({ title: 'Alt', horizon: 'day', date: '2026-09-28' });
    const stats = weekStats(data(), MON, new Date(at('2026-10-11')));
    expect(stats.tasks.map((t) => t.title)).toEqual(['Referat']);
    expect(stats.todos.map((t) => t.title)).toEqual(['Garten']);
    expect(stats.homework).toHaveLength(1);
    expect(stats.doneCount).toBe(3);
    expect(stats.focusMin).toBe(75 + 30 + 40);
    const prev = weekStats(data(), '2026-09-28', new Date(at('2026-10-11')));
    expect(prev.doneCount).toBe(0);
  });

  it('Zeit pro Tag: fest + geplant + frei = Wachzeit, Ziele mit Fortschritt', () => {
    const stats = weekStats(data(), MON, new Date(at(MON, '06:00')));
    expect(stats.days).toHaveLength(7);
    for (const d of stats.days) expect(d.fixedMin + d.workMin + d.freeMin).toBe(d.awakeMin);
    const monday = stats.days[0];
    expect(monday.fixedMin).toBeGreaterThan(5 * 60); // Schultag
    expect(stats.totals.freeMin).toBe(stats.days.reduce((s, d) => s + d.freeMin, 0));
    expect(stats.goals.length).toBe(store().goals.filter((g) => g.active).length);
    expect(stats.goalPercent).not.toBeNull();
  });

  it('Verlauf der letzten Wochen (älteste zuerst)', () => {
    const history = weekHistory(data(), MON, 4, new Date(at(MON)));
    expect(history.map((h) => [h.weekStart, h.week])).toEqual([
      ['2026-09-14', 38],
      ['2026-09-21', 39],
      ['2026-09-28', 40],
      ['2026-10-05', 41],
    ]);
  });
});
