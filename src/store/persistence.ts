import { createDefaultSettings } from '../domain/defaults';
import type { Settings } from '../domain/types';
import type { AppData, AppState } from './types';

export const DATA_KEYS = ['settings', 'routines', 'events', 'tasks', 'goals', 'dailyStates', 'vacations', 'specialDays'] as const;

export function pickData(state: AppState): AppData {
  return {
    settings: state.settings,
    routines: state.routines,
    events: state.events,
    tasks: state.tasks,
    goals: state.goals,
    dailyStates: state.dailyStates,
    vacations: state.vacations,
    specialDays: state.specialDays,
  };
}

export function emptyData(): AppData {
  return {
    settings: createDefaultSettings(),
    routines: [],
    events: [],
    tasks: [],
    goals: [],
    dailyStates: {},
    vacations: [],
    specialDays: [],
  };
}

/**
 * Ergänzt fehlende Felder mit Standardwerten.
 * So bleiben alte gespeicherte Daten gültig, wenn spätere Versionen neue Einstellungen einführen.
 */
export function normalizeData(raw: Partial<AppData> | undefined): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const s = (raw.settings ?? {}) as Partial<Settings>;
  const d = base.settings;
  const settings: Settings = {
    ...d,
    ...s,
    profile: { ...d.profile, ...s.profile },
    sleep: { ...d.sleep, ...s.sleep, perWeekday: { ...(s.sleep?.perWeekday ?? {}) } },
    energy: { ...d.energy, ...s.energy },
    planning: {
      ...d.planning,
      ...s.planning,
      energyRequirement: { ...d.planning.energyRequirement, ...s.planning?.energyRequirement },
    },
    ui: { ...d.ui, ...s.ui },
    meals: Array.isArray(s.meals) ? s.meals : d.meals,
    breakRules: Array.isArray(s.breakRules) ? s.breakRules : d.breakRules,
    dayStates: Array.isArray(s.dayStates) && s.dayStates.length
      ? s.dayStates.map((st) => ({ ...st, categoryRules: st.categoryRules ?? {}, sourceRules: st.sourceRules ?? {} }))
      : d.dayStates,
    categories: Array.isArray(s.categories) && s.categories.length ? s.categories : d.categories,
  };
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    settings,
    routines: arr(raw.routines),
    events: arr(raw.events),
    tasks: arr(raw.tasks),
    goals: arr<AppData['goals'][number]>(raw.goals).map((g) => ({ ...g, log: g.log ?? [] })),
    dailyStates: raw.dailyStates && typeof raw.dailyStates === 'object' ? raw.dailyStates : {},
    vacations: arr(raw.vacations),
    specialDays: arr(raw.specialDays),
  };
}

/** Migrationen zwischen Speicher-Versionen. V1 ist die erste Version. */
export function migrate(persisted: unknown, _version: number): Partial<AppData> {
  return (persisted ?? {}) as Partial<AppData>;
}
