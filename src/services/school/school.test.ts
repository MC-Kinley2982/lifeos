import { describe, expect, it } from 'vitest';
import { createDefaultSettings, createExampleData, STATE_IDS } from '../../domain/defaults';
import { toHHMM, toMinutes } from '../../domain/time';
import type { DateKey, Exam, Homework, Routine, SchoolBlock, Subject, TimetableEntry } from '../../domain/types';
import { buildDaySchedule } from '../planner/schedule';
import { planningBudget } from '../planner/freeTime';
import type { PlannerData } from '../planner/types';
import { studyProgress } from './exams';
import { computeHomeworkDeadline, createHomeworkInput } from './homework';
import { planSchoolWork } from './schoolPlanner';
import { subjectsOn } from './timetable';
import type { SchoolPlanResult } from './types';

const TUE: DateKey = '2026-09-29';
const WED: DateKey = '2026-09-30';
const THU: DateKey = '2026-10-01';
const FRI: DateKey = '2026-10-02';
const at = (date: DateKey, time: string) => new Date(`${date}T${time}:00`);
const ts = '2026-09-01T00:00:00.000Z';

function exampleData(today: DateKey = WED): PlannerData {
  const ex = createExampleData(today, 'Test');
  return {
    settings: ex.settings,
    routines: ex.routines,
    events: ex.events,
    tasks: [],
    goals: [],
    dailyStates: {},
    vacations: [],
    specialDays: [],
    subjects: ex.subjects,
    timetable: ex.timetable,
    homework: [],
    exams: [],
  };
}

const subject = (data: PlannerData, short: string): Subject => data.subjects.find((s) => s.shortName === short)!;

function homework(data: PlannerData, short: string, assigned: DateKey, minutes: number, id = `hw_${short}`): Homework {
  return { ...createHomeworkInput(data, subject(data, short).id, assigned, { title: 'Aufgabe', estimatedMinutes: minutes }), id, createdAt: ts, updatedAt: ts };
}

/** Planungsergebnis in die Daten übernehmen (wie der Store es tut). */
function apply(data: PlannerData, result: SchoolPlanResult): PlannerData {
  return {
    ...data,
    homework: data.homework.map((h) => (h.id in result.homework ? { ...h, plannedBlocks: result.homework[h.id] } : h)),
    exams: data.exams.map((e) => (e.id in result.exams ? { ...e, studySessions: result.exams[e.id] } : e)),
  };
}

const total = (blocks: SchoolBlock[]) => blocks.reduce((s, b) => s + b.durationMin, 0);
const endOf = (b: SchoolBlock) => toMinutes(b.start) + b.durationMin;

/** Kein geplanter Block darf feste Termine überlappen. */
function expectNoOverlap(data: PlannerData, date: DateKey) {
  const s = buildDaySchedule(data, date);
  const work = s.blocks.filter((b) => b.kind === 'homework' || b.kind === 'study');
  const fixed = s.blocks.filter((b) => b.blocksFreeTime && b.kind !== 'homework' && b.kind !== 'study' && b.kind !== 'sleep');
  for (const w of work) {
    expect(w.start >= s.awake.start && w.end <= s.awake.end, `${w.title} in Wachzeit`).toBe(true);
    for (const f of fixed) expect(w.end <= f.start || w.start >= f.end, `${w.title} ${toHHMM(w.start)} vs ${f.title}`).toBe(true);
  }
}

