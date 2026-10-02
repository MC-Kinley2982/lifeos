import { describe, expect, it } from 'vitest';
import { createExampleData, STATE_IDS } from '../../domain/defaults';
import { routineSource } from '../../domain/sources';
import { getWeekday, mergeSlots, subtractSlots, toHHMM, toMinutes, weekDays } from '../../domain/time';
import type { DailyState, DateKey, ScheduleBlock } from '../../domain/types';
import { planTasks } from './autoPlan';
import { estimateEnergy } from './energy';
import { computeGoalProgress } from './goals';
import { buildDaySchedule } from './schedule';
import { suggestNow } from './suggest';
import type { PlannerData } from './types';

// Dienstag – Schule + Fußball.
const TUESDAY: DateKey = '2026-09-29';

function makeData(today: DateKey = TUESDAY): PlannerData {
  const ex = createExampleData(today, 'Test');
  return {
    settings: ex.settings,
    routines: ex.routines,
    events: ex.events,
    tasks: ex.tasks,
    goals: ex.goals,
    dailyStates: {},
    vacations: [],
    specialDays: [],
    subjects: ex.subjects,
    timetable: ex.timetable,
    homework: [],
    exams: ex.exams,
  };
}

const at = (date: DateKey, time: string) => new Date(`${date}T${time}:00`);
const slotsAsText = (slots: { start: number; end: number }[]) => slots.map((s) => `${toHHMM(s.start)}-${toHHMM(s.end)}`);
const titles = (blocks: ScheduleBlock[]) => blocks.map((b) => b.title);

function withDaily(data: PlannerData, date: DateKey, patch: Partial<DailyState>): PlannerData {
  return { ...data, dailyStates: { ...data.dailyStates, [date]: { date, skippedSources: [], ...patch } } };
}

describe('Zeit-Utilities', () => {
  it('rechnet Uhrzeiten und Wochentage korrekt', () => {
    expect(toMinutes('08:30')).toBe(510);
    expect(toHHMM(1350)).toBe('22:30');
    expect(getWeekday('2026-10-02')).toBe(4); // Freitag
    expect(getWeekday(TUESDAY)).toBe(1);
    expect(weekDays('2026-10-02', 0)[0]).toBe('2026-09-28');
  });

  it('vereinigt und subtrahiert Intervalle', () => {
    expect(mergeSlots([{ start: 0, end: 10 }, { start: 5, end: 20 }, { start: 30, end: 40 }])).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 40 },
    ]);
    expect(subtractSlots([{ start: 0, end: 100 }], [{ start: 20, end: 30 }, { start: 50, end: 60 }])).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 50 },
      { start: 60, end: 100 },
    ]);
  });
});

