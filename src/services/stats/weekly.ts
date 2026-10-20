import { addDays, parseDateKey, toDateKey, weekDays } from '../../domain/time';
import type { DateKey, Goal, Grade, Homework, Task, Todo, Weekday } from '../../domain/types';
import { computeGoalProgress } from '../planner/goals';
import { buildDaySchedule, WORK_KINDS } from '../planner/schedule';
import type { GoalProgress, PlannerData } from '../planner/types';

/**
 * Wochenrückblick (reine Logik): Was wurde erledigt, wie liefen die Ziele,
 * wie verteilte sich die Wachzeit auf feste Zeiten, Geplantes und freie Zeit.
 * Hinweis: Tagespläne vergangener Wochen werden mit den heutigen Routinen/Einstellungen berechnet.
 */
export type StatsData = PlannerData & { todos: Todo[]; grades: Grade[] };

export interface DayStat {
  date: DateKey;
  /** Wachzeit des Tages. */
  awakeMin: number;
  /** Routinen, Schule, Termine, Mahlzeiten, Wege, Pausen. */
  fixedMin: number;
  /** Eingeplante Aufgaben, Hausaufgaben, Lernzeit. */
  workMin: number;
  freeMin: number;
}

export interface WeekStats {
  weekStart: DateKey;
  dates: DateKey[];
  /** Erledigte Aufgaben (ohne die aus To-dos – die zählen bei den To-dos). */
  tasks: Task[];
  todos: Todo[];
  homework: Homework[];
  studySessions: { count: number; minutes: number };
  /** Erledigte Einträge insgesamt (Aufgaben + To-dos + Hausaufgaben). */
  doneCount: number;
  /** Geschaffte Zeit: Aufgaben, Hausaufgaben (tatsächlich oder geschätzt), Lerneinheiten, Ziel-Einträge. */
  focusMin: number;
  goals: Array<{ goal: Goal; progress: GoalProgress }>;
  /** Durchschnittlicher Ziel-Fortschritt (0–100) der aktiven Ziele, null ohne Ziele. */
  goalPercent: number | null;
  days: DayStat[];
  totals: Omit<DayStat, 'date'>;
  grades: Grade[];
}

const dayOf = (iso?: string) => (iso ? toDateKey(new Date(iso)) : undefined);

/** Kalenderwoche nach ISO 8601. */
export function isoWeek(date: DateKey): number {
  const d = parseDateKey(date);
  // Donnerstag derselben Woche bestimmt das Jahr; Woche 1 enthält den 4. Januar.
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7), 12);
  const jan4 = new Date(thursday.getFullYear(), 0, 4, 12);
  const days = Math.round((thursday.getTime() - jan4.getTime()) / 86_400_000);
  return 1 + Math.round((days - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

function dayStat(data: PlannerData, date: DateKey): DayStat {
  const schedule = buildDaySchedule(data, date);
  const awakeMin = Math.max(0, schedule.awake.end - schedule.awake.start);
  const workMin = schedule.blocks.filter((b) => WORK_KINDS.includes(b.kind)).reduce((sum, b) => sum + Math.max(0, b.end - b.start), 0);
  const freeMin = schedule.totalFreeMin;
  return { date, awakeMin, workMin, freeMin, fixedMin: Math.max(0, awakeMin - freeMin - workMin) };
}

export function weekStats(data: StatsData, weekStart: DateKey, now: Date, opts: { days?: boolean } = {}): WeekStats {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const first = dates[0];
  const last = dates[6];
  const inWeek = (d?: DateKey) => !!d && d >= first && d <= last;

  const doneTasks = data.tasks.filter((t) => t.status === 'done' && inWeek(dayOf(t.completedAt)));
  const todos = data.todos.filter((t) => t.completed && inWeek(dayOf(t.completedAt)));
  const homework = data.homework.filter((h) => h.status === 'done' && inWeek(dayOf(h.completedAt)));
  const sessions = data.exams.flatMap((e) => e.studySessions).filter((s) => s.done && inWeek(s.date));
  const goalLogMin = data.goals.flatMap((g) => g.log).filter((l) => inWeek(l.date)).reduce((s, l) => s + l.minutes, 0);

  const focusMin =
    doneTasks.reduce((s, t) => s + (t.actualMin ?? t.estimatedMin), 0) +
    homework.reduce((s, h) => s + (h.actualMinutes ?? h.estimatedMinutes), 0) +
    sessions.reduce((s, b) => s + b.durationMin, 0) +
    goalLogMin;

  const tasks = doneTasks.filter((t) => !t.todoId);
  const progress = computeGoalProgress(data, dates, now);
  const goals = data.goals.filter((g) => g.active).map((goal) => ({ goal, progress: progress[goal.id] })).filter((g) => !!g.progress);
  const goalPercent = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress.percent, 0) / goals.length) : null;

  const days = opts.days === false ? [] : dates.map((d) => dayStat(data, d));
  const totals = days.reduce(
    (acc, d) => ({ awakeMin: acc.awakeMin + d.awakeMin, fixedMin: acc.fixedMin + d.fixedMin, workMin: acc.workMin + d.workMin, freeMin: acc.freeMin + d.freeMin }),
    { awakeMin: 0, fixedMin: 0, workMin: 0, freeMin: 0 },
  );

  return {
    weekStart,
    dates,
    tasks,
    todos,
    homework,
    studySessions: { count: sessions.length, minutes: sessions.reduce((s, b) => s + b.durationMin, 0) },
    doneCount: tasks.length + todos.length + homework.length,
    focusMin,
    goals,
    goalPercent,
    days,
    totals,
    grades: data.grades.filter((g) => inWeek(g.date)).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export interface WeekSummary {
  weekStart: DateKey;
  week: number;
  doneCount: number;
  focusMin: number;
  goalPercent: number | null;
}

/** Kurzüberblick der letzten `count` Wochen bis einschließlich `weekStart` (älteste zuerst). */
export function weekHistory(data: StatsData, weekStart: DateKey, count: number, now: Date): WeekSummary[] {
  return Array.from({ length: count }, (_, i) => addDays(weekStart, -7 * (count - 1 - i))).map((ws) => {
    const s = weekStats(data, ws, now, { days: false });
    return { weekStart: ws, week: isoWeek(ws), doneCount: s.doneCount, focusMin: s.focusMin, goalPercent: s.goalPercent };
  });
}

/** Wochenbeginn für ein beliebiges Datum (Einstellung "Woche beginnt am"). */
export function weekStartOf(date: DateKey, weekStartsOn: Weekday): DateKey {
  return weekDays(date, weekStartsOn)[0];
}