describe('Stundenplan im Tagesplan', () => {
  it('ersetzt an Schultagen die Zeiten der Routine "Schule" – Weg und Pause bleiben erhalten', () => {
    const data = exampleData();
    const s = buildDaySchedule(data, WED);
    const school = s.blocks.find((b) => b.kind === 'school')!;
    expect(school.title).toBe('Schule');
    expect([toHHMM(school.start), toHHMM(school.end)]).toEqual(['08:00', '13:25']);
    expect(school.lessons?.map((l) => l.shortName)).toEqual(['Ma', 'De', 'En', 'Ph', 'Ph', 'Ru']);
    expect(s.blocks.some((b) => b.kind === 'routine' && b.title === 'Schule')).toBe(false);
    expect(s.blocks.find((b) => b.title === 'Rückweg · Schule')).toMatchObject({ start: toMinutes('13:25'), end: toMinutes('13:55') });
    expect(s.blocks.find((b) => b.kind === 'break')).toMatchObject({ start: toMinutes('13:55'), end: toMinutes('14:25') });
  });

  it('ohne Stundenplan gilt weiterhin die Routine "Schule" (V1-Verhalten)', () => {
    const data = { ...exampleData(), timetable: [] };
    const s = buildDaySchedule(data, WED);
    expect(s.blocks.find((b) => b.kind === 'routine' && b.title === 'Schule')).toMatchObject({ start: 480, end: toMinutes('14:30') });
  });

  it('liefert die Fächer eines Tages in Stundenplan-Reihenfolge', () => {
    expect(subjectsOn(exampleData(), WED).map((s) => s.shortName)).toEqual(['Ma', 'De', 'En', 'Ph', 'Ru']);
  });
});

describe('Fall 1: automatische Deadline', () => {
  it('Mathe am Mittwoch → Deadline Donnerstag vor der Mathestunde', () => {
    const data = exampleData();
    expect(computeHomeworkDeadline(data, subject(data, 'Ma').id, WED)).toEqual({ date: THU, time: '08:00', source: 'nextLesson' });
  });

  it('Mathe am Donnerstag → nächste Mathestunde ist Freitag 09:55', () => {
    const data = exampleData();
    expect(computeHomeworkDeadline(data, subject(data, 'Ma').id, THU)).toEqual({ date: FRI, time: '09:55', source: 'nextLesson' });
  });

  it('überspringt Ferien', () => {
    const data = exampleData();
    data.vacations = [{ id: 'v', name: 'Herbstferien', startDate: FRI, endDate: '2026-10-11', stateId: STATE_IDS.holidays }];
    expect(computeHomeworkDeadline(data, subject(data, 'Ma').id, THU)).toMatchObject({ date: '2026-10-12', time: '08:00' });
  });

  it('ohne passende Stunde gilt die Fallback-Deadline', () => {
    const data = exampleData();
    data.subjects.push({ id: 'new', name: 'Latein', color: '#fff', createdAt: ts, updatedAt: ts });
    expect(computeHomeworkDeadline(data, 'new', WED)).toEqual({ date: '2026-10-07', source: 'fallback' });
  });

  it('übernimmt Ø-Dauer: fachspezifisch vor allgemein', () => {
    const data = exampleData();
    expect(createHomeworkInput(data, subject(data, 'En').id, WED).estimatedMinutes).toBe(30);
    subject(data, 'Ma').homeworkMinutes = 35;
    expect(createHomeworkInput(data, subject(data, 'Ma').id, WED).estimatedMinutes).toBe(35);
  });
});

