import { addDays, minutesSinceMidnight, toDateKey, toHHMM } from '../../domain/time';
import type { DateKey, DaySchedule, ID, SchoolBlock, TaskSchedule } from '../../domain/types';
import { planSchoolWork } from '../school/schoolPlanner';
import { planTasks } from './autoPlan';
import { freeMinutesFrom } from './freeTime';
import { blockActivity, sameActivity, type Activity } from './placement';
import { buildDaySchedule, WORK_KINDS } from './schedule';
import type { PlannerData } from './types';

/**
 * Entlastet überlastete Tage:
 * - Mindest-Freizeit unterschritten (Einstellung oder "Mehr Freizeit"-Wunsch),
 * - mehr automatisch geplante Aufgaben, als der Planungsanteil erlaubt,
 * - dieselbe Aktivität zweimal an einem Tag.
 * Verschoben wird nur, was an einem anderen Tag sicher (vor seiner Deadline) Platz findet.
 */

export interface MovedItem {
  title: string;
  minutes: number;
  from: DateKey;
  to?: { date: DateKey; start: string };
}

export interface RebalanceResult {
  /** Neue Planung je Aufgabe. */
  tasks: Record<ID, TaskSchedule>;
  homework: Record<ID, SchoolBlock[]>;
  exams: Record<ID, SchoolBlock[]>;
  moved: MovedItem[];
  /** Was trotz Überlastung bleiben musste (z. B. wegen Deadline). */
  stuck: Array<{ title: string; date: DateKey; reason: string }>;
}

export interface RebalanceOptions {
  /** Nur diese Tage prüfen (Standard: heute + 13 Tage). */
  dates?: DateKey[];
  /** Auch manuell geplante Dinge verschieben (nur auf ausdrücklichen Wunsch, z. B. "Mehr Freizeit"). */
  includeManual?: boolean;
}

const HORIZON = 14;

interface Candidate {
  kind: 'task' | 'homework' | 'exam';
  id: ID;
  blockId?: ID;
  title: string;
  minutes: number;
  start: number;
  rank: number;
  duplicate: boolean;
  deadline: boolean;
}

export function rebalanceDays(data: PlannerData, now: Date, opts: RebalanceOptions = {}): RebalanceResult {
  const result: RebalanceResult = { tasks: {}, homework: {}, exams: {}, moved: [], stuck: [] };
  const today = toDateKey(now);
  const nowMin = minutesSinceMidnight(now);
  const horizon = Array.from({ length: HORIZON }, (_, i) => addDays(today, i));
  const dates = (opts.dates ?? horizon).filter((d) => d >= today);
  let working = data;

  for (const date of dates) {
    const from = date === today ? nowMin : 0;
    const others = horizon.filter((d) => d !== date);
    const tried = new Set<string>();

    for (let guard = 0; guard < 25; guard++) {
      const schedule = buildDaySchedule(working, date);
      const { freeDeficit, taskDeficit } = dayDeficits(working, schedule, from);
      const candidates = movable(working, schedule, from, !!opts.includeManual).filter((c) => !tried.has(`${c.kind}:${c.id}:${c.blockId ?? ''}`));
      const pick = candidates.find((c) => c.duplicate || freeDeficit > 0 || (taskDeficit > 0 && c.kind === 'task'));
      if (!pick) {
        if (freeDeficit > 0 && opts.includeManual) {
          for (const c of movable(working, schedule, from, true)) {
            result.stuck.push({ title: c.title, date, reason: c.deadline ? 'Vor der Deadline ist an keinem anderen Tag Platz' : 'Kein anderer Tag hat genug freie Zeit' });
          }
        }
        break;
      }
      tried.add(`${pick.kind}:${pick.id}:${pick.blockId ?? ''}`);
      const next = tryMove(working, pick, now, date, others);
      if (!next) continue;
      working = next.data;
      Object.assign(result.tasks, next.tasks);
      Object.assign(result.homework, next.homework);
      Object.assign(result.exams, next.exams);
      result.moved.push({ title: pick.title, minutes: pick.minutes, from: date, to: next.to });
    }
  }
  return result;
}

/**
 * Heute zählt der ganze Tag – schon vergangene Freizeit ist auch Freizeit. Sonst würde der Plan
 * im Laufe des Tages immer weiter ausgedünnt, nur weil die verbleibende Zeit schrumpft.
 * Planungsanteil: nur verschieben, wenn auch der Rest des Tages zu voll ist (so rechnet die Auto-Planung).
 */
function dayDeficits(data: PlannerData, schedule: DaySchedule, from: number): { freeDeficit: number; taskDeficit: number } {
  const day = deficits(data, schedule, 0);
  if (from === 0) return day;
  return { freeDeficit: day.freeDeficit, taskDeficit: Math.min(day.taskDeficit, deficits(data, schedule, from).taskDeficit) };
}

/** Wie viel muss weg? (Mindest-Freizeit und Planungsanteil für automatisch geplante Aufgaben) */
function deficits(data: PlannerData, schedule: DaySchedule, from: number): { freeDeficit: number; taskDeficit: number } {
  const free = freeMinutesFrom(schedule, from);
  const work = schedule.blocks.filter((b) => WORK_KINDS.includes(b.kind) && b.end > from);
  const workMin = work.reduce((s, b) => s + (b.end - Math.max(b.start, from)), 0);
  const autoTaskMin = work
    .filter((b) => b.kind === 'task' && data.tasks.find((t) => t.id === b.sourceId)?.schedule?.auto)
    .reduce((s, b) => s + (b.end - Math.max(b.start, from)), 0);
  const plannable = free + workMin;
  const stateShare = schedule.dayState.definition.maxPlannedShare;
  const share = stateShare !== undefined ? Math.min(stateShare, data.settings.planning.maxPlannedShare) : data.settings.planning.maxPlannedShare;
  const allowedAuto = Math.max(0, plannable * share - (workMin - autoTaskMin));
  return { freeDeficit: schedule.requiredFreeMin - free, taskDeficit: autoTaskMin - allowedAuto };
}

