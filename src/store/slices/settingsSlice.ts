import { createDefaultSettings } from '../../domain/defaults';
import type { Settings } from '../../domain/types';
import { omitKey, patchById, removeById, upsertById } from '../helpers';
import type { SettingsActions, SliceCreator } from '../types';

export interface SettingsSlice extends SettingsActions {
  settings: Settings;
}

export const createSettingsSlice: SliceCreator<SettingsSlice> = (set) => {
  /** Kurzform: Einstellungen unveränderlich aktualisieren. */
  const update = (fn: (s: Settings) => Partial<Settings>) => set((state) => ({ settings: { ...state.settings, ...fn(state.settings) } }));

  return {
    settings: createDefaultSettings(),

    updateProfile: (patch) => update((s) => ({ profile: { ...s.profile, ...patch } })),

    updateSleep: (patch) => update((s) => ({ sleep: { ...s.sleep, ...patch } })),
    setSleepOverride: (weekday, times) =>
      update((s) => {
        const perWeekday = { ...s.sleep.perWeekday };
        if (times) perWeekday[weekday] = times;
        else delete perWeekday[weekday];
        return { sleep: { ...s.sleep, perWeekday } };
      }),

    addMeal: (meal) => update((s) => ({ meals: [...s.meals, meal] })),
    updateMeal: (id, patch) => update((s) => ({ meals: patchById(s.meals, id, patch) })),
    removeMeal: (id) => update((s) => ({ meals: removeById(s.meals, id) })),

    addBreakRule: (rule) => update((s) => ({ breakRules: [...s.breakRules, rule] })),
    updateBreakRule: (id, patch) => update((s) => ({ breakRules: patchById(s.breakRules, id, patch) })),
    removeBreakRule: (id) => update((s) => ({ breakRules: removeById(s.breakRules, id) })),

    updateEnergySettings: (patch) => update((s) => ({ energy: { ...s.energy, ...patch } })),
    upsertEnergyWindow: (w) => update((s) => ({ energy: { ...s.energy, timeWindows: upsertById(s.energy.timeWindows, w) } })),
    removeEnergyWindow: (id) => update((s) => ({ energy: { ...s.energy, timeWindows: removeById(s.energy.timeWindows, id) } })),
    upsertEnergyRule: (r) => update((s) => ({ energy: { ...s.energy, categoryRules: upsertById(s.energy.categoryRules, r) } })),
    removeEnergyRule: (id) => update((s) => ({ energy: { ...s.energy, categoryRules: removeById(s.energy.categoryRules, id) } })),

    addDayState: (dayState) => update((s) => ({ dayStates: [...s.dayStates, dayState] })),
    updateDayState: (id, patch) => update((s) => ({ dayStates: patchById(s.dayStates, id, patch) })),
    removeDayState: (id) =>
      set((state) => {
        const target = state.settings.dayStates.find((d) => d.id === id);
        if (!target || target.builtIn) return {};
        // Verweise aufräumen – betroffene Tage fallen auf den Standard-Zustand zurück.
        const dailyStates = Object.fromEntries(
          Object.entries(state.dailyStates).map(([date, d]) => [date, d.stateId === id ? { ...d, stateId: undefined } : d]),
        );
        return {
          settings: { ...state.settings, dayStates: removeById(state.settings.dayStates, id) },
          dailyStates,
          vacations: state.vacations.filter((v) => v.stateId !== id),
          specialDays: state.specialDays.filter((d) => d.stateId !== id),
        };
      }),
    setStateSourceRule: (stateId, sourceKey, active) =>
      update((s) => ({
        dayStates: s.dayStates.map((d) =>
          d.id !== stateId
            ? d
            : { ...d, sourceRules: active === null ? omitKey(d.sourceRules, sourceKey) : { ...d.sourceRules, [sourceKey]: active } },
        ),
      })),
    setStateCategoryRule: (stateId, categoryId, active) =>
      update((s) => ({
        dayStates: s.dayStates.map((d) =>
          d.id !== stateId
            ? d
            : { ...d, categoryRules: active === null ? omitKey(d.categoryRules, categoryId) : { ...d.categoryRules, [categoryId]: active } },
        ),
      })),

    addCategory: (category) => update((s) => ({ categories: [...s.categories, category] })),
    updateCategory: (id, patch) => update((s) => ({ categories: patchById(s.categories, id, patch) })),
    removeCategory: (id) =>
      set((state) => {
        const remaining = removeById(state.settings.categories, id);
        const fallback = remaining[0]?.id;
        if (!fallback) return {}; // mindestens eine Kategorie muss bleiben
        const reassign = <T extends { categoryId: string }>(list: T[]) =>
          list.map((x) => (x.categoryId === id ? { ...x, categoryId: fallback } : x));
        return {
          settings: {
            ...state.settings,
            categories: remaining,
            energy: { ...state.settings.energy, categoryRules: state.settings.energy.categoryRules.filter((r) => r.categoryId !== id) },
            dayStates: state.settings.dayStates.map((d) => ({ ...d, categoryRules: omitKey(d.categoryRules, id) })),
          },
          routines: reassign(state.routines),
          events: reassign(state.events),
          tasks: reassign(state.tasks),
          goals: reassign(state.goals),
        };
      }),

    updatePlanning: (patch) => update((s) => ({ planning: { ...s.planning, ...patch } })),
    upsertWorkWindow: (w) => update((s) => ({ planning: { ...s.planning, workWindows: upsertById(s.planning.workWindows, w) } })),
    removeWorkWindow: (id) => update((s) => ({ planning: { ...s.planning, workWindows: removeById(s.planning.workWindows, id) } })),
    upsertProtectedPeriod: (p) => update((s) => ({ planning: { ...s.planning, protectedPeriods: upsertById(s.planning.protectedPeriods, p) } })),
    removeProtectedPeriod: (id) => update((s) => ({ planning: { ...s.planning, protectedPeriods: removeById(s.planning.protectedPeriods, id) } })),

    updateUi: (patch) => update((s) => ({ ui: { ...s.ui, ...patch } })),

    updateGoogleCalendar: (patch) =>
      update((s) => ({ integrations: { ...s.integrations, googleCalendar: { ...s.integrations.googleCalendar, ...patch } } })),
  };
};
