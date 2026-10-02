import { minutesSinceMidnight, toDateKey } from '../../domain/time';
import type { DateKey, ID } from '../../domain/types';
import { buildDaySchedule } from './schedule';
import type { GoalProgress, PlannerData } from './types';

/**
 * Wochen-Fortschritt aller Ziele.
 *
 * Erledigt = erledigte Aufgaben (tatsächliche oder geschätzte Zeit) + manuelle Einträge
 *          + bereits vergangene Routinen/Termine, die dem Ziel zugeordnet sind.
 * Geplant  = eingeplante, offene Aufgaben + kommende Routinen/Termine des Ziels.
 */
export function computeGoalProgress(data: PlannerData, weekDates: DateKey[], now: Date): Record<ID, GoalProgress> {
  const result: Record<ID, GoalProgress> = {};
  if (data.goals.length === 0 || weekDates.length === 0) return result;

  const today = toDateKey(now);
  const minute = minutesSinceMidnight(now);
  const first = weekDates[0];
  const last = weekDates[weekDates.length - 1];
  const inWeek = (d?: DateKey) => !!d && d >= first && d <= last;

  const done: Record<ID, number> = {};
  const planned: Record<ID, number> = {};
  const add = (map: Record<ID, number>, id: ID, min: number) => {
    map[id] = (map[id] ?? 0) + Math.max(0, min);
  };

  const hasLinkedRecurring = data.routines.some((r) => r.goalId) || data.events.some((e) => e.goalId);
  if (hasLinkedRecurring) {
    for (const date of weekDates) {
      const schedule = buildDaySchedule(data, date);
      for (const b of schedule.blocks) {
        if (!b.goalId || (b.kind !== 'routine' && b.kind !== 'event')) continue;
        const dur = b.end - b.start;
        if (date < today || (date === today && b.end <= minute)) add(done, b.goalId, dur);
        else if (date === today && b.start < minute) {
          add(done, b.goalId, minute - b.start);
          add(planned, b.goalId, b.end - minute);
        } else add(planned, b.goalId, dur);
      }
    }
  }

  for (const task of data.tasks) {
    if (!task.goalId) continue;
    if (task.status === 'done') {
      const completedDate = task.completedAt ? toDateKey(new Date(task.completedAt)) : undefined;
      if (inWeek(completedDate)) add(done, task.goalId, task.actualMin ?? task.estimatedMin);
    } else if (task.schedule && inWeek(task.schedule.date) && task.schedule.date >= today) {
      add(planned, task.goalId, task.estimatedMin);
    }
  }

  for (const goal of data.goals) {
    for (const entry of goal.log) {
      if (inWeek(entry.date)) add(done, goal.id, entry.minutes);
    }
    const targetMin = goal.target.minutes;
    const d = done[goal.id] ?? 0;
    const p = planned[goal.id] ?? 0;
    result[goal.id] = {
      goalId: goal.id,
      targetMin,
      doneMin: d,
      plannedMin: p,
      remainingMin: Math.max(0, targetMin - d - p),
      percent: targetMin > 0 ? Math.min(100, Math.round((d / targetMin) * 100)) : 0,
    };
  }
  return result;
}
