import { addDays, relativeDayLabel, startOfWeek, toDateKey } from '../../domain/time';
import type { DateKey, Todo, TodoHorizon, Weekday } from '../../domain/types';

/**
 * Reine Logik der To-do-Liste (ohne React/Store): Abschnitte, Sortierung, "wann"-Auswahl.
 * Abschnitte: HEUTE (inkl. Liegengebliebenem) · DIESE WOCHE · SPÄTER.
 */
export type TodoSection = 'today' | 'week' | 'later';

export const TODO_SECTION_LABEL: Record<TodoSection, string> = { today: 'Heute', week: 'Diese Woche', later: 'Später' };

export function todoSection(todo: Todo, today: DateKey, weekStartsOn: Weekday): TodoSection {
  const weekStart = startOfWeek(today, weekStartsOn);
  const weekEnd = addDays(weekStart, 6);
  if (todo.horizon === 'day' && todo.date) {
    if (todo.date <= today) return 'today'; // auch überfällige: bleiben sichtbar, bis sie erledigt sind
    return todo.date <= weekEnd ? 'week' : 'later';
  }
  // Wochen-To-dos vergangener Wochen wandern in die aktuelle Woche mit.
  if (todo.horizon === 'week' && todo.date) return todo.date <= weekStart ? 'week' : 'later';
  return 'later';
}

const completedDay = (t: Todo) => (t.completedAt ? toDateKey(new Date(t.completedAt)) : undefined);

function compareOpen(a: Todo, b: Todo): number {
  const ad = a.horizon === 'day' ? (a.date ?? '') : '9999-99-99';
  const bd = b.horizon === 'day' ? (b.date ?? '') : '9999-99-99';
  if (ad !== bd) return ad.localeCompare(bd);
  const at = a.time ?? '99:99';
  const bt = b.time ?? '99:99';
  if (at !== bt) return at.localeCompare(bt);
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt);
}

export interface TodoGroups {
  today: Todo[];
  week: Todo[];
  later: Todo[];
  /** Früher erledigte To-dos (bleiben gespeichert, werden nur gesammelt angezeigt). */
  done: Todo[];
}

/**
 * Offene To-dos nach Abschnitt. Heute Erledigtes bleibt durchgestrichen an seinem Platz,
 * älteres Erledigtes landet gesammelt unter "Erledigt". hideCompleted blendet beides aus.
 */
export function groupTodos(todos: Todo[], today: DateKey, weekStartsOn: Weekday, hideCompleted = false): TodoGroups {
  const groups: TodoGroups = { today: [], week: [], later: [], done: [] };
  for (const t of todos) {
    if (t.completed) {
      if (hideCompleted) continue;
      if (completedDay(t) === today) groups[todoSection(t, today, weekStartsOn)].push(t);
      else groups.done.push(t);
      continue;
    }
    groups[todoSection(t, today, weekStartsOn)].push(t);
  }
  const sortSection = (list: Todo[]) =>
    list.sort((a, b) => Number(a.completed) - Number(b.completed) || (a.completed ? (a.completedAt ?? '').localeCompare(b.completedAt ?? '') : compareOpen(a, b)));
  sortSection(groups.today);
  sortSection(groups.week);
  sortSection(groups.later);
  groups.done.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  return groups;
}

/** To-dos, die an einem Tag (z. B. auf der Heute-Seite) erscheinen. */
export function todosForDay(todos: Todo[], date: DateKey, today: DateKey, hideCompleted = false): Todo[] {
  return todos
    .filter((t) => {
      if (t.horizon !== 'day' || !t.date) return false;
      if (t.completed) return !hideCompleted && completedDay(t) === date;
      return date === today ? t.date <= today : t.date === date;
    })
    .sort((a, b) => Number(a.completed) - Number(b.completed) || compareOpen(a, b));
}

/** Auswahl "Wann?" beim Anlegen/Bearbeiten. */
export type TodoWhen = 'today' | 'tomorrow' | 'week' | 'later' | 'date';

export function whenToFields(when: TodoWhen, today: DateKey, weekStartsOn: Weekday, date?: DateKey): { horizon: TodoHorizon; date?: DateKey } {
  switch (when) {
    case 'today':
      return { horizon: 'day', date: today };
    case 'tomorrow':
      return { horizon: 'day', date: addDays(today, 1) };
    case 'week':
      return { horizon: 'week', date: startOfWeek(today, weekStartsOn) };
    case 'date':
      return date ? { horizon: 'day', date } : { horizon: 'day', date: today };
    default:
      return { horizon: 'later', date: undefined };
  }
}

export function fieldsToWhen(todo: Pick<Todo, 'horizon' | 'date'>, today: DateKey): TodoWhen {
  if (todo.horizon === 'week') return 'week';
  if (todo.horizon === 'later' || !todo.date) return 'later';
  if (todo.date === today) return 'today';
  if (todo.date === addDays(today, 1)) return 'tomorrow';
  return 'date';
}

/** Kurzer Hinweis zum Tag: "Morgen", "Do., 9. Okt." oder "seit Gestern" für Liegengebliebenes. */
export function todoDayHint(todo: Todo, today: DateKey): string | undefined {
  if (todo.horizon !== 'day' || !todo.date || todo.date === today) return undefined;
  const label = relativeDayLabel(todo.date, today);
  return todo.date < today && !todo.completed ? `seit ${label}` : label;
}

/** Tage, in denen "Planen" für ein To-do einen Zeitraum sucht. */
export function todoPlanDates(todo: Pick<Todo, 'horizon' | 'date'>, today: DateKey, weekStartsOn: Weekday, horizonDays = 14): DateKey[] {
  if (todo.horizon === 'day' && todo.date) return [todo.date < today ? today : todo.date];
  if (todo.horizon === 'week' && todo.date) {
    const weekEnd = addDays(todo.date < startOfWeek(today, weekStartsOn) ? startOfWeek(today, weekStartsOn) : todo.date, 6);
    const days: DateKey[] = [];
    for (let d = today; d <= weekEnd; d = addDays(d, 1)) days.push(d);
    return days;
  }
  return Array.from({ length: horizonDays }, (_, i) => addDays(today, i));
}

/** Deadline der Aufgabe, die "Planen" anlegt – damit die Planung (und das Entlasten) im Zeitraum bleibt. */
export function todoPlanDeadline(todo: Pick<Todo, 'horizon' | 'date'>, today: DateKey, weekStartsOn: Weekday): DateKey | undefined {
  const dates = todoPlanDates(todo, today, weekStartsOn);
  return todo.horizon === 'later' ? undefined : dates[dates.length - 1];
}
