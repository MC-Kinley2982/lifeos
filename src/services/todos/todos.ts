import type { TodoInput } from '../../domain/factories';
import { addDays, relativeDayLabel, startOfWeek, toDateKey } from '../../domain/time';
import type { DateKey, Todo, TodoHorizon, Weekday } from '../../domain/types';
import type { QuickParse } from '../nlp/quickAdd';

/**
 * Reine Logik der To-do-Liste (ohne React/Store): Abschnitte, Sortierung, "wann"-Auswahl.
 * Abschnitte: HEUTE (inkl. Liegengebliebenem) · DIESE WOCHE · SPÄTER.
 */
export type TodoSection = 'today' | 'week' | 'later';

export const TODO_SECTION_LABEL: Record<TodoSection, string> = { today: 'Heute', week: 'Diese Woche', later: 'Später' };

const SECTION_RANK: Record<TodoSection, number> = { today: 0, week: 1, later: 2 };

/**
 * Frist, die wirklich gilt: die frühere von `dueDate` und dem Ende eines Zeitraums.
 * (Der bloße Tag eines "Heute/Datum"-To-dos zählt hier nicht – das ist nur der geplante Tag.)
 */
export function todoDeadline(todo: Pick<Todo, 'dueDate' | 'endDate'>): DateKey | undefined {
  const { dueDate, endDate } = todo;
  return dueDate && endDate ? (dueDate < endDate ? dueDate : endDate) : (dueDate ?? endDate);
}

export function todoSection(todo: Todo, today: DateKey, weekStartsOn: Weekday): TodoSection {
  const weekStart = startOfWeek(today, weekStartsOn);
  const weekEnd = addDays(weekStart, 6);
  let section: TodoSection = 'later';
  if (todo.horizon === 'day' && todo.date) {
    if (todo.date <= today) section = 'today'; // auch überfällige: bleiben sichtbar, bis sie erledigt sind
    else section = todo.date <= weekEnd ? 'week' : 'later';
  } else if (todo.horizon === 'week' && todo.date) {
    // Wochen-To-dos vergangener Wochen wandern in die aktuelle Woche mit.
    section = todo.date <= weekStart ? 'week' : 'later';
  }
  // Eine Frist holt das To-do nach vorn: fällig heute (oder überfällig) → Heute, diese Woche → Diese Woche.
  const deadline = todoDeadline(todo);
  if (deadline) {
    const byDeadline: TodoSection = deadline <= today ? 'today' : deadline <= weekEnd ? 'week' : 'later';
    if (SECTION_RANK[byDeadline] < SECTION_RANK[section]) section = byDeadline;
  }
  return section;
}

const completedDay = (t: Todo) => (t.completedAt ? toDateKey(new Date(t.completedAt)) : undefined);

/** Wichtigkeit in drei Stufen; leer = mittel, "urgent" (Schnelleingabe "dringend") = hoch. */
export type TodoLevel = 'high' | 'medium' | 'low';

export const TODO_LEVEL_LABEL: Record<TodoLevel, string> = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' };
export const TODO_LEVELS: TodoLevel[] = ['high', 'medium', 'low'];

export function todoLevel(todo: Pick<Todo, 'priority'>): TodoLevel {
  if (todo.priority === 'high' || todo.priority === 'urgent') return 'high';
  return todo.priority === 'low' ? 'low' : 'medium';
}

const LEVEL_RANK: Record<TodoLevel, number> = { high: 0, medium: 1, low: 2 };

/** Sortierschlüssel "bis wann": Frist, sonst der geplante Tag; Wochen-To-dos zählen bis Wochenende; ohne Datum zuletzt. */
function sortDay(t: Todo): DateKey {
  const deadline = todoDeadline(t);
  const planned = t.horizon === 'day' ? t.date : t.horizon === 'week' && t.date ? addDays(t.date, 6) : undefined;
  if (deadline && planned) return deadline < planned ? deadline : planned;
  return deadline ?? planned ?? '9999-99-99';
}

function compareByTime(a: Todo, b: Todo): number {
  const at = a.time ?? '99:99';
  const bt = b.time ?? '99:99';
  if (at !== bt) return at.localeCompare(bt);
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt);
}

