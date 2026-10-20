import { beforeEach, describe, expect, it } from 'vitest';
import { createExampleData, defaultSchoolSettings } from '../../domain/defaults';
import type { Exam, Grade, Homework, SchoolSettings } from '../../domain/types';
import { emptyData, migrate, normalizeData } from '../../store/persistence';
import { useAppStore } from '../../store/useAppStore';
import { applyRecords, toRecords } from '../sync/records';
import type { PlannerData } from '../planner/types';
import { examsWithoutGrade, formatGrade, gradeLabel, gradeOptions, gradesBySubject, neededGrade, overallAverage, subjectAverage } from './grades';
import { createHomeworkInput, defaultHomeworkMinutes, learnedHomeworkMinutes } from './homework';

const ts = '2026-10-01T08:00:00.000Z';
const settings: SchoolSettings = {
  ...defaultSchoolSettings(),
  gradeTypes: [
    { id: 'ka', name: 'Klassenarbeit', weight: 2 },
    { id: 'test', name: 'Test', weight: 1 },
    { id: 'oral', name: 'Mündlich', weight: 1 },
  ],
};
const g = (value: number, typeId: string, patch: Partial<Grade> = {}): Grade => ({
  id: `g${Math.random()}`,
  subjectId: 'ma',
  value,
  typeId,
  date: '2026-10-01',
  createdAt: ts,
  updatedAt: ts,
  ...patch,
});

describe('Notenschnitt', () => {
  it('gewichtet: Klassenarbeit zählt doppelt', () => {
    expect(subjectAverage([g(2, 'ka'), g(3, 'test')], settings)).toBeCloseTo(7 / 3);
    expect(subjectAverage([g(2, 'ka'), g(3, 'test', { weight: 2 })], settings)).toBeCloseTo(2.5);
    expect(subjectAverage([], settings)).toBeNull();
  });

  it('nach Notenart: erst Schnitt je Art, dann Anteile (z. B. schriftlich 50 % / mündlich 50 %)', () => {
    const byType: SchoolSettings = { ...settings, gradeAverageMode: 'byType', gradeTypes: [{ id: 'ka', name: 'Schriftlich', weight: 50 }, { id: 'oral', name: 'Mündlich', weight: 50 }] };
    expect(subjectAverage([g(2, 'ka'), g(3, 'ka'), g(1, 'oral')], byType)).toBeCloseTo(1.75);
  });

  it('Gesamtschnitt = Mittel der Fachschnitte, Fächer ohne Noten ans Ende', () => {
    const subjects = [
      { id: 'de', name: 'Deutsch', color: '#fff', createdAt: ts, updatedAt: ts },
      { id: 'ma', name: 'Mathe', color: '#fff', createdAt: ts, updatedAt: ts },
      { id: 'en', name: 'Englisch', color: '#fff', createdAt: ts, updatedAt: ts },
    ];
    const list = gradesBySubject(subjects, [g(2, 'ka'), g(1, 'test', { subjectId: 'en' })], settings);
    expect(list.map((s) => s.subject.id)).toEqual(['ma', 'en', 'de']);
    expect(overallAverage(list)).toBeCloseTo(1.5);
  });
});

describe('Plus/Minus', () => {
  it('Notenauswahl und Beschriftung', () => {
    const opts = gradeOptions(0.3);
    expect(opts.map((o) => o.label).slice(0, 4)).toEqual(['1+', '1', '1-', '2+']);
    expect(opts.at(-2)).toEqual({ value: 5.7, label: '6+' });
    expect(opts).toHaveLength(17);
    expect(gradeLabel(2.3, 0.3)).toBe('2-');
    expect(gradeLabel(1.75, 0.25)).toBe('2+');
    expect(gradeLabel(2.25, 0.3)).toBe('2,25');
    expect(formatGrade(2)).toBe('2,0');
    expect(formatGrade(7 / 3)).toBe('2,33');
  });
});

describe('Was brauche ich in der nächsten Arbeit?', () => {
  const grades = [g(2, 'ka'), g(3, 'test')]; // Schnitt 2,33

  it('erreichbar: beste nötige Note wird auf die wählbaren Noten abgerundet', () => {
    const r = neededGrade(grades, settings, { typeId: 'ka' }, 2.0);
    expect(r).toMatchObject({ status: 'reachable', option: { label: '1-', value: 1.3 } });
    if (r.status === 'reachable') expect(r.max).toBeCloseTo(1.5);
    expect(neededGrade(grades, settings, { typeId: 'ka' }, 3.0)).toMatchObject({ status: 'reachable', option: { label: '4' } });
  });

  it('immer erreicht / nicht mehr erreichbar', () => {
    expect(neededGrade(grades, settings, { typeId: 'ka' }, 4.0).status).toBe('always');
    const impossible = neededGrade(grades, settings, { typeId: 'ka' }, 1.0);
    expect(impossible.status).toBe('impossible');
    if (impossible.status === 'impossible') expect(impossible.best).toBeCloseTo((7 + 1.4) / 5);
  });

  it('funktioniert auch im Modus "nach Notenart" und ohne bisherige Noten', () => {
    const byType: SchoolSettings = { ...settings, gradeAverageMode: 'byType', gradeTypes: [{ id: 'ka', name: 'Schriftlich', weight: 50 }, { id: 'oral', name: 'Mündlich', weight: 50 }] };
    expect(neededGrade([g(2, 'ka'), g(3, 'ka'), g(1, 'oral')], byType, { typeId: 'ka' }, 2.0)).toMatchObject({ status: 'reachable', option: { label: '4' } });
    expect(neededGrade([], settings, { typeId: 'test' }, 2.5)).toMatchObject({ status: 'reachable', option: { label: '2-' } });
  });

  it('vergangene Tests ohne Note', () => {
    const exam = (id: string, date: string): Exam => ({ id, subjectId: 'ma', title: 'KA', date, priority: 'high', energy: 'medium', desiredStudyMinutes: 0, studySessions: [], createdAt: ts, updatedAt: ts });
    const exams = [exam('a', '2026-09-01'), exam('b', '2026-10-02'), exam('c', '2026-10-04'), exam('d', '2026-10-20')];
    expect(examsWithoutGrade(exams, [g(2, 'ka', { examId: 'c' })], '2026-10-06', '2026-09-15').map((e) => e.id)).toEqual(['b']);
  });
});

