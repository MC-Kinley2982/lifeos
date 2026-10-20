import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseHash } from '../../app/router';
import type { DateKey, Todo, TodoRepeat } from '../../domain/types';
import { migrate, normalizeData } from '../../store/persistence';
import { handleIncomingLink } from '../../store/incomingLinks';
import { useAppStore } from '../../store/useAppStore';
import { buildTodoLink, parseTodoLink } from './links';
import { nextOccurrence, occursOn, repeatLabel, rollRepeatingTodos, setTodoCompleted } from './repeat';

const MON: DateKey = '2026-10-05';
const WED: DateKey = '2026-10-07';
const SAT: DateKey = '2026-10-10';
const NEXT_MON: DateKey = '2026-10-12';
const ts = '2026-10-01T08:00:00.000Z';
const at = (date: DateKey, time = '09:00') => new Date(`${date}T${time}:00`);
const store = () => useAppStore.getState();

const weeklyMonday: TodoRepeat = { type: 'weekly', every: 1, anchor: MON, weekdays: [0] };

function todo(id: string, patch: Partial<Todo> = {}): Todo {
  return { id, title: 'Sporttasche packen', completed: false, horizon: 'day', date: MON, order: 1, createdAt: ts, updatedAt: ts, ...patch };
}

describe('Wiederholungsregeln', () => {
  it('wöchentlich, alle 2 Wochen, alle n Tage', () => {
    expect(nextOccurrence(weeklyMonday, MON)).toBe(NEXT_MON);
    expect(nextOccurrence(weeklyMonday, WED)).toBe(NEXT_MON);
    expect(nextOccurrence({ ...weeklyMonday, every: 2 }, MON)).toBe('2026-10-19');
    expect(nextOccurrence({ type: 'weekly', every: 1, anchor: MON, weekdays: [0, 3] }, MON)).toBe('2026-10-08');
    expect(nextOccurrence({ type: 'daily', every: 3, anchor: MON }, MON)).toBe('2026-10-08');
    expect(occursOn({ type: 'daily', every: 1, anchor: MON }, '2026-09-30')).toBe(true);
  });

  it('monatlich: der 31. wird in kürzeren Monaten zum letzten Tag', () => {
    const rule: TodoRepeat = { type: 'monthly', every: 1, anchor: '2026-10-31', day: 31 };
    expect(nextOccurrence(rule, '2026-10-31')).toBe('2026-11-30');
    expect(nextOccurrence(rule, '2026-11-30')).toBe('2026-12-31');
    expect(nextOccurrence({ ...rule, every: 3 }, '2026-10-31')).toBe('2027-01-31');
  });

  it('ohne Wochentage gibt es kein nächstes Vorkommen', () => {
    expect(nextOccurrence({ ...weeklyMonday, weekdays: [] }, MON)).toBeUndefined();
  });

  it('verständliche Beschriftung', () => {
    expect(repeatLabel(weeklyMonday)).toBe('Jeden Mo');
    expect(repeatLabel({ type: 'weekly', every: 1, anchor: MON, weekdays: [0, 1, 2, 3, 4] })).toBe('Wöchentlich: Mo–Fr');
    expect(repeatLabel({ ...weeklyMonday, every: 2, weekdays: [0, 3] })).toBe('Alle 2 Wochen: Mo, Do');
    expect(repeatLabel({ type: 'daily', every: 1, anchor: MON })).toBe('Täglich');
    expect(repeatLabel({ type: 'monthly', every: 1, anchor: MON, day: 15 })).toBe('Monatlich am 15.');
  });
});

describe('Abhaken wiederkehrender To-dos', () => {
  it('legt das nächste Vorkommen an – wieder öffnen nimmt es zurück', () => {
    const list = [todo('a', { repeat: weeklyMonday, note: 'Schienbeinschoner!', time: '07:00' })];
    const done = setTodoCompleted(list, 'a', true, at(MON));
    expect(done).toHaveLength(2);
    const [old, next] = done;
    expect(old).toMatchObject({ completed: true, repeat: undefined, repeatNextId: next.id });
    expect(next).toMatchObject({ completed: false, date: NEXT_MON, repeat: weeklyMonday, note: 'Schienbeinschoner!', time: '07:00' });

    const reopened = setTodoCompleted(done, 'a', false, at(MON, '10:00'));
    expect(reopened).toHaveLength(1);
    expect(reopened[0]).toMatchObject({ completed: false, repeat: weeklyMonday, repeatNextId: undefined });
  });

  it('früh erledigt → das darauffolgende Vorkommen; überfällig erledigt → das nächste ab heute', () => {
    const early = setTodoCompleted([todo('a', { date: NEXT_MON, repeat: weeklyMonday })], 'a', true, at(SAT));
    expect(early[1].date).toBe('2026-10-19');
    const late = setTodoCompleted([todo('a', { repeat: weeklyMonday })], 'a', true, at('2026-10-14'));
    expect(late[1].date).toBe('2026-10-19');
    const sameDay = setTodoCompleted([todo('a', { repeat: weeklyMonday })], 'a', true, at(NEXT_MON));
    expect(sameDay[1].date).toBe('2026-10-19');
  });

  it('wurde das nächste Vorkommen schon geändert, bleibt es beim Wieder-Öffnen erhalten', () => {
    const done = setTodoCompleted([todo('a', { repeat: weeklyMonday })], 'a', true, at(MON));
    const edited = done.map((t) => (t.id === done[0].repeatNextId ? { ...t, title: 'Sporttasche + Trinkflasche', updatedAt: '2026-10-06T10:00:00.000Z' } : t));
    const reopened = setTodoCompleted(edited, 'a', false, at(WED));
    expect(reopened).toHaveLength(2);
    expect(reopened.find((t) => t.id === 'a')?.repeat).toBeUndefined();
  });

  it('normale To-dos verhalten sich wie bisher', () => {
    const done = setTodoCompleted([todo('a')], 'a', true, at(MON));
    expect(done).toHaveLength(1);
    expect(done[0].completed).toBe(true);
  });

  it('Verpasstes rückt auf das letzte fällige Vorkommen auf, statt sich zu stapeln', () => {
    const list = [
      todo('daily', { repeat: { type: 'daily', every: 1, anchor: MON } }),
      todo('weekly', { repeat: weeklyMonday }),
      todo('plain'),
      todo('planned', { repeat: weeklyMonday, taskId: 'task_1' }),
    ];
    const rolled = rollRepeatingTodos(list, '2026-10-14', ts)!;
    expect(rolled.map((t) => t.date)).toEqual(['2026-10-14', NEXT_MON, MON, MON]);
    expect(rollRepeatingTodos(rolled, '2026-10-14', ts)).toBeNull();
  });
});

