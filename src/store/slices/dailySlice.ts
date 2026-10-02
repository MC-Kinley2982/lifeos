import { nowIso } from '../../domain/ids';
import type { DailyState, DateKey, SpecialDay, Vacation } from '../../domain/types';
import { emptyDailyState } from '../../services/planner/dayState';
import { patchById, removeById } from '../helpers';
import type { AppState, DailyActions, SliceCreator } from '../types';

export interface DailySlice extends DailyActions {
  dailyStates: Record<DateKey, DailyState>;
  vacations: Vacation[];
  specialDays: SpecialDay[];
}

/** Aktualisiert den Tageszustand eines Datums (legt ihn bei Bedarf an). */
function patchDaily(state: AppState, date: DateKey, fn: (d: DailyState) => DailyState): Pick<AppState, 'dailyStates'> {
  const current = state.dailyStates[date] ?? emptyDailyState(date);
  return { dailyStates: { ...state.dailyStates, [date]: fn(current) } };
}

export const createDailySlice: SliceCreator<DailySlice> = (set) => ({
  dailyStates: {},
  vacations: [],
  specialDays: [],

  setDayState: (date, stateId) => set((state) => patchDaily(state, date, (d) => ({ ...d, stateId: stateId ?? undefined }))),

  setEnergy: (date, level) =>
    set((state) =>
      patchDaily(state, date, (d) => ({ ...d, energy: level ?? undefined, energyUpdatedAt: level ? nowIso() : undefined })),
    ),

  toggleSkipSource: (date, sourceKey) =>
    set((state) =>
      patchDaily(state, date, (d) => ({
        ...d,
        skippedSources: d.skippedSources.includes(sourceKey)
          ? d.skippedSources.filter((k) => k !== sourceKey)
          : [...d.skippedSources, sourceKey],
      })),
    ),

  setDayNote: (date, note) => set((state) => patchDaily(state, date, (d) => ({ ...d, note: note || undefined }))),

  addVacation: (v) => set((state) => ({ vacations: [...state.vacations, v] })),
  updateVacation: (id, patch) => set((state) => ({ vacations: patchById(state.vacations, id, patch) })),
  removeVacation: (id) => set((state) => ({ vacations: removeById(state.vacations, id) })),

  addSpecialDay: (d) => set((state) => ({ specialDays: [...state.specialDays, d] })),
  updateSpecialDay: (id, patch) => set((state) => ({ specialDays: patchById(state.specialDays, id, patch) })),
  removeSpecialDay: (id) => set((state) => ({ specialDays: removeById(state.specialDays, id) })),
});
