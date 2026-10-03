import { createId } from '../../domain/ids';
import { addDays, formatDuration, toDateKey, toHHMM } from '../../domain/time';
import type { DateKey, Exam, Homework, ID, Priority, SchoolBlock, TaskEnergy, TimeOfDay } from '../../domain/types';
import {
  balanceFromRemaining,
  balanceScore,
  bestSlotInDay,
  buildPlanningDays,
  dayHasActivity,
  freeBefore,
  reserve,
  type Activity,
  type PlanningDay,
} from '../planner/placement';
import type { PlannerData } from '../planner/types';
import { studyWindow } from './exams';
import { deadlineMoment, doneMinutes, isBlockUpcoming, isHomeworkOverdue, upcomingMinutes } from './homework';
import { subjectById, subjectLabel } from './timetable';
import type { SchoolPlanOptions, SchoolPlanResult } from './types';

/** So weit voraus wird höchstens geplant. */
const HORIZON_DAYS = 28;
const STEP = 5;
/** Abzug für den Abgabetag selbst – lieber vorher erledigen, als alles auf den letzten Moment zu schieben. */
const DUE_DAY_PENALTY = 25;

const PRIORITY_RANK: Record<Priority, number> = { urgent: 3, high: 2, medium: 1, low: 0 };

interface WorkUnit {
  owner: 'homework' | 'exam';
  id: ID;
  title: string;
  /** Spätestes Ende: Datum + Minute (Hausaufgabe: Beginn der Stunde; Test: Vortag). */
  dueDate: DateKey;
  dueMinute: number;
  /** Frühester Tag (Lernbeginn bei Tests). */
  fromDate?: DateKey;
  rank: number;
  remaining: number;
  total: number;
  energy: TaskEnergy;
  preferred?: TimeOfDay;
  overBudget: boolean;
  activity: Activity;
  exam?: Exam;
}

interface Pick {
  day: PlanningDay;
  start: number;
  len: number;
  score: number;
}

