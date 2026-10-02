import { beforeEach, describe, expect, it } from 'vitest';
import { STATE_IDS } from '../domain/defaults';
import { routineSource } from '../domain/sources';
import { useAppStore } from './useAppStore';

const TODAY = '2026-09-29';
const store = () => useAppStore.getState();

describe('useAppStore', () => {
  beforeEach(() => {
    store().resetAll();
  });

  it('Onboarding mit Beispiel-Alltag füllt Routinen, Aufgaben und Ziele', () => {
    store().completeOnboarding({ name: 'Josh', withExample: true, today: TODAY });
    expect(store().settings.onboardingDone).toBe(true);
    expect(store().settings.profile.name).toBe('Josh');
    expect(store().routines.map((r) => r.name)).toContain('Schule');
    expect(store().tasks.length).toBeGreaterThan(0);
    expect(store().goals.length).toBe(1);
  });

  it('Onboarding ohne Beispiel startet leer, aber mit konfigurierbaren Standards', () => {
    store().completeOnboarding({ name: '', withExample: false, today: TODAY });
    expect(store().routines).toHaveLength(0);
    expect(store().settings.meals.length).toBeGreaterThan(0);
    expect(store().settings.dayStates.length).toBeGreaterThan(1);
  });

  it('Aufgaben anlegen, erledigen und wieder öffnen', () => {
    const id = store().addTask({ title: 'Test', estimatedMin: 30, priority: 'low', categoryId: 'cat_other', energy: 'low', status: 'todo' });
    store().toggleTaskDone(id);
    expect(store().tasks.find((t) => t.id === id)).toMatchObject({ status: 'done' });
    expect(store().tasks.find((t) => t.id === id)?.completedAt).toBeTruthy();
    store().toggleTaskDone(id);
    expect(store().tasks.find((t) => t.id === id)?.completedAt).toBeUndefined();
  });

  it('applyPlan plant Aufgaben ein und macht aus Ziel-Einheiten Aufgaben', () => {
    store().completeOnboarding({ name: '', withExample: true, today: TODAY });
    const task = store().tasks[0];
    const goal = store().goals[0];
    const before = store().tasks.length;
    store().applyPlan([
      { id: 'a', kind: 'task', taskId: task.id, title: task.title, date: TODAY, start: 930, end: 975, energy: 'medium', estimatedEnergy: 3, reasons: [] },
      { id: 'b', kind: 'goal', goalId: goal.id, title: goal.title, date: TODAY, start: 1200, end: 1260, energy: 'high', estimatedEnergy: 3, reasons: [] },
    ]);
    expect(store().tasks.find((t) => t.id === task.id)?.schedule).toEqual({ date: TODAY, start: '15:30' });
    expect(store().tasks).toHaveLength(before + 1);
    expect(store().tasks.at(-1)).toMatchObject({ goalId: goal.id, estimatedMin: 60, schedule: { date: TODAY, start: '20:00' } });
  });

  it('Routine löschen entfernt zugehörige Zustands- und Pausenregeln', () => {
    store().completeOnboarding({ name: '', withExample: true, today: TODAY });
    const school = store().routines.find((r) => r.name === 'Schule')!;
    store().setStateSourceRule(STATE_IDS.special, routineSource(school.id), false);
    expect(store().settings.breakRules.some((r) => r.trigger.type === 'afterSource')).toBe(true);
    store().removeRoutine(school.id);
    expect(store().settings.dayStates.find((d) => d.id === STATE_IDS.special)?.sourceRules).toEqual({});
    expect(store().settings.breakRules.some((r) => r.trigger.type === 'afterSource')).toBe(false);
  });

  it('Tageszustand, Energie und Auslassen pro Tag', () => {
    store().setDayState(TODAY, STATE_IDS.sick);
    store().setEnergy(TODAY, 2);
    store().toggleSkipSource(TODAY, 'meal:x');
    expect(store().dailyStates[TODAY]).toMatchObject({ stateId: STATE_IDS.sick, energy: 2, skippedSources: ['meal:x'] });
    store().toggleSkipSource(TODAY, 'meal:x');
    store().setEnergy(TODAY, null);
    expect(store().dailyStates[TODAY]).toMatchObject({ energy: undefined, skippedSources: [] });
  });

  it('Export und Import ergeben dieselben Daten', () => {
    store().completeOnboarding({ name: 'Josh', withExample: true, today: TODAY });
    const json = store().exportData();
    const routines = store().routines;
    store().resetAll();
    expect(store().routines).toHaveLength(0);
    expect(store().importData(json)).toEqual({ ok: true });
    expect(store().routines).toEqual(routines);
    expect(store().importData('kein json')).toMatchObject({ ok: false });
  });
});