/** Verschiebbare Blöcke des Tages – Doppelungen zuerst, dann das am wenigsten Dringende. */
function movable(data: PlannerData, schedule: DaySchedule, from: number, includeManual: boolean): Candidate[] {
  const out: Candidate[] = [];
  const activities: Array<Activity | null> = schedule.blocks.map((b) => blockActivity(data, b));
  // Doppelt = dieselbe Aktivität steht schon als fester Termin (Routine/Termin) oder früher am Tag im Plan.
  const isDuplicate = (i: number) => {
    const a = activities[i];
    return !!a && activities.some((x, j) => j !== i && !!x && sameActivity(a, x) && (!WORK_KINDS.includes(schedule.blocks[j].kind) || j < i));
  };
  for (const [i, b] of schedule.blocks.entries()) {
    const duplicate = isDuplicate(i);
    if (!WORK_KINDS.includes(b.kind) || b.start < from || b.done || !b.sourceId) continue;

    if (b.kind === 'task') {
      const task = data.tasks.find((t) => t.id === b.sourceId);
      if (!task || task.status === 'done' || (!task.schedule?.auto && !includeManual)) continue;
      const rank = task.goalId && !task.deadline ? 0 : task.deadline ? 3 : 1;
      out.push({ kind: 'task', id: task.id, title: task.title, minutes: b.end - b.start, start: b.start, rank, duplicate, deadline: !!task.deadline });
    } else if (b.kind === 'homework') {
      const hw = data.homework.find((h) => h.id === b.sourceId);
      const block = hw?.plannedBlocks.find((x) => x.id === b.itemId);
      if (!hw || !block || (block.source === 'manual' && !includeManual)) continue;
      out.push({ kind: 'homework', id: hw.id, blockId: block.id, title: b.title, minutes: block.durationMin, start: b.start, rank: 4, duplicate, deadline: true });
    } else {
      const exam = data.exams.find((e) => e.id === b.sourceId);
      const block = exam?.studySessions.find((x) => x.id === b.itemId);
      if (!exam || !block || (block.source === 'manual' && !includeManual)) continue;
      out.push({ kind: 'exam', id: exam.id, blockId: block.id, title: b.title, minutes: block.durationMin, start: b.start, rank: 2, duplicate, deadline: true });
    }
  }
  return out.sort((a, b) => Number(b.duplicate) - Number(a.duplicate) || a.rank - b.rank || b.minutes - a.minutes);
}

interface MoveResult {
  data: PlannerData;
  tasks: Record<ID, TaskSchedule>;
  homework: Record<ID, SchoolBlock[]>;
  exams: Record<ID, SchoolBlock[]>;
  to?: { date: DateKey; start: string };
}

/** Block entfernen und woanders einplanen – nur übernehmen, wenn er vollständig Platz findet. */
function tryMove(data: PlannerData, c: Candidate, now: Date, date: DateKey, others: DateKey[]): MoveResult | null {
  if (c.kind === 'task') {
    const without = { ...data, tasks: data.tasks.map((t) => (t.id === c.id ? { ...t, schedule: undefined } : t)) };
    const item = planTasks(without, { dates: others, now, includeGoals: false, taskIds: [c.id], preferSoon: true }).items[0];
    if (!item) return null;
    const schedule: TaskSchedule = { date: item.date, start: toHHMM(item.start), auto: true };
    return {
      data: { ...data, tasks: data.tasks.map((t) => (t.id === c.id ? { ...t, schedule } : t)) },
      tasks: { [c.id]: schedule },
      homework: {},
      exams: {},
      to: { date: item.date, start: schedule.start! },
    };
  }

  const isHomework = c.kind === 'homework';
  const without: PlannerData = isHomework
    ? { ...data, homework: data.homework.map((h) => (h.id === c.id ? { ...h, plannedBlocks: h.plannedBlocks.filter((b) => b.id !== c.blockId) } : h)) }
    : { ...data, exams: data.exams.map((e) => (e.id === c.id ? { ...e, studySessions: e.studySessions.filter((b) => b.id !== c.blockId) } : e)) };
  const plan = planSchoolWork(without, now, isHomework ? { homeworkIds: [c.id], excludeDates: [date] } : { examIds: [c.id], excludeDates: [date] });
  const added = plan.added.filter((a) => a.id === c.id);
  if (added.reduce((s, a) => s + a.block.durationMin, 0) < c.minutes) return null;
  const blocks = (isHomework ? plan.homework : plan.exams)[c.id];
  if (!blocks) return null;
  const nextData: PlannerData = isHomework
    ? { ...without, homework: without.homework.map((h) => (h.id === c.id ? { ...h, plannedBlocks: blocks } : h)) }
    : { ...without, exams: without.exams.map((e) => (e.id === c.id ? { ...e, studySessions: blocks } : e)) };
  return {
    data: nextData,
    tasks: {},
    homework: isHomework ? { [c.id]: blocks } : {},
    exams: isHomework ? {} : { [c.id]: blocks },
    to: added[0] ? { date: added[0].block.date, start: added[0].block.start } : undefined,
  };
}
