import { createId } from '../../domain/ids';
import { addDays, formatDuration, toDateKey, toHHMM } from '../../domain/time';
import type { DateKey, Exam, Homework, ID, Priority, SchoolBlock, TaskEnergy, TimeOfDay } from '../../domain/types';
import { bestSlotInDay, buildPlanningDays, reserve, type PlanningDay } from '../planner/placement';
import type { PlannerData } from '../planner/types';
import { studyWindow } from './exams';
import { deadlineMoment, doneMinutes, isBlockUpcoming, isHomeworkOverdue, upcomingMinutes } from './homework';
import { subjectById, subjectLabel } from './timetable';
import type { SchoolPlanOptions, SchoolPlanResult } from './types';

/** So weit voraus wird höchstens geplant. */
const HORIZON_DAYS = 28;
const STEP = 5;

const PRIORITY_RANK: Record<Priority, number> = { urgent: 3, high: 2, medium: 1, low: 0 };

interface WorkUnit {
  owner: 'homework' | 'exam';
  id: ID;
  title: string;
  /** Spätestes Ende: Datum + Minute (Hausaufgabe: Beginn der Stunde; Test: Vortag). */
  dueDate: DateKey;
  dueMinute: number;
  rank: number;
  remaining: number;
  total: number;
  energy: TaskEnergy;
  preferred?: TimeOfDay;
  overBudget: boolean;
  exam?: Exam;
  /** Frühester Tag (Lernbeginn bei Tests). */
  fromDate?: DateKey;
}

/**
 * Plant Hausaufgaben und Lernzeiten für Tests gemeinsam in freie Zeit.
 *
 * Regeln (nachvollziehbar, ohne KI):
 * 1. Verpasste Blöcke (vergangen, nicht erledigt) werden entfernt – die Restzeit wird neu geplant.
 * 2. Manuelle Blöcke werden nie verschoben; kommende Blöcke bleiben stabil.
 * 3. Reihenfolge: früheste Deadline zuerst (Hausaufgaben vor Tests am selben Tag), dann Priorität.
 * 4. Hausaufgaben: möglichst früh und am Stück, sonst aufgeteilt (≥ Mindestblock) – immer vor der Deadline.
 * 5. Tests: Lernzeit gleichmäßig über den Lernzeitraum verteilt (max. eine Einheit pro Tag und Test).
 * 6. Freizeit-Schutz: Schulaufgaben dürfen höchstens den Schul-Anteil der freien Zeit belegen.
 */
