import { nowIso } from '../domain/ids';

/** Kleine, unveränderliche Listen-Helfer für die Slices. */

export function patchById<T extends { id: string }>(list: T[], id: string, patch: Partial<NoInfer<T>>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function patchEntity<T extends { id: string; updatedAt: string }>(list: T[], id: string, patch: Partial<NoInfer<T>>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item));
}

export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}

export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

export function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = record;
  return rest;
}
