import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage, STORAGE_KEY, STORAGE_VERSION } from '../services/storage/storage';
import { migrate, normalizeData, pickData } from './persistence';
import { createDailySlice } from './slices/dailySlice';
import { createDataSlice } from './slices/dataSlice';
import { createEventsSlice } from './slices/eventsSlice';
import { createGoalsSlice } from './slices/goalsSlice';
import { createRoutinesSlice } from './slices/routinesSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createTasksSlice } from './slices/tasksSlice';
import type { AppData, AppState } from './types';

/**
 * Zentraler App-Store.
 * Bereiche: settings · routines · events · tasks · goals · dailyStates (+ vacations, specialDays).
 * Persistiert in localStorage; nur Daten werden gespeichert, keine Funktionen.
 */
export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createSettingsSlice(...a),
      ...createRoutinesSlice(...a),
      ...createEventsSlice(...a),
      ...createTasksSlice(...a),
      ...createGoalsSlice(...a),
      ...createDailySlice(...a),
      ...createDataSlice(...a),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: appStorage,
      partialize: (state) => pickData(state),
      migrate: (persisted, version) => migrate(persisted, version) as AppState,
      merge: (persisted, current) => ({ ...current, ...normalizeData(persisted as Partial<AppData>) }),
    },
  ),
);