describe('Tagesplan', () => {
  it('berechnet freie Zeit aus Routinen, Wegen, Pausen, Essen und Schlaf', () => {
    const s = buildDaySchedule(makeData(), TUESDAY);
    expect(s.awake).toEqual({ start: toMinutes('07:00'), end: toMinutes('22:30') });
    const t = titles(s.blocks);
    expect(t).toContain('Schule');
    expect(t).toContain('Rückweg · Schule');
    expect(t).toContain('Nach der Schule'); // 30-min-Pause gewinnt gegen 15-min-Regel
    expect(t).toContain('Fußballtraining');
    expect(t).toContain('Abendessen');

    const pause = s.blocks.find((b) => b.kind === 'break')!;
    expect([toHHMM(pause.start), toHHMM(pause.end)]).toEqual(['15:00', '15:30']);

    expect(slotsAsText(s.freeSlots)).toEqual(['07:00-07:15', '07:35-08:00', '15:30-16:45', '19:15-19:30', '20:00-22:30']);
    expect(s.totalFreeMin).toBe(15 + 25 + 75 + 15 + 150);
  });

  it('Krank pausiert Schule und Sport über Kategorie-Regeln, Essen bleibt', () => {
    const data = withDaily(makeData(), TUESDAY, { stateId: STATE_IDS.sick });
    const s = buildDaySchedule(data, TUESDAY);
    expect(s.dayState.definition.name).toBe('Krank');
    expect(titles(s.blocks)).not.toContain('Schule');
    expect(titles(s.blocks)).not.toContain('Fußballtraining');
    expect(titles(s.blocks)).toContain('Abendessen');
    expect(s.inactive.map((i) => i.title)).toEqual(expect.arrayContaining(['Schule', 'Fußballtraining']));
    // Energie wird begrenzt
    expect(estimateEnergy(data, s, toMinutes('10:00')).level).toBeLessThanOrEqual(2);
  });

  it('Urlaubszeitraum deaktiviert Schule/Fußball, Schlaf & Frühstück bleiben', () => {
    const data = makeData();
    data.vacations = [{ id: 'v1', name: 'Herbsturlaub', startDate: '2026-09-28', endDate: '2026-10-04', stateId: STATE_IDS.vacation }];
    const s = buildDaySchedule(data, TUESDAY);
    expect(s.dayState.origin).toBe('vacation');
    expect(s.dayState.label).toBe('Herbsturlaub');
    expect(titles(s.blocks)).toEqual(expect.arrayContaining(['Schlaf', 'Frühstück']));
    expect(titles(s.blocks)).not.toContain('Schule');
    expect(titles(s.blocks)).not.toContain('Fußballtraining');
  });

  it('manuell gesetzter Zustand hat Vorrang vor Urlaub', () => {
    const data = withDaily(makeData(), TUESDAY, { stateId: STATE_IDS.normal });
    data.vacations = [{ id: 'v1', name: 'Urlaub', startDate: TUESDAY, endDate: TUESDAY, stateId: STATE_IDS.vacation }];
    expect(buildDaySchedule(data, TUESDAY).dayState.origin).toBe('manual');
  });

  it('einzelne Routine kann nur für heute ausgelassen werden', () => {
    const base = makeData();
    const football = base.routines.find((r) => r.name === 'Fußballtraining')!;
    const data = withDaily(base, TUESDAY, { skippedSources: [routineSource(football.id)] });
    const s = buildDaySchedule(data, TUESDAY);
    expect(titles(s.blocks)).not.toContain('Fußballtraining');
    expect(slotsAsText(s.freeSlots)).toContain('15:30-19:30');
    // Mittwoch ist davon unberührt
    expect(titles(buildDaySchedule(data, '2026-10-01').blocks)).toContain('Fußballtraining');
  });

  it('Schlafenszeit nach Mitternacht verschiebt den Schlafbeginn auf den Folgetag', () => {
    const data = makeData();
    data.settings.sleep.perWeekday = { 1: { wakeTime: '07:00', bedtime: '00:30' } };
    const tue = buildDaySchedule(data, TUESDAY);
    expect(tue.awake.end).toBe(24 * 60);
    const wed = buildDaySchedule(data, '2026-09-30');
    const morningSleep = wed.blocks.find((b) => b.kind === 'sleep')!;
    expect(toHHMM(morningSleep.start)).toBe('00:30');
  });
});

describe('Energie', () => {
  it('folgt Tageszeit- und Kategorie-Regeln, Pause beendet "nach Schule"', () => {
    const data = makeData();
    const s = buildDaySchedule(data, TUESDAY);
    expect(estimateEnergy(data, s, toMinutes('10:00')).reason).toBe('Während Schule');
    expect(estimateEnergy(data, s, toMinutes('14:45')).level).toBe(2); // direkt nach der Schule
    expect(estimateEnergy(data, s, toMinutes('15:45')).level).toBe(3); // nach der Pause
    expect(estimateEnergy(data, s, toMinutes('21:00')).level).toBe(2); // später Abend
  });

  it('manueller Wert überschreibt alles', () => {
    const data = withDaily(makeData(), TUESDAY, { energy: 5, stateId: STATE_IDS.sick });
    const s = buildDaySchedule(data, TUESDAY);
    const e = estimateEnergy(data, s, toMinutes('21:00'));
    expect(e).toMatchObject({ level: 5, source: 'manual' });
  });
});

