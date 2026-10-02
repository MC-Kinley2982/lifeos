import { diffDays, formatDateShort, getWeekday, toHHMM, toMinutes, WEEKDAY_SHORT } from '../../domain/time';
import type { DateKey, HomeworkDeadline, SchoolBlock } from '../../domain/types';
import type { SchoolPlanResult } from '../../services/school/types';

/** "Heute", "Morgen", "Do" (innerhalb einer Woche) oder "08.10." */
export function dayShort(date: DateKey, today: DateKey): string {
  const d = diffDays(today, date);
  if (d === 0) return 'Heute';
  if (d === 1) return 'Morgen';
  if (d === -1) return 'Gestern';
  if (d > 1 && d < 7) return WEEKDAY_SHORT[getWeekday(date)];
  return formatDateShort(date);
}

export function formatDeadline(deadline: HomeworkDeadline, today: DateKey): string {
  return `${dayShort(deadline.date, today)}${deadline.time ? `, ${deadline.time}` : ''}`;
}

export function formatBlock(block: SchoolBlock, today: DateKey): string {
  return `${dayShort(block.date, today)} ${block.start}–${toHHMM(toMinutes(block.start) + block.durationMin)}`;
}

/** "Heute", "Morgen", "in 5 Tagen", "vor 2 Tagen" */
export function countdown(date: DateKey, today: DateKey): string {
  const d = diffDays(today, date);
  if (d === 0) return 'Heute';
  if (d === 1) return 'Morgen';
  if (d < 0) return `vor ${-d} Tag${d === -1 ? '' : 'en'}`;
  return `in ${d} Tagen`;
}

/** Kurze Rückmeldung nach dem automatischen Einplanen. */
export function planSummary(result: SchoolPlanResult): string {
  const added = result.added.length;
  const gaps = result.unplanned.length;
  if (added === 0 && gaps === 0) return 'Gespeichert';
  if (gaps === 0) return `Eingeplant: ${added} ${added === 1 ? 'Block' : 'Blöcke'}`;
  return `Eingeplant, aber ${gaps === 1 ? 'eine Aufgabe passt' : `${gaps} Aufgaben passen`} nicht ganz in deine freie Zeit`;
}
