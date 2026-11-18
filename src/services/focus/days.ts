import type { DateKey, FocusDay, FocusEntry, Goal } from '../../domain/types';

/**
 * Rechnerzeit aus dem Focus Co-Pilot (reine Logik).
 *
 * Der Co-Pilot schreibt pro Tag einen Datensatz `FocusDay` in die Cloud; LifeOS liest ihn nur.
 * Ein Ziel nennt über `focusMatch` die Namen (Gruppe, App oder Website), die für es zählen.
 */

export const normalizeName = (name: string): string => name.trim().toLocaleLowerCase('de-DE');

const sum = (entries: Array<{ minutes: number }>): number => entries.reduce((s, e) => s + Math.max(0, e.minutes), 0);

/** Prüft grob, ob ein synchronisierter Datensatz wirklich ein Tag des Co-Pilots ist (Schutz vor Müll in der Cloud). */
export function isFocusDay(value: unknown): value is FocusDay {
  if (!value || typeof value !== 'object') return false;
  const d = value as Partial<FocusDay>;
  return (
    typeof d.id === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(d.date ?? '') &&
    typeof d.totalMin === 'number' &&
    Array.isArray(d.groups) &&
    !!d.byCategory &&
    typeof d.byCategory === 'object'
  );
}

/**
 * Minuten, die ein Ziel an diesem Tag vom Rechner bekommt.
 * Je Name zählt zuerst eine Gruppe des Co-Pilots (sie enthält ihre Apps schon); nur ohne Gruppe dieses Namens
 * zählen gleichnamige Apps/Websites. Gleichnamige Gruppen sind meist dasselbe → der größere Wert gilt.
 */
export function focusMinutesFor(goal: Pick<Goal, 'focusMatch'>, day: FocusDay | undefined): number {
  if (!day) return 0;
  const names = [...new Set((goal.focusMatch ?? []).map(normalizeName).filter(Boolean))];
  let total = 0;
  for (const name of names) {
    const groups = day.groups.filter((g) => normalizeName(g.name) === name);
    if (groups.length) total += Math.max(...groups.map((g) => Math.max(0, g.minutes)));
    else total += sum((day.activities ?? []).filter((a) => normalizeName(a.name) === name));
  }
  return Math.round(total);
}

export function focusDayMap(days: readonly FocusDay[] | undefined): Map<DateKey, FocusDay> {
  return new Map((days ?? []).map((d) => [d.date, d]));
}

export interface FocusWeek {
  /** An wie vielen Tagen der Co-Pilot etwas erfasst hat. */
  daysTracked: number;
  totalMin: number;
  byCategory: { productive: number; neutral: number; unproductive: number };
  groups: FocusEntry[];
  activities: Array<FocusEntry & { kind?: 'app' | 'web' }>;
  perDay: Array<{ date: DateKey; totalMin: number }>;
}

function merge<T extends FocusEntry>(into: Map<string, T>, entries: readonly T[] | undefined) {
  for (const e of entries ?? []) {
    const key = normalizeName(e.name);
    if (!key || !(e.minutes > 0)) continue;
    const have = into.get(key);
    if (have) have.minutes += e.minutes;
    else into.set(key, { ...e });
  }
}

/** Rechnerzeit einer Woche (oder eines beliebigen Zeitraums) zusammengefasst – größte Einträge zuerst. */
export function focusWeek(days: readonly FocusDay[] | undefined, dates: readonly DateKey[]): FocusWeek {
  const map = focusDayMap(days);
  const groups = new Map<string, FocusEntry>();
  const activities = new Map<string, FocusEntry & { kind?: 'app' | 'web' }>();
  const byCategory = { productive: 0, neutral: 0, unproductive: 0 };
  const perDay: FocusWeek['perDay'] = [];
  let totalMin = 0;
  for (const date of dates) {
    const day = map.get(date);
    if (!day) continue;
    totalMin += day.totalMin;
    perDay.push({ date, totalMin: day.totalMin });
    byCategory.productive += day.byCategory.productive ?? 0;
    byCategory.neutral += day.byCategory.neutral ?? 0;
    byCategory.unproductive += day.byCategory.unproductive ?? 0;
    merge(groups, day.groups);
    merge(activities, day.activities);
  }
  const byMinutes = <T extends FocusEntry>(a: T, b: T) => b.minutes - a.minutes;
  return {
    daysTracked: perDay.length,
    totalMin,
    byCategory,
    groups: [...groups.values()].sort(byMinutes),
    activities: [...activities.values()].sort(byMinutes),
    perDay,
  };
}

export interface KnownFocusName {
  name: string;
  kind: 'group' | 'app' | 'web';
  /** Summe über alle bekannten Tage – nur zum Sortieren der Vorschläge. */
  minutes: number;
}

/** Alle Namen, die der Co-Pilot schon geliefert hat – als Vorschläge für `focusMatch` (Gruppen zuerst). */
export function knownFocusNames(days: readonly FocusDay[] | undefined): KnownFocusName[] {
  const out = new Map<string, KnownFocusName>();
  const add = (name: string, kind: KnownFocusName['kind'], minutes: number) => {
    const key = normalizeName(name);
    if (!key) return;
    const have = out.get(key);
    if (!have) out.set(key, { name, kind, minutes });
    else {
      have.minutes += minutes;
      if (kind === 'group') have.kind = 'group';
    }
  };
  for (const d of days ?? []) {
    for (const g of d.groups) add(g.name, 'group', g.minutes);
    for (const a of d.activities ?? []) add(a.name, a.kind === 'web' ? 'web' : 'app', a.minutes);
  }
  const rank = (k: KnownFocusName) => (k.kind === 'group' ? 0 : 1);
  return [...out.values()].sort((a, b) => rank(a) - rank(b) || b.minutes - a.minutes);
}
