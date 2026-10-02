import { intersectSlots, roundUpTo, toMinutes, totalMinutes } from '../../domain/time';
import type { DaySchedule, PlanningSettings, TimeOfDay, TimeSlot } from '../../domain/types';

/** Freie Lücken ab einem Zeitpunkt (z. B. "jetzt"). */
export function freeSlotsFrom(schedule: DaySchedule, fromMinute: number): TimeSlot[] {
  return schedule.freeSlots
    .map((s) => ({ start: Math.max(s.start, fromMinute), end: s.end }))
    .filter((s) => s.end > s.start);
}

export function freeMinutesFrom(schedule: DaySchedule, fromMinute: number): number {
  return totalMinutes(freeSlotsFrom(schedule, fromMinute));
}

/** Bereits fest eingeplante Aufgaben-Minuten ab einem Zeitpunkt. */
export function scheduledTaskMinutesFrom(schedule: DaySchedule, fromMinute: number): number {
  return schedule.blocks
    .filter((b) => b.kind === 'task' && b.end > fromMinute)
    .reduce((sum, b) => sum + (b.end - Math.max(b.start, fromMinute)), 0);
}

/**
 * Wie viel Zeit darf an einem Tag (noch) automatisch verplant werden?
 * Schützt Freizeit: höchstens `maxPlannedShare` der planbaren Zeit und mindestens
 * `minFreeTimeMin` bleiben frei. Bereits geplante Aufgaben zählen mit.
 */
export function planningBudget(schedule: DaySchedule, planning: PlanningSettings, fromMinute = 0): number {
  const free = freeMinutesFrom(schedule, fromMinute);
  const scheduled = scheduledTaskMinutesFrom(schedule, fromMinute);
  const plannable = free + scheduled;
  const share = Math.max(0, Math.min(1, planning.maxPlannedShare));
  const cap = Math.min(plannable * share, plannable - planning.minFreeTimeMin);
  return Math.max(0, Math.floor(cap - scheduled));
}

/** Freie Lücken, in denen automatisch geplant werden darf (Arbeitszeiten, Mindestlänge, Raster). */
export function plannableSlots(schedule: DaySchedule, planning: PlanningSettings, fromMinute = 0): TimeSlot[] {
  let slots = freeSlotsFrom(schedule, fromMinute);
  if (planning.useWorkWindows) {
    const windows = planning.workWindows
      .filter((w) => w.weekdays.includes(schedule.weekday))
      .map((w) => ({ start: toMinutes(w.start), end: toMinutes(w.end) }));
    slots = intersectSlots(slots, windows);
  }
  return slots
    .map((s) => ({ start: roundUpTo(s.start, planning.granularityMin), end: s.end }))
    .filter((s) => s.end - s.start >= planning.minSlotMin);
}

export function timeOfDayAt(minute: number, planning: PlanningSettings): TimeOfDay {
  if (minute >= toMinutes(planning.eveningStarts)) return 'evening';
  if (minute >= toMinutes(planning.afternoonStarts)) return 'afternoon';
  return 'morning';
}