describe('Auto-Planung', () => {
  it('plant Aufgaben nur in freie Zeit, ohne Überschneidungen und mit Freizeit-Schutz', () => {
    const data = makeData();
    const result = planTasks(data, { dates: [TUESDAY], now: at(TUESDAY, '15:00'), includeGoals: false });
    const s = buildDaySchedule(data, TUESDAY);

    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      const inFree = s.freeSlots.some((f) => item.start >= f.start && item.end <= f.end);
      expect(inFree, `${item.title} ${toHHMM(item.start)}`).toBe(true);
    }
    const sorted = [...result.items].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].start).toBeGreaterThanOrEqual(sorted[i - 1].end);

    const planned = result.items.reduce((sum, i) => sum + (i.end - i.start), 0);
    expect(planned).toBeLessThanOrEqual(result.days[0].budgetMin);
    expect(result.days[0].freeMin - planned).toBeGreaterThanOrEqual(data.settings.planning.minFreeTimeMin);

    // Mathe (Deadline heute) kommt in die erste passende Lücke am Nachmittag
    const math = result.items.find((i) => i.title === 'Mathe Hausaufgaben')!;
    expect(toHHMM(math.start)).toBe('15:30');
  });

  it('plant nie in der Vergangenheit', () => {
    const data = makeData();
    const result = planTasks(data, { dates: [TUESDAY], now: at(TUESDAY, '20:10'), includeGoals: false });
    for (const item of result.items) expect(item.start).toBeGreaterThanOrEqual(toMinutes('20:10'));
  });

  it('füllt Wochenziele mit Einheiten an verschiedenen Tagen auf', () => {
    const data = makeData();
    data.tasks = data.tasks.filter((t) => t.title !== 'Blender üben');
    const week = weekDays(TUESDAY).filter((d) => d >= TUESDAY);
    const result = planTasks(data, { dates: week, now: at(TUESDAY, '07:00'), includeGoals: true });
    const sessions = result.items.filter((i) => i.kind === 'goal');
    expect(sessions.reduce((sum, i) => sum + (i.end - i.start), 0)).toBe(180);
    expect(new Set(sessions.map((s) => s.date)).size).toBe(sessions.length);
  });
});

describe('Was soll ich jetzt machen?', () => {
  it('schlägt bei normaler Energie die dringende Aufgabe vor, die in die Zeit bis zum Losgehen passt', () => {
    const data = makeData();
    const s = suggestNow(data, at(TUESDAY, '16:00'));
    expect(s.availableMin).toBe(45);
    expect(s.lines.join(' ')).toContain('bevor du los musst');
    expect(s.items[0].title).toBe('Mathe Hausaufgaben');
  });

  it('bei wenig Energie leichte Aufgaben statt Mathe', () => {
    const data = withDaily(makeData(), TUESDAY, { energy: 2 });
    const s = suggestNow(data, at(TUESDAY, '16:00'));
    expect(s.items.map((i) => i.title)).not.toContain('Mathe Hausaufgaben');
    expect(s.items.map((i) => i.title)).toContain('Russisch-Vokabeln');
    expect(s.laterForEnergy.map((i) => i.title)).toContain('Mathe Hausaufgaben');
  });

  it('während der Schule gilt der Vorschlag ab dem Ende der Schule inkl. Weg und Pause', () => {
    const s = suggestNow(makeData(), at(TUESDAY, '10:00'));
    expect(s.currentBlock?.title).toBe('Schule');
    expect(toHHMM(s.fromMinute)).toBe('15:30');
  });

  it('nachts wird Schlaf empfohlen', () => {
    expect(suggestNow(makeData(), at(TUESDAY, '23:15')).mode).toBe('night');
  });

  it('ohne offene Aufgaben ist Freizeit ein gültiges Ergebnis', () => {
    const data = makeData();
    data.tasks = [];
    data.goals = [];
    const s = suggestNow(data, at(TUESDAY, '20:15'));
    expect(s.mode).toBe('free');
  });
});

describe('Ziele', () => {
  it('zählt erledigte Aufgaben, manuelle Einträge und eingeplante Aufgaben', () => {
    const data = makeData();
    const goal = data.goals[0];
    const blender = data.tasks.find((t) => t.goalId === goal.id)!;
    blender.status = 'done';
    blender.completedAt = at(TUESDAY, '16:00').toISOString();
    goal.log.push({ id: 'l1', date: TUESDAY, minutes: 30 });
    data.tasks.push({ ...blender, id: 'x', status: 'todo', completedAt: undefined, schedule: { date: '2026-10-01', start: '16:00' } });

    const p = computeGoalProgress(data, weekDays(TUESDAY), at(TUESDAY, '18:00'))[goal.id];
    expect(p.doneMin).toBe(90);
    expect(p.plannedMin).toBe(60);
    expect(p.remainingMin).toBe(30);
    expect(p.percent).toBe(50);
  });
});
