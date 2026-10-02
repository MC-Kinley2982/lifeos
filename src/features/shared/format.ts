import { WEEKDAY_SHORT } from '../../domain/time';
import type { Weekday } from '../../domain/types';

/** [0,1,2,3,4] → "Mo–Fr", alle → "Täglich", [5,6] → "Sa, So". */
export function formatWeekdays(days: Weekday[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return 'Keine Tage';
  if (sorted.length === 7) return 'Täglich';
  const isRun = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isRun && sorted.length >= 3) return `${WEEKDAY_SHORT[sorted[0]]}–${WEEKDAY_SHORT[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(', ');
}