describe('Store', () => {
  beforeEach(() => {
    store().resetAll();
    store().completeOnboarding({ name: '', withExample: false, today: MON });
  });

  it('Abhaken im Store und über eine verknüpfte Aufgabe erzeugt das nächste Vorkommen', () => {
    const id = store().addTodo({ title: 'Vokabeln', horizon: 'day', date: toKeyToday(), repeat: { type: 'daily', every: 1, anchor: toKeyToday() } });
    store().toggleTodo(id);
    expect(store().todos.filter((t) => !t.completed)).toHaveLength(1);
    store().toggleTodo(id);
    expect(store().todos).toHaveLength(1);

    const taskId = store().addTask({ title: 'Vokabeln', estimatedMin: 15, priority: 'medium', categoryId: 'cat_other', energy: 'low', status: 'todo', todoId: id });
    store().updateTodo(id, { taskId });
    store().toggleTaskDone(taskId);
    expect(store().todos.filter((t) => !t.completed)).toHaveLength(1);
    expect(store().todos.find((t) => t.id === id)?.completed).toBe(true);
  });

  it('Migration V4 → V5 entfernt Wiederholungen ohne festen Tag', () => {
    const data = normalizeData(migrate({ todos: [todo('a', { horizon: 'later', date: undefined, repeat: weeklyMonday }), todo('b', { repeat: weeklyMonday })] }, 4));
    expect(data.todos.map((t) => !!t.repeat)).toEqual([false, true]);
  });
});

function toKeyToday(): DateKey {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('Kurzbefehle / Siri-Link', () => {
  it('liest Titel, Tag, Uhrzeit und Wichtigkeit', () => {
    const q = new URLSearchParams('add=Sporttasche%20packen&when=morgen&time=07:30&important=1');
    expect(parseTodoLink(q, MON, 0)).toEqual({
      explicitWhen: true,
      todos: [{ title: 'Sporttasche packen', horizon: 'day', date: '2026-10-06', time: '07:30', priority: 'high' }],
    });
    expect(parseTodoLink(new URLSearchParams('add=A%0AB&when=2026-10-24'), MON, 0)?.todos.map((t) => [t.title, t.date])).toEqual([
      ['A', '2026-10-24'],
      ['B', '2026-10-24'],
    ]);
    expect(parseTodoLink(new URLSearchParams('add=Irgendwas&when=later&time=25:99'), MON, 0)?.todos[0]).toEqual({ title: 'Irgendwas', horizon: 'later', date: undefined });
    expect(parseTodoLink(new URLSearchParams('add=%20%20'), MON, 0)).toBeNull();
    expect(parseTodoLink(new URLSearchParams('when=today'), MON, 0)).toBeNull();
  });

  it('Hash-Router liest Parameter nach dem "?"', () => {
    const link = buildTodoLink('https://example.org/lifeos/', 'Milch & Brot kaufen', 'today');
    expect(link).toBe('https://example.org/lifeos/#/todos?add=Milch%20%26%20Brot%20kaufen&when=today');
    const route = parseHash(link.slice(link.indexOf('#')));
    expect(route.name).toBe('todos');
    expect(route.query.get('add')).toBe('Milch & Brot kaufen');
    expect(parseHash('#/woche/2026-10-05')).toMatchObject({ name: 'week', params: ['2026-10-05'] });
  });

  describe('im Browser', () => {
    let hash = '';
    beforeEach(() => {
      store().resetAll();
      store().completeOnboarding({ name: '', withExample: false, today: MON });
      vi.stubGlobal('HashChangeEvent', class extends Event {});
      vi.stubGlobal('window', {
        location: {
          get hash() {
            return hash;
          },
        },
        history: { state: null, replaceState: (_s: unknown, _t: string, url: string) => (hash = url) },
        dispatchEvent: () => true,
        setTimeout,
      });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('legt das To-do genau einmal an und bereinigt die Adresse', () => {
      hash = '#/todos?add=Sporttasche%20packen&when=today';
      expect(handleIncomingLink(at(MON))).toBe(1);
      expect(hash).toBe('#/todos');
      expect(handleIncomingLink(at(MON))).toBe(0);
      expect(store().todos.map((t) => [t.title, t.date])).toEqual([['Sporttasche packen', MON]]);
    });
  });
});
