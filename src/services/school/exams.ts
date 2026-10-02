import { addDays, diffDays } from '../../domain/time';
import type { DateKey, Exam } from '../../domain/types';
import type { PlannerData } from '../planner/types';
import { doneMinutes, upcomingMinutes } from './homework';
import type { StudyProgress } from './types';

/** Lernbeginn eines Tests: eigener Start oder Standard-Vorlauf. */
export function studyStartOf(data: PlannerData, exam: Exam): DateKey {
  return exam.studyStartDate ?? addDays(exam.date, -Math.max(1, data.settings.school.defaultStudyLeadDays));
}

/** Zeitraum, in dem Lerneinheiten geplant werden: ab Lernbeginn (frühestens heute) bis zum Vortag. */
export function studyWindow(data: PlannerData, exam: Exam, today: DateKey): { from: DateKey; to: DateKey } | null {
  const start = studyStartOf(data, exam);
  const from = start > today ? start : today;
  const to = addDays(exam.date, -1);
  return from <= to ? { from, to } : null;
}

export function studyProgress(exam: Exam, now: Date): StudyProgress {
  const targetMin = Math.max(0, exam.desiredStudyMinutes);
  const done = doneMinutes(exam.studySessions);
  const planned = upcomingMinutes(exam.studySessions, now);
  return {
    targetMin,
    doneMin: done,
    plannedMin: planned,
    remainingMin: Math.max(0, targetMin - done - planned),
    percent: targetMin > 0 ? Math.min(100, Math.round((done / targetMin) * 100)) : 0,
  };
}

/** Kommende Tests (heute eingeschlossen), nach Datum sortiert. */
export function upcomingExams(data: PlannerData, today: DateKey, withinDays?: number): Exam[] {
  return data.exams
    .filter((e) => e.date >= today && (withinDays === undefined || diffDays(today, e.date) <= withinDays))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
}
