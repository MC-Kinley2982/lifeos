import type { EnergyLevel, Priority, TaskEnergy, TaskStatus, TimeOfDay } from './types';

/** Anzeige-Texte für Enums – zentral, damit UI und Services dieselben Begriffe nutzen. */

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  urgent: 'Dringend',
};

export const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low'];

export const ENERGY_LABEL: Record<EnergyLevel, string> = {
  1: 'Sehr niedrig',
  2: 'Niedrig',
  3: 'Normal',
  4: 'Hoch',
  5: 'Sehr hoch',
};

export const TASK_ENERGY_LABEL: Record<TaskEnergy, string> = {
  low: 'Wenig Energie',
  medium: 'Mittlere Energie',
  high: 'Viel Energie',
};

export const TASK_ENERGY_SHORT: Record<TaskEnergy, string> = {
  low: 'leicht',
  medium: 'mittel',
  high: 'anspruchsvoll',
};

export const TIME_OF_DAY_LABEL: Record<TimeOfDay, string> = {
  morning: 'Morgens',
  afternoon: 'Nachmittags',
  evening: 'Abends',
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Offen',
  in_progress: 'In Arbeit',
  done: 'Erledigt',
};
