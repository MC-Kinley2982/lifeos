import type { DailyState, DateKey, DayStateDefinition, ID, ResolvedDayState, SourceKey } from '../../domain/types';
import type { PlannerData } from './types';

export function emptyDailyState(date: DateKey): DailyState {
  return { date, skippedSources: [] };
}

export function getDailyState(data: Pick<PlannerData, 'dailyStates'>, date: DateKey): DailyState {
  return data.dailyStates[date] ?? emptyDailyState(date);
}

function findState(data: PlannerData, id: ID | undefined): DayStateDefinition | undefined {
  if (!id) return undefined;
  return data.settings.dayStates.find((s) => s.id === id);
}

export function defaultStateDefinition(data: PlannerData): DayStateDefinition {
  const states = data.settings.dayStates;
  return (
    states.find((s) => s.builtIn) ??
    states[0] ?? {
      id: 'state_fallback',
      name: 'Normal',
      icon: 'sun',
      color: '#a78bfa',
      builtIn: true,
      defaultActive: true,
      categoryRules: {},
      sourceRules: {},
    }
  );
}

/**
 * Welcher Zustand gilt an einem Tag?
 * Reihenfolge: manuell gesetzt > besonderer Tag > Urlaubszeitraum > Standard.
 */
export function resolveDayState(data: PlannerData, date: DateKey): ResolvedDayState {
  const manual = findState(data, data.dailyStates[date]?.stateId);
  if (manual) return { definition: manual, origin: 'manual' };

  const special = data.specialDays.find((d) => d.date === date);
  const specialState = findState(data, special?.stateId);
  if (special && specialState) return { definition: specialState, origin: 'specialDay', label: special.name };

  const vacation = data.vacations.find((v) => v.startDate <= date && date <= v.endDate);
  const vacationState = findState(data, vacation?.stateId);
  if (vacation && vacationState) return { definition: vacationState, origin: 'vacation', label: vacation.name };

  return { definition: defaultStateDefinition(data), origin: 'default' };
}

/** Quellen-Regel > Kategorie-Regel > Standard des Zustands. */
export function isSourceActive(state: DayStateDefinition, sourceKey: SourceKey, categoryId?: ID): boolean {
  if (sourceKey in state.sourceRules) return state.sourceRules[sourceKey];
  if (categoryId && categoryId in state.categoryRules) return state.categoryRules[categoryId];
  return state.defaultActive;
}
