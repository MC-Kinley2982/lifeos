import { createId } from '../../domain/ids';
import { addDays, diffDays, getWeekday, parseDateKey, startOfWeek, toDateKey, WEEKDAY_SHORT } from '../../domain/time';
import type { DateKey, Todo, TodoRepeat, Weekday } from '../../domain/types';

/**
 * Wiederkehrende To-dos (reine Logik).
 * Prinzip wie bei bekannten To-do-Apps: Es gibt immer nur EIN offenes Vorkommen.
 * Beim Abhaken entsteht das nächste; Verpasstes rückt auf das letzte fällige Vorkommen auf,
 * statt sich zu stapeln.
 */

export type RepeatType = TodoRepeat['type'];

/** Längste Suche nach dem nächsten Vorkommen (Schutz vor ungültigen Regeln). */
const MAX_SEARCH_DAYS = 5 * 366;

function daysInMonth(key: DateKey): number {
  const d = parseDateKey(key);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function monthIndex(key: DateKey): number {
  const d = parseDateKey(key);
  return d.getFullYear() * 12 + d.getMonth();
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Neue Regel mit sinnvollen Startwerten für einen Tag. */
export function defaultRepeat(type: RepeatType, date: DateKey): TodoRepeat {
  switch (type) {
    case 'daily':
      return { type, every: 1, anchor: date };
    case 'weekly':
      return { type, every: 1, anchor: date, weekdays: [getWeekday(date)] };
    case 'monthly':
      return { type, every: 1, anchor: date, day: parseDateKey(date).getDate() };
  }
}

/** Ist `date` ein Vorkommen der Regel? */
export function occursOn(rule: TodoRepeat, date: DateKey): boolean {
  const every = Math.max(1, Math.round(rule.every || 1));
  switch (rule.type) {
    case 'daily':
      return mod(diffDays(rule.anchor, date), every) === 0;
    case 'weekly': {
      if (!rule.weekdays.includes(getWeekday(date))) return false;
      const weeks = Math.round(diffDays(startOfWeek(rule.anchor), startOfWeek(date)) / 7);
      return mod(weeks, every) === 0;
    }
    case 'monthly': {
      const day = Math.min(Math.max(1, rule.day), daysInMonth(date));
      return parseDateKey(date).getDate() === day && mod(monthIndex(date) - monthIndex(rule.anchor), every) === 0;
    }
  }
}

/** Erstes Vorkommen strikt nach `after`. */
export function nextOccurrence(rule: TodoRepeat, after: DateKey): DateKey | undefined {
  if (rule.type === 'weekly' && rule.weekdays.length === 0) return undefined;
  for (let i = 1, d = addDays(after, 1); i <= MAX_SEARCH_DAYS; i++, d = addDays(d, 1)) {
    if (occursOn(rule, d)) return d;
  }
  return undefined;
}

/** Erstes Vorkommen ab `from` (einschließlich). */
export function firstOccurrenceFrom(rule: TodoRepeat, from: DateKey): DateKey | undefined {
  return occursOn(rule, from) ? from : nextOccurrence(rule, from);
}

/** Letztes Vorkommen im Bereich (after, until]. */
export function lastOccurrenceIn(rule: TodoRepeat, after: DateKey, until: DateKey): DateKey | undefined {
  for (let d = until; d > after; d = addDays(d, -1)) {
    if (occursOn(rule, d)) return d;
    if (diffDays(d, until) > MAX_SEARCH_DAYS) break;
  }
  return undefined;
}

function weekdayList(days: Weekday[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'jeden Tag';
  if (sorted.join() === '0,1,2,3,4') return 'Mo–Fr';
  if (sorted.join() === '5,6') return 'Sa + So';
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

/** "Täglich", "Alle 2 Tage", "Jeden Mo", "Alle 2 Wochen: Mo, Do", "Monatlich am 15." */
export function repeatLabel(rule: TodoRepeat): string {
  const every = Math.max(1, Math.round(rule.every || 1));
  switch (rule.type) {
    case 'daily':
      return every === 1 ? 'Täglich' : `Alle ${every} Tage`;
    case 'weekly': {
      const days = weekdayList(rule.weekdays);
      if (every === 1) return rule.weekdays.length === 1 ? `Jeden ${days}` : `Wöchentlich: ${days}`;
      return `Alle ${every} Wochen: ${days}`;
    }
    case 'monthly':
      return every === 1 ? `Monatlich am ${rule.day}.` : `Alle ${every} Monate am ${rule.day}.`;
  }
}

/** Neues offenes Vorkommen eines wiederkehrenden To-dos (ohne Planung, ohne Google-Termin). */
function nextInstance(todo: Todo, date: DateKey, order: number, ts: string): Todo {
  return {
    id: createId('todo'),
    title: todo.title,
    completed: false,
    horizon: 'day',
    date,
    time: todo.time,
    priority: todo.priority,
    note: todo.note,
    reminder: todo.reminder,
    googleCalendarSync: todo.googleCalendarSync,
    repeat: todo.repeat,
    order,
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * Abhaken bzw. wieder öffnen – inkl. Wiederholung:
 * - Abhaken eines wiederkehrenden To-dos legt das nächste Vorkommen an (nach dem geplanten Tag
 *   und nach heute – wer früh erledigt, bekommt das darauffolgende Vorkommen).
 * - Wieder öffnen nimmt dieses nächste Vorkommen zurück, solange es unverändert ist.
 */
export function setTodoCompleted(todos: Todo[], id: string, completed: boolean, now: Date): Todo[] {
  const todo = todos.find((t) => t.id === id);
  if (!todo || todo.completed === completed) return todos;
  const ts = now.toISOString();
  const today = toDateKey(now);

  if (completed) {
    const after = todo.date && todo.date > today ? todo.date : today;
    const nextDate = todo.repeat && todo.horizon === 'day' && todo.date ? nextOccurrence(todo.repeat, after) : undefined;
    const done: Todo = { ...todo, completed: true, completedAt: ts, updatedAt: ts };
    if (!nextDate) return todos.map((t) => (t.id === id ? done : t));
    const order = todos.reduce((max, t) => Math.max(max, t.order), 0) + 1;
    const next = nextInstance(todo, nextDate, order, ts);
    return [...todos.map((t) => (t.id === id ? { ...done, repeat: undefined, repeatNextId: next.id } : t)), next];
  }

  const next = todo.repeatNextId ? todos.find((t) => t.id === todo.repeatNextId) : undefined;
  const untouched = !!next && !next.completed && next.updatedAt === next.createdAt && !next.taskId;
  const reopened: Todo = {
    ...todo,
    completed: false,
    completedAt: undefined,
    updatedAt: ts,
    repeatNextId: undefined,
    ...(untouched ? { repeat: next!.repeat } : {}),
  };
  return todos.filter((t) => !(untouched && t.id === next!.id)).map((t) => (t.id === id ? reopened : t));
}

/**
 * Verpasste Vorkommen rücken auf: Ein offenes, wiederkehrendes To-do, dessen Tag schon vorbei ist,
 * springt auf das letzte fällige Vorkommen bis heute (statt wochenlang "überfällig" zu sein).
 * Geplante To-dos (mit Aufgabe) bleiben unverändert. Gibt null zurück, wenn sich nichts ändert.
 */
export function rollRepeatingTodos(todos: Todo[], today: DateKey, ts: string): Todo[] | null {
  let changed = false;
  const next = todos.map((t) => {
    if (t.completed || !t.repeat || t.taskId || t.horizon !== 'day' || !t.date || t.date >= today) return t;
    const latest = lastOccurrenceIn(t.repeat, t.date, today);
    if (!latest || latest === t.date) return t;
    changed = true;
    return { ...t, date: latest, updatedAt: ts };
  });
  return changed ? next : null;
}