export function planSchoolWork(data: PlannerData, now: Date, opts: SchoolPlanOptions = {}): SchoolPlanResult {
  const result: SchoolPlanResult = { homework: {}, exams: {}, added: [], unplanned: [] };
  const { school, planning } = data.settings;
  const today = toDateKey(now);
  const filtered = !!(opts.homeworkIds || opts.examIds);
  const hwSelected = (id: ID) => !filtered || !!opts.homeworkIds?.includes(id);
  const examSelected = (id: ID) => !filtered || !!opts.examIds?.includes(id);
  const overBudget = new Set(opts.overBudgetIds ?? []);

  // ── 1. Aufräumen ────────────────────────────────────────────
  const clean = (blocks: SchoolBlock[]) =>
    blocks.filter((b) => b.done || (isBlockUpcoming(b, now) && !(opts.reset && b.source === 'auto')));

  const homework: Homework[] = data.homework.map((h) => {
    if (h.status === 'done' || !hwSelected(h.id)) return h;
    const kept = clean(h.plannedBlocks);
    if (kept.length === h.plannedBlocks.length) return h;
    result.homework[h.id] = kept;
    return { ...h, plannedBlocks: kept };
  });
  const exams: Exam[] = data.exams.map((e) => {
    if (e.date < today || !examSelected(e.id)) return e;
    const kept = clean(e.studySessions);
    if (kept.length === e.studySessions.length) return e;
    result.exams[e.id] = kept;
    return { ...e, studySessions: kept };
  });
  const working: PlannerData = { ...data, homework, exams };

  // ── 2. Arbeitseinheiten ─────────────────────────────────────
  const units: WorkUnit[] = [];
  for (const h of homework) {
    if (h.status === 'done' || !hwSelected(h.id)) continue;
    const remaining = h.estimatedMinutes - doneMinutes(h.plannedBlocks) - upcomingMinutes(h.plannedBlocks, now);
    if (remaining < STEP) continue;
    const overdue = isHomeworkOverdue(h, now);
    const due = overdue ? { date: addDays(today, 1), minute: 24 * 60 } : deadlineMoment(h.deadline);
    units.push({
      owner: 'homework',
      id: h.id,
      title: `${subjectLabel(subjectById(data, h.subjectId)).name}: ${h.title || 'Hausaufgabe'}`,
      dueDate: due.date,
      dueMinute: due.minute,
      rank: PRIORITY_RANK[h.priority],
      remaining,
      total: h.estimatedMinutes,
      energy: h.energy,
      overBudget: overBudget.has(h.id),
    });
  }
  for (const e of exams) {
    if (e.date < today || e.desiredStudyMinutes <= 0 || !examSelected(e.id)) continue;
    const window = studyWindow(working, e, today);
    if (!window) continue;
    const remaining = e.desiredStudyMinutes - doneMinutes(e.studySessions) - upcomingMinutes(e.studySessions, now);
    if (remaining < Math.max(STEP, school.minBlockMin)) continue;
    units.push({
      owner: 'exam',
      id: e.id,
      title: `${subjectLabel(subjectById(data, e.subjectId)).name} · ${e.title}`,
      dueDate: window.to,
      dueMinute: 24 * 60,
      rank: PRIORITY_RANK[e.priority],
      remaining,
      total: e.desiredStudyMinutes,
      energy: e.energy,
      preferred: e.preferredTimeOfDay,
      overBudget: overBudget.has(e.id),
      exam: e,
      fromDate: window.from,
    });
  }
  if (units.length === 0) return result;

  // ── 3. Tage im Planungszeitraum ─────────────────────────────
  const horizon = addDays(today, HORIZON_DAYS);
  const lastDue = units.reduce((max, u) => (u.dueDate > max ? u.dueDate : max), today);
  const lastDate = lastDue < horizon ? lastDue : horizon;
  const dates: DateKey[] = [];
  for (let d = today; d <= lastDate; d = addDays(d, 1)) dates.push(d);
  const days = buildPlanningDays(working, dates, now);

  // ── 4. Früheste Deadline zuerst ─────────────────────────────
  units.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.dueMinute - b.dueMinute ||
      (a.owner === b.owner ? 0 : a.owner === 'homework' ? -1 : 1) ||
      b.rank - a.rank,
  );

  const blocksOf = (u: WorkUnit): SchoolBlock[] => {
    const store = u.owner === 'homework' ? result.homework : result.exams;
    if (!store[u.id]) {
      const source = u.owner === 'homework' ? homework.find((h) => h.id === u.id)?.plannedBlocks : exams.find((e) => e.id === u.id)?.studySessions;
      store[u.id] = [...(source ?? [])];
    }
    return store[u.id];
  };

  const place = (u: WorkUnit, day: PlanningDay, start: number, duration: number) => {
    reserve(day, start, duration, planning);
    const block: SchoolBlock = { id: createId('blk'), date: day.date, start: toHHMM(start), durationMin: duration, source: 'auto', done: false };
    blocksOf(u).push(block);
    result.added.push({ owner: u.owner, id: u.id, title: u.title, block });
    u.remaining -= duration;
  };

  const budgetOf = (u: WorkUnit, day: PlanningDay) => (u.overBudget ? Number.POSITIVE_INFINITY : day.schoolBudget);

  /** Längster platzierbarer Block (zwischen min und max) an einem Tag. */
  const tryChunk = (u: WorkUnit, day: PlanningDay, max: number, min: number, latestEnd?: number): boolean => {
    const upper = Math.floor(Math.min(max, budgetOf(u, day)) / STEP) * STEP;
    for (let len = upper; len >= min; len -= STEP) {
      const choice = bestSlotInDay(working, day, len, { energy: u.energy, preferred: u.preferred, latestEnd });
      if (choice) {
        place(u, day, choice.start, len);
        return true;
      }
    }
    return false;
  };

  for (const u of units) {
    let budgetLimited = false;
    if (u.owner === 'homework') {
      const minBlock = Math.max(STEP, school.minBlockMin);
      const split = school.allowSplitHomework;
      // Beim Aufteilen nie länger als "max. Arbeit am Stück" – dazwischen plant die Fokus-Regel eine Pause.
      const maxChunk = split ? Math.max(minBlock, planning.maxFocusMin) : Number.POSITIVE_INFINITY;
      for (const day of days) {
        if (u.remaining <= 0 || day.date > u.dueDate) break;
        const latestEnd = day.date === u.dueDate ? u.dueMinute : undefined;
        while (u.remaining > 0) {
          if (budgetOf(u, day) < Math.min(u.remaining, minBlock)) {
            budgetLimited = true;
            break;
          }
          // a) Restzeit am Stück
          if (budgetOf(u, day) >= u.remaining && u.remaining <= maxChunk) {
            const choice = bestSlotInDay(working, day, u.remaining, { energy: u.energy, latestEnd });
            if (choice) {
              place(u, day, choice.start, u.remaining);
              break;
            }
          } else if (budgetOf(u, day) < u.remaining) budgetLimited = true;
          // b) Aufteilen – der Rest muss mindestens einen Mindestblock lang bleiben.
          if (!split || u.remaining < 2 * minBlock) break;
          if (!tryChunk(u, day, Math.min(u.remaining - minBlock, maxChunk), minBlock, latestEnd)) break;
        }
      }
    } else {
      planExam(u, days, school.minBlockMin, school.maxStudyMinPerDay, school.defaultStudySessionMin, tryChunk, () => {
        budgetLimited = true;
      });
    }

    if (u.remaining >= STEP) {
      const placed = u.total - u.remaining;
      result.unplanned.push({
        owner: u.owner,
        id: u.id,
        title: u.title,
        missingMinutes: u.remaining,
        reason: budgetLimited
          ? `Freizeit-Schutz: Es fehlen ${formatDuration(u.remaining)} – mehr freie Zeit darf nicht automatisch verplant werden.`
          : u.owner === 'homework'
            ? `Bis zur Deadline ist nicht genug freie Zeit (${formatDuration(u.remaining)} fehlen).`
            : `Bis zum Test ist nicht genug freie Zeit (${formatDuration(placed)} von ${formatDuration(u.total)} eingeplant).`,
      });
    }
  }

  return result;
}

