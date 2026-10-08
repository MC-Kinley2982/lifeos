import { MINUTES_PER_DAY, toMinutes } from '../../domain/time';
import type { ProtectedPeriod, ProtectedSlot, TimeSlot, Weekday } from '../../domain/types';

/**
 * Geschützte Zeiträume eines Tages (z. B. Morgenroutine, Familienzeit).
 * "Ab dem Aufstehen" bzw. "bis zum Schlafengehen" richten sich nach der Wachzeit dieses Tages,
 * damit z. B. die Morgenroutine am Wochenende mit dem späteren Aufstehen mitwandert.
 * Die Zeit darin bleibt freie Zeit – sie steht nur nicht für die automatische Planung zur Verfügung.
 */
export function protectedSlotsFor(periods: ProtectedPeriod[] | undefined, weekday: Weekday, awake: TimeSlot): ProtectedSlot[] {
  const out: ProtectedSlot[] = [];
  for (const p of periods ?? []) {
    if (!p.enabled || !p.weekdays.includes(weekday)) continue;
    const start = p.from.at === 'wake' ? awake.start : toMinutes(p.from.time);
    const end =
      p.until.at === 'time' ? toMinutes(p.until.time) : p.until.at === 'duration' ? start + Math.max(0, p.until.minutes) : awake.end;
    const from = Math.max(0, start);
    const to = Math.min(MINUTES_PER_DAY, end);
    if (to > from) out.push({ start: from, end: to, periodId: p.id, name: p.name.trim() || 'Geschützte Zeit' });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Geschützter Zeitraum, der eine bestimmte Minute enthält. */
export function protectedAt(slots: ProtectedSlot[] | undefined, minute: number): ProtectedSlot | undefined {
  return slots?.find((s) => s.start <= minute && minute < s.end);
}
