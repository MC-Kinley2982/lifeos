import { normalizeData } from '../../store/persistence';
import type { AppData } from '../../store/types';
import type { RemoteRecord } from '../cloud/types';

/**
 * Abbildung der App-Daten auf einzelne Datensätze ("records") für die Synchronisierung.
 * Jede Routine, Aufgabe, Hausaufgabe, … ist ein eigener Datensatz → Konflikte betreffen
 * immer nur einen Eintrag, nicht alles. Neue Bereiche brauchen keine Datenbank-Migration.
 */
export const LIST_COLLECTIONS = [
  'routines',
  'events',
  'tasks',
  'goals',
  'vacations',
  'specialDays',
  'subjects',
  'timetable',
  'homework',
  'exams',
  'todos',
] as const;

type ListCollection = (typeof LIST_COLLECTIONS)[number];

export interface LocalRecord {
  collection: string;
  id: string;
  data: unknown;
}

export const recordKey = (collection: string, id: string) => `${collection}/${id}`;

export function splitKey(key: string): { collection: string; id: string } {
  const i = key.indexOf('/');
  return { collection: key.slice(0, i), id: key.slice(i + 1) };
}

export function toRecords(data: AppData): Map<string, LocalRecord> {
  const map = new Map<string, LocalRecord>();
  map.set(recordKey('settings', 'main'), { collection: 'settings', id: 'main', data: data.settings });
  for (const c of LIST_COLLECTIONS) {
    for (const item of data[c] as Array<{ id: string }>) map.set(recordKey(c, item.id), { collection: c, id: item.id, data: item });
  }
  for (const [date, day] of Object.entries(data.dailyStates)) map.set(recordKey('dailyStates', date), { collection: 'dailyStates', id: date, data: day });
  return map;
}

/** Datensätze in die App-Daten übernehmen (unbekannte Bereiche werden ignoriert – vorwärtskompatibel). */
export function applyRecords(data: AppData, records: RemoteRecord[]): AppData {
  const next: AppData = { ...data, dailyStates: { ...data.dailyStates } };
  const lists = new Map<ListCollection, Map<string, unknown>>();
  const listOf = (c: ListCollection) => {
    if (!lists.has(c)) lists.set(c, new Map((data[c] as Array<{ id: string }>).map((x) => [x.id, x])));
    return lists.get(c)!;
  };

  for (const r of records) {
    if (r.collection === 'settings') {
      if (!r.deleted && r.data) next.settings = r.data as AppData['settings'];
    } else if (r.collection === 'dailyStates') {
      if (r.deleted || !r.data) delete next.dailyStates[r.id];
      else next.dailyStates[r.id] = r.data as AppData['dailyStates'][string];
    } else if ((LIST_COLLECTIONS as readonly string[]).includes(r.collection)) {
      const list = listOf(r.collection as ListCollection);
      if (r.deleted || !r.data) list.delete(r.id);
      else list.set(r.id, r.data);
    }
  }
  for (const [c, map] of lists) (next as unknown as Record<string, unknown[]>)[c] = [...map.values()];
  return normalizeData(next);
}

/** JSON mit sortierten Schlüsseln – gleiche Inhalte ergeben unabhängig von der Reihenfolge denselben Text. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** Schneller 53-Bit-Hash (cyrb53) als Fingerabdruck eines Datensatzes. */
export function hashValue(value: unknown): string {
  const str = stableStringify(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Kurze Übersicht für den Dialog "Lokale Daten gefunden". */
export interface DataSummary {
  routines: number;
  tasks: number;
  goals: number;
  subjects: number;
  homework: number;
  exams: number;
  events: number;
  todos: number;
}

export function summarize(data: AppData): DataSummary {
  return {
    routines: data.routines.length,
    tasks: data.tasks.length,
    goals: data.goals.length,
    subjects: data.subjects.length,
    homework: data.homework.length,
    exams: data.exams.length,
    events: data.events.length,
    todos: data.todos.length,
  };
}