describe('Hausaufgabenzeit lernen', () => {
  function data(actuals: Array<number | undefined>, patch: Partial<SchoolSettings> = {}): PlannerData {
    const ex = { ...emptyData(), ...createExampleData('2026-10-01', 'Josh') };
    const subject = ex.subjects.find((s) => s.shortName === 'Ma')!;
    const homework: Homework[] = actuals.map((actualMinutes, i) => ({
      ...createHomeworkInput(ex as unknown as PlannerData, subject.id, '2026-10-01'),
      id: `hw${i}`,
      status: 'done',
      actualMinutes,
      completedAt: `2026-10-0${i + 1}T15:00:00.000Z`,
      createdAt: ts,
      updatedAt: ts,
    }));
    return { ...(ex as unknown as PlannerData), homework, settings: { ...ex.settings, school: { ...ex.settings.school, ...patch } } };
  }
  const ma = (d: PlannerData) => d.subjects.find((s) => s.shortName === 'Ma')!.id;

  it('gleitender Durchschnitt der letzten Werte, auf 5 min gerundet', () => {
    const d = data([20, 30, 40, undefined]);
    expect(learnedHomeworkMinutes(d, ma(d))).toEqual({ minutes: 30, samples: 3 });
    const recent = data([20, 30, 40], { homeworkLearnSamples: 2 });
    expect(learnedHomeworkMinutes(recent, ma(recent))).toEqual({ minutes: 35, samples: 2 });
    expect(defaultHomeworkMinutes(d, ma(d))).toBe(30);
  });

  it('zu wenige Werte oder ausgeschaltet → Startwert des Fachs bzw. allgemeiner Standard', () => {
    const few = data([50], { defaultHomeworkMinutes: 25 });
    expect(learnedHomeworkMinutes(few, ma(few))).toBeNull();
    expect(defaultHomeworkMinutes(few, ma(few))).toBe(25);
    const off = data([50, 50], { learnHomeworkTime: false, defaultHomeworkMinutes: 25 });
    expect(defaultHomeworkMinutes(off, ma(off))).toBe(25);
  });
});

describe('Store & Sync', () => {
  const store = () => useAppStore.getState();
  beforeEach(() => {
    store().resetAll();
    store().completeOnboarding({ name: '', withExample: true, today: '2026-10-01' });
  });

  it('Noten anlegen, ändern, löschen und synchronisieren', () => {
    const subjectId = store().subjects[0].id;
    const id = store().addGrade({ subjectId, value: 2.3, typeId: 'gt_exam', date: '2026-10-01', title: '1. KA' });
    store().updateGrade(id, { value: 1.7 });
    expect(store().grades).toMatchObject([{ id, value: 1.7, title: '1. KA' }]);
    const data = normalizeData({ ...emptyData(), ...store() });
    const records = [...toRecords(data).values()].map((r) => ({ ...r, deleted: false, updatedAt: ts }));
    expect(records.some((r) => r.collection === 'grades' && r.id === id)).toBe(true);
    expect(applyRecords(emptyData(), records).grades).toEqual(store().grades);
    store().removeGrade(id);
    expect(store().grades).toEqual([]);
  });

  it('tatsächliche Hausaufgabenzeit speichern', () => {
    const subjectId = store().subjects[0].id;
    const id = store().addHomework(createHomeworkInput(store() as unknown as PlannerData, subjectId, '2026-10-01', { title: 'S. 12' }));
    store().toggleHomeworkDone(id);
    store().setHomeworkActualMinutes(id, 42);
    expect(store().homework.find((h) => h.id === id)?.actualMinutes).toBe(42);
    store().setHomeworkActualMinutes(id, undefined);
    expect(store().homework.find((h) => h.id === id)?.actualMinutes).toBeUndefined();
  });

  it('Migration V5 → V6: Noten leer, Standard-Notenarten und Lern-Einstellungen ergänzt', () => {
    const old = JSON.parse(JSON.stringify(createExampleData('2026-10-01', 'Josh')));
    delete old.settings.school.gradeTypes;
    delete old.settings.school.learnHomeworkTime;
    delete old.settings.ui.smartQuickAdd;
    const data = normalizeData(migrate(old, 5));
    expect(data.grades).toEqual([]);
    expect(data.settings.school.gradeTypes.map((t) => t.name)).toEqual(['Klassenarbeit', 'Test', 'Mündlich', 'Sonstige']);
    expect(data.settings.school.learnHomeworkTime).toBe(true);
    expect(data.settings.ui.smartQuickAdd).toBe(true);
  });
});