describe('Fall 2: Aufteilen, wenn ein Tag nicht reicht', () => {
  function tightData(): PlannerData {
    const settings = createDefaultSettings();
    settings.meals = [];
    settings.breakRules = [];
    settings.sleep.default = { wakeTime: '07:00', bedtime: '21:00' };
    settings.sleep.perWeekday = { 3: { wakeTime: '06:45', bedtime: '21:00' } };
    settings.planning.minFreeTimeMin = 0;
    settings.planning.maxPlannedShare = 1;
    settings.school.maxSchoolShare = 1;
    settings.school.travelBeforeMin = 15;
    const blocker: Routine = {
      id: 'blocker', name: 'Termin', categoryId: 'cat_other', color: '#888', weekdays: [2], start: '07:30', end: '21:00',
      priority: 'high', blocksFreeTime: true, enabled: true, travelBeforeMin: 0, travelAfterMin: 0, createdAt: ts, updatedAt: ts,
    };
    const math: Subject = { id: 'ma', name: 'Mathematik', shortName: 'Ma', color: '#60a5fa', createdAt: ts, updatedAt: ts };
    const lesson: TimetableEntry = { id: 'l1', subjectId: 'ma', weekday: 3, start: '08:00', end: '08:45', createdAt: ts, updatedAt: ts };
    return { settings, routines: [blocker], events: [], tasks: [], goals: [], dailyStates: {}, vacations: [], specialDays: [], subjects: [math], timetable: [lesson], homework: [], exams: [] };
  }

  it('Mittwoch 30 min frei, Donnerstag vor der Stunde 60 min → 30 + 30 min, alles vor der Deadline', () => {
    const data = tightData();
    data.homework = [{ ...createHomeworkInput(data, 'ma', WED, { estimatedMinutes: 60 }), id: 'hw', createdAt: ts, updatedAt: ts }];
    expect(data.homework[0].deadline).toMatchObject({ date: THU, time: '08:00' });

    const result = planSchoolWork(data, at(WED, '06:00'));
    const blocks = result.homework.hw;
    expect(total(blocks)).toBe(60);
    expect(blocks.map((b) => `${b.date} ${b.start} ${b.durationMin}`)).toEqual([`${WED} 07:00 30`, `${THU} 06:45 30`]);
    expect(blocks.every((b) => b.date < THU || endOf(b) <= toMinutes('08:00'))).toBe(true);
    expect(result.unplanned).toHaveLength(0);
  });

  it('ohne Aufteilen landet die Aufgabe vollständig im passenden Block', () => {
    const data = tightData();
    data.settings.school.allowSplitHomework = false;
    data.homework = [{ ...createHomeworkInput(data, 'ma', WED, { estimatedMinutes: 60 }), id: 'hw', createdAt: ts, updatedAt: ts }];
    const blocks = planSchoolWork(data, at(WED, '06:00')).homework.hw;
    expect(blocks.map((b) => `${b.date} ${b.start} ${b.durationMin}`)).toEqual([`${THU} 06:45 60`]);
  });
});

describe('Fall 3: Lernzeit für einen Test', () => {
  it('verteilt 3 h über mehrere Tage vor dem Test – in freie Zeit', () => {
    const ex = createExampleData(TUE);
    const data: PlannerData = { ...exampleData(TUE), exams: ex.exams, events: ex.events };
    const exam = data.exams[0];
    expect(exam.desiredStudyMinutes).toBe(180);

    const result = planSchoolWork(data, at(TUE, '15:00'));
    const sessions = result.exams[exam.id];
    expect(total(sessions)).toBe(180);
    expect(new Set(sessions.map((s) => s.date)).size).toBeGreaterThanOrEqual(3);
    expect(sessions.every((s) => s.date < exam.date && s.date >= '2026-10-03')).toBe(true);
    expect(sessions.every((s) => s.durationMin <= data.settings.school.maxStudyMinPerDay)).toBe(true);

    const planned = apply(data, result);
    for (const d of new Set(sessions.map((s) => s.date))) expectNoOverlap(planned, d);
    expect(studyProgress(planned.exams[0], at(TUE, '15:00'))).toMatchObject({ plannedMin: 180, remainingMin: 0 });
  });
});

describe('Fall 4: Krank', () => {
  it('pausiert die Schule, Hausaufgaben bleiben möglich, Tests bleiben sichtbar', () => {
    const data = exampleData();
    data.dailyStates[WED] = { date: WED, stateId: STATE_IDS.sick, skippedSources: [] };
    const exam: Exam = { id: 'ex', subjectId: subject(data, 'Ma').id, title: 'Test', date: WED, startTime: '08:00', priority: 'high', energy: 'medium', desiredStudyMinutes: 0, studySessions: [], createdAt: ts, updatedAt: ts };
    data.exams = [exam];

    const s = buildDaySchedule(data, WED);
    expect(s.blocks.some((b) => b.kind === 'school')).toBe(false);
    expect(s.lessons).toHaveLength(0);
    expect(s.inactive.map((i) => i.title)).toContain('Schule');
    expect(s.exams.map((e) => e.id)).toEqual(['ex']);
    expect(subjectsOn(data, WED)).toHaveLength(0);

    data.homework = [homework(data, 'De', WED, 30)];
    const result = planSchoolWork(data, at(WED, '10:00'));
    expect(total(result.homework.hw_De)).toBe(30);
    // An Krankheitstagen wird höchstens der reduzierte Anteil verplant.
    const share = buildDaySchedule(apply(data, result), WED);
    expect(share.scheduledTaskMin).toBeLessThanOrEqual(planningBudget(buildDaySchedule(data, WED), data.settings.planning, toMinutes('10:00'), 1));
  });
});

