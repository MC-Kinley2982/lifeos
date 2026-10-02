import type { ID, SourceKey } from './types';

/** Hilfen für SourceKeys ("sleep", "meal:<id>", "routine:<id>"). */
export const SLEEP_SOURCE: SourceKey = 'sleep';

export const mealSource = (id: ID): SourceKey => `meal:${id}`;
export const routineSource = (id: ID): SourceKey => `routine:${id}`;
export const eventSource = (id: ID): SourceKey => `event:${id}`;
export const taskSource = (id: ID): SourceKey => `task:${id}`;
/** Schulzeit aus dem Stundenplan, wenn keine Routine verknüpft ist. */
export const SCHOOL_SOURCE: SourceKey = 'school';
export const homeworkSource = (id: ID): SourceKey => `homework:${id}`;
export const examSource = (id: ID): SourceKey => `exam:${id}`;

export function parseSource(key: SourceKey): { type: string; id?: ID } {
  const idx = key.indexOf(':');
  if (idx === -1) return { type: key };
  return { type: key.slice(0, idx), id: key.slice(idx + 1) };
}
