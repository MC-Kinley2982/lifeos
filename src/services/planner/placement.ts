import { TIME_OF_DAY_LABEL } from '../../domain/labels';
import { minutesSinceMidnight, roundUpTo, subtractSlots, toDateKey } from '../../domain/time';
import type { DateKey, DaySchedule, EnergyState, PlanningSettings, TaskEnergy, TimeOfDay, TimeSlot } from '../../domain/types';
import { estimateEnergy, requiredEnergy } from './energy';
import { freeMinutesFrom, planningBudget, plannableSlots, timeOfDayAt } from './freeTime';
import { buildDaySchedule, WORK_KINDS } from './schedule';
import type { PlannerData } from './types';

/**
 * Gemeinsame Bausteine für alle regelbasierten Planer (Aufgaben, Ziele, Hausaufgaben, Lernzeit):
 * freie Zeit eines Tages, Planungsbudgets (Freizeit-Schutz), Fokus-Regel und Slot-Bewertung.
 */
export interface PlanningDay {
  date: DateKey;
  index: number;
  schedule: DaySchedule;
  /** Ab dieser Minute darf geplant werden (heute: jetzt). */
  from: number;
  slots: TimeSlot[];
  /** Alle Arbeitsblöcke des Tages (bestehende + neu geplante) – für die Fokus-/Pausen-Regel. */
  focus: TimeSlot[];
  freeMin: number;
  /** Restbudget für allgemeine Planung (Aufgaben, Ziele). */
  generalBudget: number;
  /** Restbudget für Schulaufgaben (Hausaufgaben, Lernzeit) – darf höher sein. */
  schoolBudget: number;
  initialGeneralBudget: number;
  plannedMin: number;
}

export function buildPlanningDays(data: PlannerData, dates: DateKey[], now: Date): PlanningDay[] {
  const { planning, school } = data.settings;
  const today = toDateKey(now);
  const nowMin = minutesSinceMidnight(now);
  return dates
    .filter((d) => d >= today)
    .map((date, index) => {
      const schedule = buildDaySchedule(data, date);
      const from = date === today ? roundUpTo(nowMin, planning.granularityMin) : 0;
      const generalBudget = planningBudget(schedule, planning, from);
      const schoolShare = Math.max(planning.maxPlannedShare, school.maxSchoolShare);
      return {
        date,
        index,
        schedule,
        from,
        slots: plannableSlots(schedule, planning, from),
        focus: schedule.blocks.filter((b) => WORK_KINDS.includes(b.kind)).map((b) => ({ start: b.start, end: b.end })),
        freeMin: freeMinutesFrom(schedule, from),
        generalBudget,
        schoolBudget: planningBudget(schedule, planning, from, schoolShare),
        initialGeneralBudget: generalBudget,
        plannedMin: 0,
      };
    });
}

export interface SlotPrefs {
  energy: TaskEnergy;
  preferred?: TimeOfDay;
  /** Der Block muss bis zu dieser Minute beendet sein (z. B. Deadline vor der Stunde). */
  latestEnd?: number;
}

export interface SlotChoice {
  start: number;
  score: number;
  energy: EnergyState;
  reasons: string[];
}

/** Beste Startzeit für einen Block dieser Dauer an einem Tag – nach Energie, Tageszeit und Lage. */
export function bestSlotInDay(data: PlannerData, day: PlanningDay, duration: number, prefs: SlotPrefs): SlotChoice | null {
  const { planning } = data.settings;
  const need = requiredEnergy(data, prefs.energy);
  const step = Math.max(planning.granularityMin, 15);
  const latestEnd = prefs.latestEnd ?? Number.POSITIVE_INFINITY;
  let best: SlotChoice | null = null;

  for (const slot of day.slots) {
    const slotEnd = Math.min(slot.end, latestEnd);
    if (slotEnd - slot.start < duration) continue;
    for (let start = slot.start; start + duration <= slotEnd; start += step) {
      if (!focusAllows(day.focus, start, start + duration, planning)) continue;
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
      if (prefs.preferred) {
        if (timeOfDayAt(start, planning) === prefs.preferred) {
          score += 15;
          reasons.push(`Bevorzugt ${TIME_OF_DAY_LABEL[prefs.preferred].toLowerCase()}`);
        } else score -= 10;
      }
      score -= (start - slot.start) / 60; // innerhalb einer Lücke lieber früh
      if (!best || score > best.score) best = { start, score, energy, reasons };
    }
  }
  return best;
}

/** Max. Fokuszeit am Stück: Arbeit mit kleinerem Abstand als der Pausenlänge gilt als zusammenhängend. */
export function focusAllows(focus: TimeSlot[], start: number, end: number, planning: PlanningSettings): boolean {
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

/** Zeit belegen: Lücke (inkl. Puffer) entfernen, Budgets und Fokus-Kette aktualisieren. */
export function reserve(day: PlanningDay, start: number, duration: number, planning: PlanningSettings): void {
  const end = start + duration;
  const buffer = planning.bufferBetweenTasksMin;
  day.slots = subtractSlots(day.slots, [{ start: start - buffer, end: end + buffer }])
    .map((s) => ({ start: roundUpTo(s.start, planning.granularityMin), end: s.end }))
    .filter((s) => s.end - s.start >= planning.minSlotMin);
  day.generalBudget -= duration;
  day.schoolBudget -= duration;
  day.plannedMin += duration;
  day.focus.push({ start, end });
}
