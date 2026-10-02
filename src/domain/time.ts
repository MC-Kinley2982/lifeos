import type { DateKey, TimeHHMM, TimeSlot, Weekday } from './types';

export const MINUTES_PER_DAY = 24 * 60;

// ─── Uhrzeiten ───────────────────────────────────────────────

/** "08:30" → 510. Ungültige Werte ergeben 0. "24:00" ist erlaubt (= 1440). */
export function toMinutes(time: TimeHHMM): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time?.trim() ?? '');
  if (!match) return 0;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return Math.min(MINUTES_PER_DAY, Math.max(0, h * 60 + m));
}

/** 510 → "08:30". */
export function toHHMM(minutes: number): TimeHHMM {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isValidTime(time: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return false;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return (h < 24 && m < 60) || (h === 24 && m === 0);
}

/** 90 → "1 h 30 min", 45 → "45 min", 120 → "2 h". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** 105 → "1:45". Kompakt für Fortschrittsanzeigen ("1:45 / 3:00 h"). */
export function formatHoursClock(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function roundUpTo(minutes: number, step: number): number {
  if (step <= 1) return Math.ceil(minutes);
  return Math.ceil(minutes / step) * step;
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

// ─── Daten ───────────────────────────────────────────────────

export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Tage zwischen zwei Daten (b − a). */
export function diffDays(a: DateKey, b: DateKey): number {
  const ms = parseDateKey(b).getTime() - parseDateKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** 0 = Montag … 6 = Sonntag */
export function getWeekday(key: DateKey): Weekday {
  const jsDay = parseDateKey(key).getDay(); // 0 = Sonntag
  return ((jsDay + 6) % 7) as Weekday;
}

export function startOfWeek(key: DateKey, weekStartsOn: Weekday = 0): DateKey {
  const wd = getWeekday(key);
  const offset = (wd - weekStartsOn + 7) % 7;
  return addDays(key, -offset);
}

export function weekDays(key: DateKey, weekStartsOn: Weekday = 0): DateKey[] {
  const start = startOfWeek(key, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isDateInRange(key: DateKey, from?: DateKey, until?: DateKey): boolean {
  if (from && key < from) return false;
  if (until && key > until) return false;
  return true;
}

export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export const WEEKDAY_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;
export const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WORKDAYS: Weekday[] = [0, 1, 2, 3, 4];

/** Wochentage in Anzeige-Reihenfolge ab dem eingestellten Wochenstart. */
export function orderedWeekdays(weekStartsOn: Weekday = 0): Weekday[] {
  return Array.from({ length: 7 }, (_, i) => ((weekStartsOn + i) % 7) as Weekday);
}

export function formatDateLong(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateShort(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function formatDateMedium(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Heute", "Morgen", "Gestern" oder "Fr, 3. Okt." */
export function relativeDayLabel(key: DateKey, today: DateKey): string {
  const diff = diffDays(today, key);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff === -1) return 'Gestern';
  return formatDateMedium(key);
}

// ─── Zeit-Intervalle ─────────────────────────────────────────

/** Vereinigt überlappende/angrenzende Intervalle (Ergebnis sortiert). */
export function mergeSlots(slots: TimeSlot[]): TimeSlot[] {
  const sorted = slots.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  const out: TimeSlot[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else out.push({ start: s.start, end: s.end });
  }
  return out;
}

/** Zieht `cut` von `base` ab. */
export function subtractSlots(base: TimeSlot[], cut: TimeSlot[]): TimeSlot[] {
  const cuts = mergeSlots(cut);
  const out: TimeSlot[] = [];
  for (const b of mergeSlots(base)) {
    let pieces: TimeSlot[] = [{ ...b }];
    for (const c of cuts) {
      const next: TimeSlot[] = [];
      for (const p of pieces) {
        if (c.end <= p.start || c.start >= p.end) {
          next.push(p);
          continue;
        }
        if (c.start > p.start) next.push({ start: p.start, end: c.start });
        if (c.end < p.end) next.push({ start: c.end, end: p.end });
      }
      pieces = next;
    }
    out.push(...pieces);
  }
  return out.filter((s) => s.end > s.start);
}

/** Schnittmenge zweier Intervall-Listen. */
export function intersectSlots(a: TimeSlot[], b: TimeSlot[]): TimeSlot[] {
  const out: TimeSlot[] = [];
  for (const x of mergeSlots(a)) {
    for (const y of mergeSlots(b)) {
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (end > start) out.push({ start, end });
    }
  }
  return mergeSlots(out);
}

export function totalMinutes(slots: TimeSlot[]): number {
  return slots.reduce((sum, s) => sum + (s.end - s.start), 0);
}

export function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  return a.start < b.end && b.start < a.end;
}
