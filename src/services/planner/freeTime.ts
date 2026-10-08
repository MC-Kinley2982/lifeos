import { intersectSlots, roundUpTo, subtractSlots, toMinutes, totalMinutes } from '../../domain/time';
import type { DaySchedule, PlanningSettings, TimeOfDay, TimeSlot } from '../../domain/types';
import { WORK_KINDS } from './schedule';

/** Freie Lücken ab einem Zeitpunkt (z. B. "jetzt"). */
export function freeSlotsFrom(schedule: DaySchedule, fromMinute: number): TimeSlot[] {
  return schedule.freeSlots
    .map((s) => ({ start: Math.max(s.start, fromMinute), end: s.end }))
    .filter((s) => s.end > s.start);
}

export function freeMinutesFrom(schedule: DaySchedule, fromMinute: number): number {
  return totalMinutes(freeSlotsFrom(schedule, fromMinute));
}

/** Bereits fest eingeplante Arbeit (Aufgaben, Hausaufgaben, Lernzeit) ab einem Zeitpunkt. */
export function scheduledTaskMinutesFrom(schedule: DaySchedule, fromMinute: number): number {
  return schedule.blocks
    .filter((b) => WORK_KINDS.includes(b.kind) && b.end > fromMinute)
    .reduce((sum, b) => sum + (b.end - Math.max(b.start, fromMinute)), 0);
}

/**
 * Wie viel Zeit darf an einem Tag (noch) automatisch verplant werden?
 * Schützt Freizeit: höchstens `share` der planbaren Zeit (Standard: allgemeiner Planungsanteil)
 * und mindestens `minFreeTimeMin` bleiben frei. Bereits geplante Arbeit zählt mit.
 * Ein Tageszustand (z. B. Krank) kann den Anteil zusätzlich begrenzen.
 */
export function planningBudget(schedule: DaySchedule, planning: PlanningSettings, fromMinute = 0, share = planning.maxPlannedShare): number {
  const free = freeMinutesFrom(schedule, fromMinute);
  const scheduled = scheduledTaskMinutesFrom(schedule, fromMinute);
  const plannable = free + scheduled;
  const stateShare = schedule.dayState.definition.maxPlannedShare;
  const effective = Math.max(0, Math.min(1, stateShare !== undefined ? Math.min(share, stateShare) : share));
  // Mindest-Freizeit des Tages (Einstellung oder "Mehr Freizeit"-Wunsch) bleibt immer frei.
  const cap = Math.min(plannable * effective, plannable - (schedule.requiredFreeMin ?? planning.minFreeTimeMin));
  return Math.max(0, Math.floor(cap - scheduled));
}

/**
 * Freie Lücken, in denen automatisch geplant werden darf: ohne geschützte Zeiträume (z. B. Morgenroutine),
 * nur in Arbeitszeiten (falls aktiv), mit Mindestlänge und Raster. Gilt für alle Planer gleichermaßen.
 */
export function plannableSlots(schedule: DaySchedule, planning: PlanningSettings, fromMinute = 0): TimeSlot[] {
  let slots = subtractSlots(freeSlotsFrom(schedule, fromMinute), schedule.protectedSlots ?? []);
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
