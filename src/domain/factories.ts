import { CATEGORY_IDS, STATE_IDS } from './defaults';
import { createId, nowIso } from './ids';
import { WORKDAYS } from './time';
import type { CalendarEvent, DateKey, Goal, Meal, Routine, Settings, SpecialDay, Task, Vacation } from './types';

/**
 * Vorlagen für neue Einträge (Formular-Startwerte).
 * Kategorien werden aus den Einstellungen gewählt, damit keine festen IDs vorausgesetzt werden.
 */

export type RoutineInput = Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>;
export type EventInput = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;
export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
export type GoalInput = Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>;

function pickCategory(settings: Settings, preferred: string): { id: string; color: string } {
  const cat = settings.categories.find((c) => c.id === preferred) ?? settings.categories[0];
  return { id: cat?.id ?? preferred, color: cat?.color ?? '#a78bfa' };
}

export function routineDraft(settings: Settings): RoutineInput {
  const cat = pickCategory(settings, CATEGORY_IDS.other);
  return {
    name: '',
    description: '',
    categoryId: cat.id,
    color: cat.color,
    weekdays: [...WORKDAYS],
    start: '16:00',
    end: '17:00',
    priority: 'medium',
    blocksFreeTime: true,
    enabled: true,
    travelBeforeMin: 0,
    travelAfterMin: 0,
  };
}

export function eventDraft(settings: Settings, date: DateKey): EventInput {
  const cat = pickCategory(settings, CATEGORY_IDS.other);
  return {
    title: '',
    description: '',
    location: '',
    date,
    start: '15:00',
    end: '16:00',
    allDay: false,
    categoryId: cat.id,
    blocksFreeTime: true,
    travelBeforeMin: 0,
    travelAfterMin: 0,
    source: 'local',
  };
}

export function taskDraft(settings: Settings, patch: Partial<TaskInput> = {}): TaskInput {
  const cat = pickCategory(settings, CATEGORY_IDS.other);
  return {
    title: '',
    description: '',
    estimatedMin: 30,
    priority: 'medium',
    categoryId: cat.id,
    energy: 'medium',
    status: 'todo',
    ...patch,
  };
}

export function goalDraft(settings: Settings): GoalInput {
  const cat = pickCategory(settings, CATEGORY_IDS.hobby);
  return {
    title: '',
    description: '',
    color: cat.color,
    categoryId: cat.id,
    target: { type: 'weeklyMinutes', minutes: 180 },
    sessionMin: settings.planning.defaultGoalSessionMin,
    energy: 'medium',
    active: true,
    log: [],
  };
}

export function mealDraft(): Meal {
  return { id: createId('meal'), name: 'Snack', time: '16:00', durationMin: 15, weekdays: [...WORKDAYS], enabled: true, color: '#fbbf24' };
}

export function vacationDraft(settings: Settings, today: DateKey): Vacation {
  const state = settings.dayStates.find((s) => s.id === STATE_IDS.vacation) ?? settings.dayStates.find((s) => !s.builtIn) ?? settings.dayStates[0];
  return { id: createId('vac'), name: 'Urlaub', startDate: today, endDate: today, stateId: state?.id ?? '' };
}

export function specialDayDraft(settings: Settings, today: DateKey): SpecialDay {
  const state = settings.dayStates.find((s) => s.id === STATE_IDS.special) ?? settings.dayStates[0];
  return { id: createId('day'), name: '', date: today, stateId: state?.id ?? '' };
}

export function stamp<T extends object>(input: T, prefix: string): T & { id: string; createdAt: string; updatedAt: string } {
  const ts = nowIso();
  return { ...input, id: createId(prefix), createdAt: ts, updatedAt: ts };
}
