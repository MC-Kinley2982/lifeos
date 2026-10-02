import { routineSource, SCHOOL_SOURCE } from '../../domain/sources';
import { addDays, getWeekday, isDateInRange, toMinutes } from '../../domain/time';
import type { DateKey, ID, LessonInfo, Priority, SourceKey, Subject, TimetableEntry, Weekday } from '../../domain/types';
import { getDailyState, isSourceActive, resolveDayState } from '../planner/dayState';
import type { PlannerData } from '../planner/types';

/**
 * Woher kommt die Schulzeit? Entweder von einer verknüpften Routine (z. B. "Schule") –
 * dann gelten deren Weg-, Pausen-, Zustands- und Energie-Regeln – oder von einer eigenen Quelle.
 */
export interface SchoolSourceInfo {
  sourceKey: SourceKey;
  title: string;
  categoryId: ID;
  color: string;
  travelBeforeMin: number;
  travelAfterMin: number;
  priority: Priority;
  routineId?: ID;
  validFrom?: DateKey;
  validUntil?: DateKey;
}

export function schoolSourceInfo(data: PlannerData): SchoolSourceInfo {
  const school = data.settings.school;
  const routine = school.linkedRoutineId ? data.routines.find((r) => r.id === school.linkedRoutineId && r.enabled) : undefined;
  if (routine) {
    return {
      sourceKey: routineSource(routine.id),
      title: routine.name,
      categoryId: routine.categoryId,
      color: routine.color,
      travelBeforeMin: routine.travelBeforeMin,
      travelAfterMin: routine.travelAfterMin,
      priority: routine.priority,
      routineId: routine.id,
      validFrom: routine.validFrom,
      validUntil: routine.validUntil,
    };
  }
  const category = data.settings.categories.find((c) => c.id === school.categoryId);
  return {
    sourceKey: SCHOOL_SOURCE,
    title: 'Schule',
    categoryId: school.categoryId,
    color: category?.color ?? '#60a5fa',
    travelBeforeMin: school.travelBeforeMin,
    travelAfterMin: school.travelAfterMin,
    priority: 'high',
  };
}

export function subjectById(data: Pick<PlannerData, 'subjects'>, id: ID): Subject | undefined {
  return data.subjects.find((s) => s.id === id);
}

export function subjectLabel(subject: Subject | undefined): { name: string; short: string; color: string } {
  if (!subject) return { name: 'Unbekanntes Fach', short: '?', color: '#a1a1aa' };
  return { name: subject.name, short: subject.shortName?.trim() || subject.name.slice(0, 2), color: subject.color };
}

/** Stundenplan eines Wochentags, nach Beginn sortiert (unabhängig vom Tageszustand). */
export function lessonsForWeekday(data: PlannerData, weekday: Weekday): TimetableEntry[] {
  return data.timetable
    .filter((e) => e.weekday === weekday && toMinutes(e.end) > toMinutes(e.start))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function toLessonInfo(data: PlannerData, entry: TimetableEntry): LessonInfo {
  const label = subjectLabel(subjectById(data, entry.subjectId));
  return {
    entryId: entry.id,
    subjectId: entry.subjectId,
    title: label.name,
    shortName: label.short,
    color: label.color,
    start: toMinutes(entry.start),
    end: toMinutes(entry.end),
    room: entry.room ?? subjectById(data, entry.subjectId)?.room,
  };
}

/**
 * Findet an diesem Datum Unterricht statt? Berücksichtigt Stundenplan, Gültigkeit der
 * verknüpften Routine (z. B. Schuljahr), Tageszustand (Krank, Ferien, …) und "heute auslassen".
 */
export function isSchoolActiveOn(data: PlannerData, date: DateKey): boolean {
  if (!data.settings.school.enabled) return false;
  if (lessonsForWeekday(data, getWeekday(date)).length === 0) return false;
  const src = schoolSourceInfo(data);
  if (!isDateInRange(date, src.validFrom, src.validUntil)) return false;
  const state = resolveDayState(data, date).definition;
  if (!isSourceActive(state, src.sourceKey, src.categoryId)) return false;
  return !getDailyState(data, date).skippedSources.includes(src.sourceKey);
}

/** Unterricht, der an einem Datum tatsächlich stattfindet (leer bei Krankheit, Ferien, …). */
export function activeLessonsOn(data: PlannerData, date: DateKey): LessonInfo[] {
  if (!isSchoolActiveOn(data, date)) return [];
  return lessonsForWeekday(data, getWeekday(date)).map((e) => toLessonInfo(data, e));
}

/** Fächer eines Tages in Stundenplan-Reihenfolge (ohne Doppelungen). */
export function subjectsOn(data: PlannerData, date: DateKey, onlyActive = true): Subject[] {
  const entries = onlyActive
    ? activeLessonsOn(data, date).map((l) => l.subjectId)
    : lessonsForWeekday(data, getWeekday(date)).map((e) => e.subjectId);
  const ids = [...new Set(entries)];
  return ids.map((id) => subjectById(data, id)).filter((s): s is Subject => !!s);
}

/** Ende des Unterrichts an einem Datum (Minuten) oder null, wenn keine Schule ist. */
export function schoolEndOn(data: PlannerData, date: DateKey): number | null {
  const lessons = activeLessonsOn(data, date);
  if (lessons.length === 0) return null;
  return Math.max(...lessons.map((l) => l.end));
}

/**
 * Nächste Stunde eines Fachs an einem späteren Tag – übersprungen werden Tage ohne Schule
 * (Wochenende, Ferien, Urlaub, besondere Tage).
 */
export function nextLessonOf(data: PlannerData, subjectId: ID, afterDate: DateKey): { date: DateKey; entry: TimetableEntry } | null {
  const lookahead = Math.max(1, data.settings.school.lookaheadDays);
  for (let i = 1; i <= lookahead; i++) {
    const date = addDays(afterDate, i);
    const entry = lessonsForWeekday(data, getWeekday(date)).find((e) => e.subjectId === subjectId);
    if (entry && isSchoolActiveOn(data, date)) return { date, entry };
  }
  return null;
}
