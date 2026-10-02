import { TIME_OF_DAY_LABEL } from '../../domain/labels';
import {
  formatDuration,
  formatHoursClock,
  minutesSinceMidnight,
  roundUpTo,
  subtractSlots,
  toDateKey,
} from '../../domain/time';
import type {
  DateKey,
  DaySchedule,
  EnergyState,
  Goal,
  PlanningSettings,
  Priority,
  Task,
  TaskEnergy,
  TimeOfDay,
  TimeSlot,
} from '../../domain/types';
import { estimateEnergy, requiredEnergy } from './energy';
import { freeMinutesFrom, planningBudget, plannableSlots, timeOfDayAt } from './freeTime';
import { computeGoalProgress } from './goals';
import { buildDaySchedule } from './schedule';
import { priorityScore, urgencyScore } from './scoring';
import type { PlanItem, PlannerData, PlanOptions, PlanResult, UnplannedItem } from './types';

interface Unit {
  key: string;
  kind: 'task' | 'goal';
  task?: Task;
  goal?: Goal;
  title: string;
  duration: number;
  energy: TaskEnergy;
  preferred?: TimeOfDay;
  deadline?: DateKey;
  /** Nur an diesem Tag planen (Aufgabe ist bereits einem Tag zugeordnet). */
  fixedDate?: DateKey;
  score: number;
  reasons: string[];
}

interface DayContext {
  date: DateKey;
  index: number;
  schedule: DaySchedule;
  slots: TimeSlot[];
  budget: number;
  initialBudget: number;
  freeMin: number;
  plannedMin: number;
  /** Alle Aufgaben-Blöcke des Tages (bestehende + neu geplante) – für Fokus-/Pausen-Regel. */
  focus: TimeSlot[];
  goalSessions: Set<string>;
}

interface Placement {
  day: DayContext;
  start: number;
  score: number;
  energy: EnergyState;
  reasons: string[];
}

/**
 * Regelbasierte Auto-Planung: verteilt offene Aufgaben (und optional Ziel-Einheiten)
 * auf freie Zeit. Schlägt nur vor – übernommen wird erst durch den Nutzer.
 */