/** Nach Frist: früheste zuerst, bei gleichem Tag die wichtigeren, dann nach Uhrzeit. */
function compareOpen(a: Todo, b: Todo): number {
  const ad = sortDay(a);
  const bd = sortDay(b);
  if (ad !== bd) return ad.localeCompare(bd);
  return LEVEL_RANK[todoLevel(a)] - LEVEL_RANK[todoLevel(b)] || compareByTime(a, b);
}

/** Nach Wichtigkeit: hohe zuerst, bei gleicher Stufe die mit der früheren Frist. */
function compareByLevel(a: Todo, b: Todo): number {
  const l = LEVEL_RANK[todoLevel(a)] - LEVEL_RANK[todoLevel(b)];
  if (l) return l;
  const ad = sortDay(a);
  const bd = sortDay(b);
  return ad !== bd ? ad.localeCompare(bd) : compareByTime(a, b);
}

export interface TodoGroups {
  today: Todo[];
  week: Todo[];
  later: Todo[];
  /** Früher erledigte To-dos (bleiben gespeichert, werden nur gesammelt angezeigt). */
  done: Todo[];
}

/** Erledigte ans Ende, in der Reihenfolge ihres Erledigens; offene nach `compare`. */
function byCompletionThen(compare: (a: Todo, b: Todo) => number) {
  return (a: Todo, b: Todo) => Number(a.completed) - Number(b.completed) || (a.completed ? (a.completedAt ?? '').localeCompare(b.completedAt ?? '') : compare(a, b));
}

/**
 * Offene To-dos nach Abschnitt (Heute · Diese Woche · Später), innerhalb nach Frist.
 * Heute Erledigtes bleibt durchgestrichen an seinem Platz, älteres Erledigtes landet gesammelt
 * unter "Erledigt". hideCompleted blendet beides aus.
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
  const sort = byCompletionThen(compareOpen);
  groups.today.sort(sort);
  groups.week.sort(sort);
  groups.later.sort(sort);
  groups.done.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  return groups;
}

export interface TodoPriorityGroups {
  /** Heute fällig oder überfällig – steht immer ganz oben, egal wie wichtig. */
  dueToday: Todo[];
  high: Todo[];
  medium: Todo[];
  low: Todo[];
  done: Todo[];
}

/**
 * Nach Wichtigkeit: erst alles, was heute fällig ist (nach Wichtigkeit), dann hoch · mittel · niedrig –
 * jeweils mit der frühesten Frist zuerst.
 */
export function groupTodosByPriority(todos: Todo[], today: DateKey, weekStartsOn: Weekday, hideCompleted = false): TodoPriorityGroups {
  const groups: TodoPriorityGroups = { dueToday: [], high: [], medium: [], low: [], done: [] };
  for (const t of todos) {
    if (t.completed && (hideCompleted || completedDay(t) !== today)) {
      if (!hideCompleted) groups.done.push(t);
      continue;
    }
    if (todoSection(t, today, weekStartsOn) === 'today') groups.dueToday.push(t);
    else groups[todoLevel(t)].push(t);
  }
  const sort = byCompletionThen(compareByLevel);
  groups.dueToday.sort(sort);
  groups.high.sort(sort);
  groups.medium.sort(sort);
  groups.low.sort(sort);
  groups.done.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  return groups;
}

/** To-dos, die an einem Tag (z. B. auf der Heute-Seite) erscheinen. */
export function todosForDay(todos: Todo[], date: DateKey, today: DateKey, hideCompleted = false): Todo[] {
  return todos
    .filter((t) => {
      const start = t.horizon === 'day' ? t.date : undefined;
      const deadline = todoDeadline(t);
      if (!start && !deadline) return false;
      if (t.completed) return !hideCompleted && completedDay(t) === date;
      if (date === today) return (!!start && start <= today) || (!!deadline && deadline <= today);
      const inRange = !!start && !!t.endDate && date >= start && date <= t.endDate;
      return start === date || inRange || deadline === date;
    })
    .sort((a, b) => Number(a.completed) - Number(b.completed) || compareOpen(a, b));
}

/** Auswahl "Wann?" beim Anlegen/Bearbeiten. */
export type TodoWhen = 'today' | 'tomorrow' | 'week' | 'later' | 'date' | 'range';

/**
 * Felder zu einer "Wann?"-Auswahl. `endDate` ist immer gesetzt (auch leer), damit ein Wechsel
 * weg von "Zeitraum" das Ende zuverlässig entfernt.
 */
