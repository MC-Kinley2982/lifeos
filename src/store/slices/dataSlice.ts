import { createDefaultSettings, createExampleData } from '../../domain/defaults';
import { STORAGE_VERSION } from '../../services/storage/storage';
import { emptyData, migrate, normalizeData, pickData } from '../persistence';
import type { DataActions, SliceCreator } from '../types';

export const createDataSlice: SliceCreator<DataActions> = (set, get) => ({
  completeOnboarding: ({ name, withExample, today }) => {
    if (withExample) {
      const ex = createExampleData(today, name);
      set({ ...emptyData(), ...ex, settings: { ...ex.settings, onboardingDone: true } });
    } else {
      const settings = createDefaultSettings(name);
      set({ ...emptyData(), settings: { ...settings, onboardingDone: true } });
    }
  },

  exportData: () =>
    JSON.stringify({ app: 'lifeos', version: STORAGE_VERSION, exportedAt: new Date().toISOString(), data: pickData(get()) }, null, 2),

  importData: (json) => {
    try {
      const parsed = JSON.parse(json);
      const payload = parsed?.app === 'lifeos' ? parsed.data : parsed;
      if (!payload || typeof payload !== 'object' || !payload.settings) {
        return { ok: false, error: 'Die Datei enthält keine gültigen LifeOS-Daten.' };
      }
      const data = normalizeData(migrate(payload, Number(parsed?.version ?? STORAGE_VERSION)));
      set({ ...data, settings: { ...data.settings, onboardingDone: true } });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Die Datei konnte nicht gelesen werden (kein gültiges JSON).' };
    }
  },

  resetAll: () => set(emptyData()),
});