describe('Hausaufgaben und Tests gemeinsam', () => {
  it('Hausaufgaben mit kurzer Deadline zuerst, Lernzeit danach – beides vor dem jeweiligen Termin', () => {
    const data = exampleData();
    data.homework = [homework(data, 'Ma', WED, 45), homework(data, 'En', WED, 30)];
    data.exams = [{
      id: 'test', subjectId: subject(data, 'Ma').id, title: 'Test', date: FRI, startTime: '09:55', priority: 'high', energy: 'medium',
      desiredStudyMinutes: 90, studyStartDate: WED, studySessions: [], createdAt: ts, updatedAt: ts,
    }];
    const now = at(WED, '14:30');
    const result = planSchoolWork(data, now);
    const planned = apply(data, result);

    expect(total(result.homework.hw_Ma)).toBe(45);
    expect(total(result.homework.hw_En)).toBe(30);
    for (const hw of planned.homework) {
      for (const b of hw.plannedBlocks) {
        const deadlineMin = toMinutes(hw.deadline.time!);
        expect(b.date < hw.deadline.date || endOf(b) <= deadlineMin).toBe(true);
      }
    }
    expect(result.exams.test.every((s) => s.date < FRI)).toBe(true);
    expect(total(result.exams.test)).toBe(90);

    // Freizeit-Schutz: Schulaufgaben überschreiten nie den Schul-Anteil der freien Zeit.
    const before = buildDaySchedule(data, WED);
    const after = buildDaySchedule(planned, WED);
    expect(after.scheduledTaskMin).toBeLessThanOrEqual(planningBudget(before, data.settings.planning, toMinutes('14:30'), data.settings.school.maxSchoolShare));
    expectNoOverlap(planned, WED);
    expectNoOverlap(planned, THU);
  });
});

describe('Stabilität und manuelle Änderungen', () => {
  it('manuell verschobene Blöcke bleiben, verpasste Blöcke werden neu eingeplant', () => {
    const data = exampleData();
    const hw = homework(data, 'Ma', TUE, 45);
    hw.deadline = { date: THU, time: '08:00', source: 'nextLesson' };
    hw.plannedBlocks = [
      { id: 'missed', date: TUE, start: '16:00', durationMin: 20, source: 'auto', done: false },
      { id: 'manual', date: WED, start: '17:00', durationMin: 25, source: 'manual', done: false },
    ];
    data.homework = [hw];
    const result = planSchoolWork(data, at(WED, '14:30'), { reset: true });
    const blocks = result.homework[hw.id];
    expect(blocks.find((b) => b.id === 'missed')).toBeUndefined();
    expect(blocks.find((b) => b.id === 'manual')).toMatchObject({ start: '17:00', source: 'manual' });
    expect(total(blocks)).toBe(45);
  });

  it('teilt lange Hausaufgaben in Blöcke von höchstens "max. Arbeit am Stück"', () => {
    const data = exampleData();
    data.homework = [homework(data, 'Ma', WED, 200)];
    const blocks = planSchoolWork(data, at(WED, '14:30')).homework.hw_Ma;
    expect(total(blocks)).toBe(200);
    expect(blocks.every((b) => b.durationMin <= data.settings.planning.maxFocusMin)).toBe(true);
  });

  it('respektiert den Freizeit-Schutz – außer nach ausdrücklicher Bestätigung', () => {
    const data = exampleData();
    data.homework = [homework(data, 'Ma', WED, 400)];
    const normal = planSchoolWork(data, at(WED, '14:30'));
    expect(normal.unplanned[0]?.reason).toMatch(/Freizeit-Schutz/);
    expect(normal.unplanned[0]?.missingMinutes).toBeGreaterThan(0);
    const forced = planSchoolWork(data, at(WED, '14:30'), { overBudgetIds: ['hw_Ma'] });
    expect(total(forced.homework.hw_Ma)).toBeGreaterThan(total(normal.homework.hw_Ma));
  });
});