export function planTasks(data: PlannerData, options: PlanOptions): PlanResult {
  const { planning } = data.settings;
  const today = toDateKey(options.now);
  const nowMin = minutesSinceMidnight(options.now);

  const days: DayContext[] = options.dates
    .filter((d) => d >= today)
    .map((date, index) => {
      const schedule = buildDaySchedule(data, date);
      const from = date === today ? roundUpTo(nowMin, planning.granularityMin) : 0;
      const budget = planningBudget(schedule, planning, from);
      return {
        date,
        index,
        schedule,
        slots: plannableSlots(schedule, planning, from),
        budget,
        initialBudget: budget,
        freeMin: freeMinutesFrom(schedule, from),
        plannedMin: 0,
        focus: schedule.blocks.filter((b) => b.kind === 'task').map((b) => ({ start: b.start, end: b.end })),
        goalSessions: new Set<string>(),
      };
    });

  const items: PlanItem[] = [];
  const unplanned: UnplannedItem[] = [];
  if (days.length === 0) return { items, unplanned, days: [] };
  const dateSet = new Set(days.map((d) => d.date));

  // ── 1. Aufgaben ────────────────────────────────────────────
  const taskUnits: Unit[] = [];
  for (const task of data.tasks) {
    if (task.status === 'done') continue;
    if (options.taskIds && !options.taskIds.includes(task.id)) continue;
    if (task.schedule?.start && task.schedule.date >= today) continue; // hat schon einen festen Platz
    const assigned = task.schedule && task.schedule.date >= today ? task.schedule.date : undefined;
    if (assigned && !dateSet.has(assigned)) continue; // gehört zu einem anderen Tag
    taskUnits.push(taskUnit(task, today, assigned));
  }
  taskUnits.sort((a, b) => b.score - a.score);

  const placedGoalMinutes: Record<string, number> = {};
  for (const unit of taskUnits) {
    const result = placeUnit(data, planning, days, unit, today);
    if ('reason' in result) {
      unplanned.push({ taskId: unit.task?.id, title: unit.title, reason: result.reason });
      continue;
    }
    items.push(commit(result, unit, planning));
    if (unit.task?.goalId) placedGoalMinutes[unit.task.goalId] = (placedGoalMinutes[unit.task.goalId] ?? 0) + unit.duration;
  }

  // ── 2. Ziel-Einheiten ──────────────────────────────────────
  if (options.includeGoals) {
    const progress = computeGoalProgress(data, days.map((d) => d.date), options.now);
    for (const goal of data.goals) {
      if (!goal.active || goal.target.type !== 'weeklyMinutes') continue;
      const p = progress[goal.id];
      let remaining = (p?.remainingMin ?? goal.target.minutes) - (placedGoalMinutes[goal.id] ?? 0);
      const sessionLen = goal.sessionMin > 0 ? goal.sessionMin : planning.defaultGoalSessionMin;
      let session = 1;
      while (remaining >= planning.minSlotMin && session <= days.length) {
        const duration = Math.min(sessionLen, remaining);
        const unit: Unit = {
          key: `goal:${goal.id}:${session}`,
          kind: 'goal',
          goal,
          title: goal.title,
          duration,
          energy: goal.energy,
          preferred: goal.preferredTimeOfDay,
          score: 0,
          reasons: [`Ziel: noch ${formatHoursClock(remaining)} h diese Woche`],
        };
        const result = placeUnit(data, planning, days, unit, today);
        if ('reason' in result) {
          unplanned.push({ goalId: goal.id, title: `${goal.title} (${formatDuration(remaining)} offen)`, reason: result.reason });
          break;
        }
        items.push(commit(result, unit, planning));
        remaining -= duration;
        session += 1;
      }
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  return {
    items,
    unplanned,
    days: days.map((d) => ({ date: d.date, freeMin: d.freeMin, budgetMin: d.initialBudget, plannedMin: d.plannedMin })),
  };
}

function taskUnit(task: Task, today: DateKey, fixedDate?: DateKey): Unit {
  const urgency = urgencyScore(task.deadline, today);
  const prio = priorityScore(task.priority as Priority);
  const reasons = [urgency.reason, prio.reason].filter((r): r is string => !!r);
  return {
    key: `task:${task.id}`,
    kind: 'task',
    task,
    title: task.title,
    duration: Math.max(5, task.estimatedMin),
    energy: task.energy,
    preferred: task.preferredTimeOfDay,
    deadline: task.deadline,
    fixedDate,
    score: urgency.points + prio.points + (fixedDate ? 25 : 0),
    reasons,
  };
}

function placeUnit(
  data: PlannerData,
  planning: PlanningSettings,
  days: DayContext[],
  unit: Unit,
  today: DateKey,
): Placement | { reason: string } {
  const need = requiredEnergy(data, unit.energy);
  const step = Math.max(planning.granularityMin, 15);
  const overdue = !!unit.deadline && unit.deadline < today;
  let best: Placement | null = null;
  let budgetBlocked = false;
  let noSlot = false;
  let afterDeadline = false;

  for (const day of days) {
    if (unit.fixedDate && day.date !== unit.fixedDate) continue;
    if (unit.deadline && !overdue && day.date > unit.deadline) {
      afterDeadline = true;
      continue;
    }
    if (unit.goal && day.goalSessions.has(unit.goal.id)) continue;
    if (day.budget < unit.duration) {
      budgetBlocked = true;
      continue;
    }

    for (const slot of day.slots) {
      if (slot.end - slot.start < unit.duration) {
        noSlot = true;
        continue;
      }
      for (let start = slot.start; start + unit.duration <= slot.end; start += step) {
        if (!focusAllows(day.focus, start, start + unit.duration, planning)) continue;
        const energy = estimateEnergy(data, day.schedule, start);
        const reasons: string[] = [];
        let score = 0;

        if (energy.level >= need) {
          score += 20;
          reasons.push(`Passt zu deiner Energie (${energy.level}/5)`);
        } else {
          score -= 25 * (need - energy.level);
          reasons.push(`Energie evtl. knapp (${energy.level}/5)`);
        }
        if (unit.preferred) {
          if (timeOfDayAt(start, planning) === unit.preferred) {
            score += 15;
            reasons.push(`Bevorzugt ${TIME_OF_DAY_LABEL[unit.preferred].toLowerCase()}`);
          } else score -= 10;
        }
        score -= day.index * (unit.deadline ? 6 : 3); // frühere Tage bevorzugen
        score -= (start - slot.start) / 60; // innerhalb einer Lücke lieber früh

        if (!best || score > best.score) best = { day, start, score, energy, reasons };
      }
    }
  }

  if (best) return best;
  if (budgetBlocked) return { reason: 'Freizeit-Schutz: Das Planungsbudget des Tages ist ausgeschöpft.' };
  if (noSlot) return { reason: `Keine freie Lücke ist lang genug (braucht ${formatDuration(unit.duration)}).` };
  if (afterDeadline) return { reason: 'Vor der Deadline ist keine passende Zeit mehr frei.' };
  return { reason: 'Kein passender Zeitpunkt im Planungszeitraum gefunden.' };
}

/** Max. Fokuszeit am Stück: Aufgaben mit kleinerem Abstand als der Pausenlänge gelten als zusammenhängend. */
function focusAllows(focus: TimeSlot[], start: number, end: number, planning: PlanningSettings): boolean {
  const gap = planning.breakAfterFocusMin;
  let chainStart = start;
  let chainEnd = end;
  let total = end - start;
  const used = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    focus.forEach((f, i) => {
      if (used.has(i)) return;
      if (f.end > chainStart - gap && f.start < chainEnd + gap) {
        used.add(i);
        total += f.end - f.start;
        chainStart = Math.min(chainStart, f.start);
        chainEnd = Math.max(chainEnd, f.end);
        changed = true;
      }
    });
  }
  return used.size === 0 || total <= planning.maxFocusMin;
}

function commit(p: Placement, unit: Unit, planning: PlanningSettings): PlanItem {
  const { day, start } = p;
  const end = start + unit.duration;
  const buffer = planning.bufferBetweenTasksMin;
  day.slots = subtractSlots(day.slots, [{ start: start - buffer, end: end + buffer }])
    .map((s) => ({ start: roundUpTo(s.start, planning.granularityMin), end: s.end }))
    .filter((s) => s.end - s.start >= planning.minSlotMin);
  day.budget -= unit.duration;
  day.plannedMin += unit.duration;
  day.focus.push({ start, end });
  if (unit.goal) day.goalSessions.add(unit.goal.id);

  return {
    id: `${unit.key}@${day.date}`,
    kind: unit.kind,
    taskId: unit.task?.id,
    goalId: unit.goal?.id ?? unit.task?.goalId,
    title: unit.title,
    date: day.date,
    start,
    end,
    energy: unit.energy,
    estimatedEnergy: p.energy.level,
    reasons: [...unit.reasons, ...p.reasons],
  };
}