/**
 * Plant Hausaufgaben und Lernzeiten für Tests gemeinsam in freie Zeit.
 *
 * Regeln (nachvollziehbar, ohne KI):
 * 1. Verpasste Blöcke (vergangen, nicht erledigt) werden entfernt – die Restzeit wird neu geplant.
 * 2. Manuelle Blöcke werden nie verschoben; kommende Blöcke bleiben stabil.
 * 3. Reihenfolge: früheste Deadline zuerst (Hausaufgaben vor Tests am selben Tag), dann Priorität.
 * 4. Pro Tag höchstens ein Block derselben Hausaufgabe bzw. eine Lerneinheit pro Test.
 * 5. Hausaufgaben möglichst am Stück, sonst auf mehrere Tage verteilt – immer vor der Deadline,
 *    bevorzugt an Tagen mit viel freier Zeit und nicht erst am Abgabetag.
 * 6. Tests: Lernzeit auf mehrere Tage im Lernzeitraum verteilt, freie Tage zuerst.
 * 7. Freizeit-Schutz: höchstens der Schul-Anteil der freien Zeit, Mindest-Freizeit bleibt immer frei.
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
    const due = isHomeworkOverdue(h, now) ? { date: addDays(today, 1), minute: 24 * 60 } : deadlineMoment(h.deadline);
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
      activity: { keys: [`homework:${h.id}`] },
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
      fromDate: window.from,
      rank: PRIORITY_RANK[e.priority],
      remaining,
      total: e.desiredStudyMinutes,
      energy: e.energy,
      preferred: e.preferredTimeOfDay,
      overBudget: overBudget.has(e.id),
      activity: { keys: [`exam:${e.id}`] },
      exam: e,
    });
  }
  if (units.length === 0) return result;

  // ── 3. Tage im Planungszeitraum ─────────────────────────────
  const horizon = addDays(today, HORIZON_DAYS);
  const lastDue = units.reduce((max, u) => (u.dueDate > max ? u.dueDate : max), today);
  const lastDate = lastDue < horizon ? lastDue : horizon;
  const dates: DateKey[] = [];
  for (let d = today; d <= lastDate; d = addDays(d, 1)) if (!opts.excludeDates?.includes(d)) dates.push(d);
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

  const place = (u: WorkUnit, p: Pick) => {
    reserve(p.day, p.start, p.len, planning, u.activity);
    const block: SchoolBlock = { id: createId('blk'), date: p.day.date, start: toHHMM(p.start), durationMin: p.len, source: 'auto', done: false };
    blocksOf(u).push(block);
    result.added.push({ owner: u.owner, id: u.id, title: u.title, block });
    u.remaining -= p.len;
  };

  const budgetOf = (u: WorkUnit, day: PlanningDay) => (u.overBudget ? Number.POSITIVE_INFINITY : day.schoolBudget);
  const minBlock = Math.max(STEP, school.minBlockMin);

  for (const u of units) {
    let budgetLimited = false;
    const pool = () =>
      days.filter((d) => d.date <= u.dueDate && (!u.fromDate || d.date >= u.fromDate) && !dayHasActivity(d, u.activity));
    const latestEndOf = (d: PlanningDay) => (d.date === u.dueDate ? u.dueMinute : undefined);
    const dayScore = (d: PlanningDay, len: number, slotScore: number) =>
      slotScore +
      // Am Abgabetag zählt nur die Zeit vor der Stunde, nicht der Rest des Tages.
      (d.date === u.dueDate && u.dueMinute < 24 * 60 ? balanceFromRemaining(freeBefore(d, u.dueMinute) - len) : balanceScore(d, len)) -
      d.index * (u.owner === 'homework' ? 2 : 0.5) -
      (u.owner === 'homework' && d.date === u.dueDate && days.some((x) => x.date < u.dueDate) ? DUE_DAY_PENALTY : 0);

    /** Bester Tag für einen Block mit Länge zwischen min und max (größere Blöcke leicht bevorzugt). */
    const bestPick = (candidates: PlanningDay[], max: number, min: number): Pick | null => {
      let best: Pick | null = null;
      for (const d of candidates) {
        const budget = budgetOf(u, d);
        if (budget < min) {
          budgetLimited = true;
          continue;
        }
        const upper = Math.floor(Math.min(max, budget) / STEP) * STEP;
        for (let len = upper; len >= min; len -= STEP) {
          const c = bestSlotInDay(working, d, len, { energy: u.energy, preferred: u.preferred, latestEnd: latestEndOf(d) });
          if (!c) continue;
          const score = dayScore(d, len, c.score) + len / 5;
          if (!best || score > best.score) best = { day: d, start: c.start, len, score };
          break;
        }
      }
      return best;
    };

    if (u.owner === 'homework') {
      const split = school.allowSplitHomework;
      const maxChunk = split ? Math.max(minBlock, planning.maxFocusMin) : Number.POSITIVE_INFINITY;
      while (u.remaining >= STEP) {
        const candidates = pool();
        if (candidates.length === 0) break;
        // a) Restzeit am Stück – lange Aufgaben nur, wenn es keinen anderen Tag gibt (oder nach Bestätigung).
        const longOk = !split || u.overBudget || candidates.length === 1;
        let pick = u.remaining <= maxChunk || longOk ? bestPick(candidates, u.remaining, u.remaining) : null;
        // b) Sonst ein möglichst großes Stück an einem Tag; der Rest folgt an einem anderen Tag.
        if (!pick && split && u.remaining >= 2 * minBlock) pick = bestPick(candidates, Math.min(maxChunk, u.remaining - minBlock), minBlock);
        if (!pick) break;
        place(u, pick);
      }
    } else {
      // Lernzeit: n Einheiten auf verschiedene Tage, freie Tage zuerst.
      const exam = u.exam!;
      const dayCap = Math.max(minBlock, school.maxStudyMinPerDay);
      const sessionLen = Math.min(dayCap, Math.max(minBlock, exam.sessionMinutes ?? school.defaultStudySessionMin));
      const planned = Math.max(1, Math.ceil(u.remaining / sessionLen));
      let placed = 0;
      while (u.remaining >= minBlock) {
        const candidates = pool();
        if (candidates.length === 0) break;
        const sessionsLeft = Math.max(1, Math.min(candidates.length, planned - placed));
        const target = Math.min(dayCap, u.remaining, Math.max(minBlock, Math.ceil(u.remaining / sessionsLeft / STEP) * STEP));
        const pick = bestPick(candidates, target, minBlock);
        if (!pick) break;
        place(u, pick);
        placed += 1;
      }
    }

    if (u.remaining >= STEP) {
      const done = u.total - u.remaining;
      result.unplanned.push({
        owner: u.owner,
        id: u.id,
        title: u.title,
        missingMinutes: u.remaining,
        reason: budgetLimited
          ? `Freizeit-Schutz: Es fehlen ${formatDuration(u.remaining)} – mehr freie Zeit darf nicht automatisch verplant werden.`
          : u.owner === 'homework'
            ? `Bis zur Deadline ist nicht genug freie Zeit (${formatDuration(u.remaining)} fehlen).`
            : `Bis zum Test ist nicht genug freie Zeit (${formatDuration(done)} von ${formatDuration(u.total)} eingeplant).`,
      });
    }
  }

  return result;
}
