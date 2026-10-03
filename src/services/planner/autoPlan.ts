import { formatDuration, formatHoursClock, toDateKey } from '../../domain/time';
import type { DateKey, EnergyState, Goal, Priority, Task, TaskEnergy, TimeOfDay } from '../../domain/types';
import { computeGoalProgress } from './goals';
import { activityToken, balanceScore, bestSlotInDay, buildPlanningDays, dayHasActivity, reserve, type Activity, type PlanningDay } from './placement';
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
  activity: Activity;
  score: number;
  reasons: string[];
}

interface Placement {
  day: PlanningDay;
  start: number;
  score: number;
  energy: EnergyState;
  reasons: string[];
}

/**
 * Regelbasierte Auto-Planung: verteilt offene Aufgaben (und optional Ziel-Einheiten)
 * auf freie Zeit. Schlägt nur vor – übernommen wird erst durch den Nutzer.
 *
 * - Tage mit viel freier Zeit (z. B. Wochenende) werden bevorzugt, volle Tage geschont.
 * - Die Mindest-Freizeit jedes Tages bleibt frei (Freizeit-Schutz).
 * - Jede Aktivität höchstens einmal pro Tag (z. B. kein zweites "Schach" am selben Tag).
 * - Bereits eingeplante Hausaufgaben und Lernzeiten haben Vorrang und zählen zum Budget.
 */
export function planTasks(data: PlannerData, options: PlanOptions): PlanResult {
  const today = toDateKey(options.now);
  const days = buildPlanningDays(data, options.dates, options.now);

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
    const result = placeUnit(data, days, unit, today, !!options.preferSoon);
    if ('reason' in result) {
      unplanned.push({ taskId: unit.task?.id, title: unit.title, reason: result.reason });
      continue;
    }
    items.push(commit(data, result, unit));
    if (unit.task?.goalId) placedGoalMinutes[unit.task.goalId] = (placedGoalMinutes[unit.task.goalId] ?? 0) + unit.duration;
  }

  // ── 2. Ziel-Einheiten ──────────────────────────────────────
  if (options.includeGoals) {
    const { planning } = data.settings;
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
          activity: { keys: [`goal:${goal.id}`], token: activityToken(goal.title) },
          score: 0,
          reasons: [`Ziel: noch ${formatHoursClock(remaining)} h diese Woche`],
        };
        const result = placeUnit(data, days, unit, today, !!options.preferSoon);
        if ('reason' in result) {
          unplanned.push({ goalId: goal.id, title: `${goal.title} (${formatDuration(remaining)} offen)`, reason: result.reason });
          break;
        }
        items.push(commit(data, result, unit));
        remaining -= duration;
        session += 1;
      }
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  return {
    items,
    unplanned,
    days: days.map((d) => ({ date: d.date, freeMin: d.freeMin, budgetMin: d.initialGeneralBudget, plannedMin: d.plannedMin })),
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
    activity: { keys: [`task:${task.id}`, ...(task.goalId ? [`goal:${task.goalId}`] : [])], token: activityToken(task.title) },
    score: urgency.points + prio.points + (fixedDate ? 25 : 0),
    reasons,
  };
}

function placeUnit(data: PlannerData, days: PlanningDay[], unit: Unit, today: DateKey, preferSoon: boolean): Placement | { reason: string } {
  const overdue = !!unit.deadline && unit.deadline < today;
  let best: Placement | null = null;
  let budgetBlocked = false;
  let noSlot = false;
  let afterDeadline = false;
  let alreadyPlanned = false;

  for (const day of days) {
    if (unit.fixedDate && day.date !== unit.fixedDate) continue;
    if (unit.deadline && !overdue && day.date > unit.deadline) {
      afterDeadline = true;
      continue;
    }
    if (dayHasActivity(day, unit.activity)) {
      alreadyPlanned = true;
      continue;
    }
    if (day.generalBudget < unit.duration) {
      budgetBlocked = true;
      continue;
    }
    const choice = bestSlotInDay(data, day, unit.duration, { energy: unit.energy, preferred: unit.preferred });
    if (!choice) {
      noSlot = true;
      continue;
    }
    // Tage mit viel freier Zeit bevorzugen; frühere Tage nur bei Deadlines oder beim Verschieben
    // (sonst nur als Gleichstand-Entscheid).
    const score = choice.score + balanceScore(day, unit.duration) - day.index * (unit.deadline || preferSoon ? 2 : 0.2);
    if (!best || score > best.score) best = { day, start: choice.start, score, energy: choice.energy, reasons: choice.reasons };
  }

  if (best) return best;
  if (budgetBlocked) return { reason: 'Freizeit-Schutz: An den passenden Tagen muss die restliche Zeit frei bleiben.' };
  if (noSlot) return { reason: `Keine freie Lücke ist lang genug (braucht ${formatDuration(unit.duration)}).` };
  if (alreadyPlanned) return { reason: 'Steht an allen passenden Tagen schon im Plan (höchstens einmal pro Tag).' };
  if (afterDeadline) return { reason: 'Vor der Deadline ist keine passende Zeit mehr frei.' };
  return { reason: 'Kein passender Zeitpunkt im Planungszeitraum gefunden.' };
}

function commit(data: PlannerData, p: Placement, unit: Unit): PlanItem {
  const { day, start } = p;
  reserve(day, start, unit.duration, data.settings.planning, unit.activity);
  return {
    id: `${unit.key}@${day.date}`,
    kind: unit.kind,
    taskId: unit.task?.id,
    goalId: unit.goal?.id ?? unit.task?.goalId,
    title: unit.title,
    date: day.date,
    start,
    end: start + unit.duration,
    energy: unit.energy,
    estimatedEnergy: p.energy.level,
    reasons: [...unit.reasons, ...p.reasons],
  };
}