/**
 * Lernzeit eines Tests gleichmäßig verteilen:
 * n ≈ Restzeit / Einheitslänge Einheiten auf gleichmäßig verteilte Tage, je Tag höchstens eine Einheit.
 * Scheitert ein Tag, wird ein anderer freier Tag genommen; Reste füllen übrige Tage (bis zum Tageslimit).
 */
function planExam(
  u: WorkUnit,
  days: PlanningDay[],
  minBlockMin: number,
  maxPerDay: number,
  defaultSession: number,
  tryChunk: (u: WorkUnit, day: PlanningDay, max: number, min: number) => boolean,
  onBudgetLimit: () => void,
): void {
  const exam = u.exam!;
  const minS = Math.max(STEP, minBlockMin);
  const dayCap = Math.max(minS, maxPerDay);
  const sessionLen = Math.min(dayCap, Math.max(minS, exam.sessionMinutes ?? defaultSession));
  // Tage, an denen für diesen Test schon eine Einheit liegt, bekommen keine zweite.
  const taken = new Set(exam.studySessions.map((s) => s.date));
  const free = days.filter((d) => d.date >= (u.fromDate ?? d.date) && d.date <= u.dueDate && !taken.has(d.date));
  if (free.length === 0) return;

  const used = new Set<string>();
  const n = Math.min(free.length, Math.max(1, Math.ceil(u.remaining / sessionLen)));
  const picks = Array.from({ length: n }, (_, k) => Math.floor((k * free.length) / n));

  for (let k = 0; k < picks.length && u.remaining >= minS; k++) {
    const sessionsLeft = picks.length - k;
    const target = Math.min(dayCap, Math.max(minS, Math.ceil(u.remaining / sessionsLeft / STEP) * STEP));
    // Gewählter Tag, sonst der nächste freie danach, sonst davor.
    const order = [...free.slice(picks[k]), ...free.slice(0, picks[k]).reverse()].filter((d) => !used.has(d.date));
    for (const day of order) {
      if (day.schoolBudget < minS && !u.overBudget) {
        onBudgetLimit();
        continue;
      }
      if (tryChunk(u, day, Math.min(target, u.remaining), minS)) {
        used.add(day.date);
        break;
      }
    }
  }
  // Reste auf weitere freie Tage verteilen.
  for (const day of free) {
    if (u.remaining < minS) break;
    if (used.has(day.date)) continue;
    if (tryChunk(u, day, Math.min(dayCap, u.remaining), minS)) used.add(day.date);
  }
}
