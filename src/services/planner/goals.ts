import { minutesSinceMidnight, toDateKey } from '../../domain/time';
import type { DateKey, ID } from '../../domain/types';
import { focusDayMap, focusMinutesFor } from '../focus/days';
import { buildDaySchedule } from './schedule';
import type { GoalProgress, PlannerData } from './types';

/**
 * Wochen-Fortschritt aller Ziele.
 *
 * Erledigt = erledigte Aufgaben (tatsächliche oder geschätzte Zeit) + manuelle Einträge
 *          + bereits vergangene Routinen/Termine, die dem Ziel zugeordnet sind
 *          + Rechnerzeit aus dem Focus Co-Pilot (`focusMatch` am Ziel).
 * Geplant  = eingeplante, offene Aufgaben + kommende Routinen/Termine des Ziels.
 *
 * Hat der Co-Pilot für einen Tag Daten und das Ziel einen `focusMatch`, gilt die echte Zeit:
 * Die bloße Annahme "die Routine hat stattgefunden" zählt dann an diesem Tag nicht zusätzlich.
 * Tage ohne Co-Pilot-Daten (Rechner aus) behalten die bisherige Annahme.
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
  const tracked: Record<ID, number> = {};
  const add = (map: Record<ID, number>, id: ID, min: number) => {
    map[id] = (map[id] ?? 0) + Math.max(0, min);
  };

  const focusByDate = focusDayMap(data.focusDays);
  const goalsById = new Map(data.goals.map((g) => [g.id, g]));
  /** Echte Rechnerzeit ersetzt an diesem Tag die Annahme, dass eine verknüpfte Routine/ein Termin stattfand. */
  const measured = (goalId: ID, date: DateKey) => focusByDate.has(date) && (goalsById.get(goalId)?.focusMatch?.length ?? 0) > 0;

  const hasLinkedRecurring = data.routines.some((r) => r.goalId) || data.events.some((e) => e.goalId);
  if (hasLinkedRecurring) {
    for (const date of weekDates) {
      const schedule = buildDaySchedule(data, date);
      for (const b of schedule.blocks) {
        if (!b.goalId || (b.kind !== 'routine' && b.kind !== 'event')) continue;
        const dur = b.end - b.start;
        const assumeDone = !measured(b.goalId, date);
        if (date < today || (date === today && b.end <= minute)) {
          if (assumeDone) add(done, b.goalId, dur);
        } else if (date === today && b.start < minute) {
          if (assumeDone) add(done, b.goalId, minute - b.start);
          add(planned, b.goalId, b.end - minute);
        } else add(planned, b.goalId, dur);
      }
    }
  }

  // Echte Rechnerzeit aus dem Focus Co-Pilot
  if (focusByDate.size > 0) {
    for (const goal of data.goals) {
      if (!goal.focusMatch?.length) continue;
      for (const date of weekDates) {
        const m = focusMinutesFor(goal, focusByDate.get(date));
        if (m > 0) {
          add(done, goal.id, m);
          add(tracked, goal.id, m);
        }
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
      ...(tracked[goal.id] ? { trackedMin: tracked[goal.id] } : {}),
    };
  }
  return result;
}
