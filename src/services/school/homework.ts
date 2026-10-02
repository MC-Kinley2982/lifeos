import type { HomeworkInput } from '../../domain/factories';
import { addDays, minutesSinceMidnight, MINUTES_PER_DAY, toDateKey, toMinutes } from '../../domain/time';
import type { DateKey, Homework, HomeworkDeadline, ID, SchoolBlock } from '../../domain/types';
import type { PlannerData } from '../planner/types';
import { nextLessonOf, subjectById } from './timetable';
import type { Moment } from './types';

/** Standard-Dauer: fachspezifischer Wert, sonst die allgemeine Ø-Hausaufgabenzeit. */
export function defaultHomeworkMinutes(data: PlannerData, subjectId: ID): number {
  return subjectById(data, subjectId)?.homeworkMinutes ?? data.settings.school.defaultHomeworkMinutes;
}

/**
 * Deadline = Beginn der nächsten Stunde dieses Fachs (an einem späteren Schultag).
 * Gibt es keine, gilt der Fallback aus den Einstellungen.
 */
export function computeHomeworkDeadline(data: PlannerData, subjectId: ID, assignedDate: DateKey): HomeworkDeadline {
  const next = nextLessonOf(data, subjectId, assignedDate);
  if (next) return { date: next.date, time: next.entry.start, source: 'nextLesson' };
  return { date: addDays(assignedDate, Math.max(1, data.settings.school.fallbackDeadlineDays)), source: 'fallback' };
}

/** Vorlage für eine neue Hausaufgabe inkl. automatischer Dauer und Deadline. */
export function createHomeworkInput(data: PlannerData, subjectId: ID, assignedDate: DateKey, patch: Partial<HomeworkInput> = {}): HomeworkInput {
  return {
    subjectId,
    title: '',
    estimatedMinutes: defaultHomeworkMinutes(data, subjectId),
    priority: data.settings.school.defaultHomeworkPriority,
    energy: 'medium',
    assignedDate,
    deadline: computeHomeworkDeadline(data, subjectId, assignedDate),
    status: 'todo',
    plannedBlocks: [],
    ...patch,
  };
}

export function deadlineMoment(deadline: HomeworkDeadline): Moment {
  return { date: deadline.date, minute: deadline.time ? toMinutes(deadline.time) : MINUTES_PER_DAY };
}

export function isBeforeMoment(a: Moment, b: Moment): boolean {
  return a.date < b.date || (a.date === b.date && a.minute < b.minute);
}

export function nowMoment(now: Date): Moment {
  return { date: toDateKey(now), minute: minutesSinceMidnight(now) };
}

export function blockStart(block: SchoolBlock): number {
  return toMinutes(block.start);
}

export function blockEnd(block: SchoolBlock): number {
  return toMinutes(block.start) + block.durationMin;
}

/** Endet der Block erst nach "jetzt"? (Vergangene, nicht erledigte Blöcke gelten als verpasst.) */
export function isBlockUpcoming(block: SchoolBlock, now: Date): boolean {
  const m = nowMoment(now);
  if (block.date !== m.date) return block.date > m.date;
  return blockEnd(block) > m.minute;
}

export function doneMinutes(blocks: SchoolBlock[]): number {
  return blocks.filter((b) => b.done).reduce((sum, b) => sum + b.durationMin, 0);
}

export function upcomingMinutes(blocks: SchoolBlock[], now: Date): number {
  return blocks.filter((b) => !b.done && isBlockUpcoming(b, now)).reduce((sum, b) => sum + b.durationMin, 0);
}

/** Noch nicht eingeplante Restzeit einer Hausaufgabe. */
export function homeworkRemainingMinutes(hw: Homework, now: Date): number {
  if (hw.status === 'done') return 0;
  return Math.max(0, hw.estimatedMinutes - doneMinutes(hw.plannedBlocks) - upcomingMinutes(hw.plannedBlocks, now));
}

/** Noch zu erledigende Zeit (unabhängig davon, ob schon eingeplant). */
export function homeworkOpenMinutes(hw: Homework): number {
  if (hw.status === 'done') return 0;
  return Math.max(0, hw.estimatedMinutes - doneMinutes(hw.plannedBlocks));
}

export function isHomeworkOverdue(hw: Homework, now: Date): boolean {
  return hw.status !== 'done' && isBeforeMoment(deadlineMoment(hw.deadline), nowMoment(now));
}

/** Offene Hausaufgaben, nach Deadline sortiert. */
export function openHomework(data: PlannerData): Homework[] {
  return data.homework
    .filter((h) => h.status !== 'done')
    .sort((a, b) => {
      const da = deadlineMoment(a.deadline);
      const db = deadlineMoment(b.deadline);
      return da.date.localeCompare(db.date) || da.minute - db.minute;
    });
}
