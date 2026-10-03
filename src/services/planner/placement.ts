import { TIME_OF_DAY_LABEL } from '../../domain/labels';
import { minutesSinceMidnight, roundUpTo, subtractSlots, toDateKey } from '../../domain/time';
import type { DateKey, DaySchedule, EnergyState, PlanningSettings, ScheduleBlock, TaskEnergy, TimeOfDay, TimeSlot } from '../../domain/types';
import { estimateEnergy, requiredEnergy } from './energy';
import { freeMinutesFrom, planningBudget, plannableSlots, scheduledTaskMinutesFrom, timeOfDayAt } from './freeTime';
import { buildDaySchedule, WORK_KINDS } from './schedule';
import type { PlannerData } from './types';

/**
 * Gemeinsame Bausteine für alle regelbasierten Planer (Aufgaben, Ziele, Hausaufgaben, Lernzeit):
 * freie Zeit eines Tages, Planungsbudgets (Freizeit-Schutz), Auslastung, Fokus-Regel,
 * "jede Aktivität höchstens einmal pro Tag" und Slot-Bewertung.
 */

/** Wie stark Tage mit viel freier Zeit bevorzugt werden (verteilt Arbeit z. B. aufs Wochenende). */
export const BALANCE_WEIGHT = 20;

/** Eine Aktivität: eindeutige Schlüssel (Ziel, Hausaufgabe, …) + Wort-Merkmal ("schach" für "Schachtraining"). */
export interface Activity {
  keys: string[];
  token?: string;
}

/** Erstes Wort (≥ 4 Buchstaben) eines Titels als Merkmal – "Schach" und "Schachtraining" gelten als dieselbe Aktivität. */
export function activityToken(title: string): string | undefined {
  const word = title.toLowerCase().match(/[a-zäöüß]+/)?.[0];
  return word && word.length >= 4 ? word : undefined;
}

function tokensMatch(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

/** Welche Aktivität steckt hinter einem Block des Tagesplans? */
export function blockActivity(data: PlannerData, b: ScheduleBlock): Activity | null {
  switch (b.kind) {
    case 'task': {
      const goalId = b.goalId ?? data.tasks.find((t) => t.id === b.sourceId)?.goalId;
      return { keys: [`task:${b.sourceId}`, ...(goalId ? [`goal:${goalId}`] : [])], token: activityToken(b.title) };
    }
    case 'homework':
      return { keys: [`homework:${b.sourceId}`] };
    case 'study':
      return { keys: [`exam:${b.sourceId}`] };
    case 'routine':
    case 'event':
      return { keys: b.goalId ? [`goal:${b.goalId}`] : [], token: activityToken(b.title) };
    default:
      return null;
  }
}

export function sameActivity(a: Activity, b: Activity): boolean {
  return a.keys.some((k) => b.keys.includes(k)) || (!!a.token && !!b.token && tokensMatch(a.token, b.token));
}

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
  /** Planbare Zeit des Tages (frei + bereits verplante Arbeit) und davon verplante Arbeit – für die Auslastung. */
  capacity: number;
  work: number;
  /** Aktivitäten, die an diesem Tag schon vorkommen. */
  activities: Activity[];
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
      const freeMin = freeMinutesFrom(schedule, from);
      const work = scheduledTaskMinutesFrom(schedule, from);
      return {
        date,
        index,
        schedule,
        from,
        slots: plannableSlots(schedule, planning, from),
        focus: schedule.blocks.filter((b) => WORK_KINDS.includes(b.kind)).map((b) => ({ start: b.start, end: b.end })),
        freeMin,
        capacity: freeMin + work,
        work,
        activities: schedule.blocks.map((b) => blockActivity(data, b)).filter((a): a is Activity => !!a),
        generalBudget,
        schoolBudget: planningBudget(schedule, planning, from, schoolShare),
        initialGeneralBudget: generalBudget,
        plannedMin: 0,
      };
    });
}

export function dayHasActivity(day: PlanningDay, activity: Activity): boolean {
  return day.activities.some((a) => sameActivity(a, activity));
}

/**
 * Je mehr freie Zeit danach übrig bleibt, desto höher (logarithmisch): Volle Tage werden stark
 * geschont, freie Tage wie das Wochenende bevorzugt – die restliche Freizeit gleicht sich an.
 */
export function balanceScore(day: PlanningDay, duration: number): number {
  return balanceFromRemaining(day.capacity - day.work - duration);
}

export function balanceFromRemaining(remainingMinutes: number): number {
  return BALANCE_WEIGHT * Math.log2(1 + Math.max(0, remainingMinutes) / 60);
}

/** Noch planbare Zeit eines Tages, die vor einer bestimmten Minute endet (z. B. vor der Deadline-Stunde). */
export function freeBefore(day: PlanningDay, latestEnd: number): number {
  return day.slots.reduce((sum, s) => sum + Math.max(0, Math.min(s.end, latestEnd) - s.start), 0);
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

/** Zeit belegen: Lücke (inkl. Puffer) entfernen, Budgets, Auslastung, Fokus-Kette und Aktivitäten aktualisieren. */
export function reserve(day: PlanningDay, start: number, duration: number, planning: PlanningSettings, activity?: Activity): void {
  const end = start + duration;
  const buffer = planning.bufferBetweenTasksMin;
  day.slots = subtractSlots(day.slots, [{ start: start - buffer, end: end + buffer }])
    .map((s) => ({ start: roundUpTo(s.start, planning.granularityMin), end: s.end }))
    .filter((s) => s.end - s.start >= planning.minSlotMin);
  day.generalBudget -= duration;
  day.schoolBudget -= duration;
  day.plannedMin += duration;
  day.work += duration;
  day.focus.push({ start, end });
  if (activity) day.activities.push(activity);
}