export function whenToFields(
  when: TodoWhen,
  today: DateKey,
  weekStartsOn: Weekday,
  date?: DateKey,
  endDate?: DateKey,
): { horizon: TodoHorizon; date?: DateKey; endDate?: DateKey } {
  switch (when) {
    case 'today':
      return { horizon: 'day', date: today, endDate: undefined };
    case 'tomorrow':
      return { horizon: 'day', date: addDays(today, 1), endDate: undefined };
    case 'week':
      return { horizon: 'week', date: startOfWeek(today, weekStartsOn), endDate: undefined };
    case 'date':
      return { horizon: 'day', date: date ?? today, endDate: undefined };
    case 'range': {
      const start = date ?? today;
      return { horizon: 'day', date: start, endDate: endDate && endDate >= start ? endDate : addDays(start, 2) };
    }
    default:
      return { horizon: 'later', date: undefined, endDate: undefined };
  }
}

export function fieldsToWhen(todo: Pick<Todo, 'horizon' | 'date' | 'endDate'>, today: DateKey): TodoWhen {
  if (todo.horizon === 'week') return 'week';
  if (todo.horizon === 'later' || !todo.date) return 'later';
  if (todo.endDate) return 'range';
  if (todo.date === today) return 'today';
  if (todo.date === addDays(today, 1)) return 'tomorrow';
  return 'date';
}

/** Zusätzlicher Hinweis zur Frist: "Frist Fr., 7. Nov." – bei Überfälligem "Frist überschritten (Gestern)". */
export function todoDeadlineHint(todo: Todo, today: DateKey): { text: string; overdue: boolean } | undefined {
  const deadline = todoDeadline(todo);
  if (!deadline) return undefined;
  const overdue = !todo.completed && deadline < today;
  const label = relativeDayLabel(deadline, today);
  if (todo.endDate && todo.date && todo.endDate === deadline) {
    // Zeitraum: läuft er schon, zählt nur das Ende; sonst von – bis.
    const text = todo.date <= today ? `bis ${label}` : `${relativeDayLabel(todo.date, today)} – ${label}`;
    return { text: overdue ? `Zeitraum überschritten (${label})` : text, overdue };
  }
  return { text: overdue ? `Frist überschritten (${label})` : `Frist ${label}`, overdue };
}

/** Kurzer Hinweis zum Tag: "Morgen", "Do., 9. Okt." oder "seit Gestern" für Liegengebliebenes. */
export function todoDayHint(todo: Todo, today: DateKey): string | undefined {
  // Bei einem Zeitraum steht der Tag im Fristhinweis (todoDeadlineHint).
  if (todo.horizon !== 'day' || !todo.date || todo.date === today || todo.endDate) return undefined;
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

/**
 * Ergebnis der Texterkennung auf ein neues To-do anwenden ("morgen 17 Uhr 45 min Mathe lernen").
 * Erkanntes hat Vorrang vor der Auswahl "Wann?"; ohne Erkennung bleibt `base` unverändert.
 */
export function applyQuickParse(base: TodoInput, parse: QuickParse | null): TodoInput {
  if (!parse || parse.chips.length === 0) return base;
  const out: TodoInput = { ...base, title: parse.title };
  // Ein erkannter Tag ersetzt die Auswahl "Wann?" – ein vorher gewählter Zeitraum fällt dann weg.
  if (parse.horizon === 'day' && parse.date) {
    Object.assign(out, { horizon: 'day', date: parse.date, endDate: undefined, dueDate: undefined });
  } else if (parse.horizon === 'week' && parse.date) {
    Object.assign(out, { horizon: 'week', date: parse.date, time: undefined, endDate: undefined });
  } else if (parse.horizon === 'later') {
    Object.assign(out, { horizon: 'later', date: undefined, time: undefined, endDate: undefined });  }
  if (parse.time && out.horizon === 'day') out.time = parse.time;
  if (parse.durationMin) out.estimatedMin = parse.durationMin;
  if (parse.priority) out.priority = parse.priority;
  // Eine Wiederholung braucht einen einzelnen Tag – Frist/Zeitraum fallen dann weg.
  if (parse.repeat && out.horizon === 'day') Object.assign(out, { repeat: parse.repeat, dueDate: undefined, endDate: undefined });
  return out;
}
