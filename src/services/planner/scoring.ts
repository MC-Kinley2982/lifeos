import { diffDays } from '../../domain/time';
import type { DateKey, Priority } from '../../domain/types';

/**
 * Gemeinsame, nachvollziehbare Bewertungsregeln für Auto-Planung und "Was soll ich jetzt machen?".
 * Jede Regel liefert Punkte + eine lesbare Begründung.
 */
export interface ScorePart {
  points: number;
  reason?: string;
}

export function urgencyScore(deadline: DateKey | undefined, today: DateKey): ScorePart {
  if (!deadline) return { points: 0 };
  const days = diffDays(today, deadline);
  if (days < 0) return { points: 100, reason: 'Überfällig' };
  if (days === 0) return { points: 80, reason: 'Deadline heute' };
  if (days === 1) return { points: 60, reason: 'Deadline morgen' };
  if (days <= 3) return { points: 40, reason: `Deadline in ${days} Tagen` };
  if (days <= 7) return { points: 20, reason: 'Deadline diese Woche' };
  return { points: 5 };
}

export function priorityScore(priority: Priority): ScorePart {
  switch (priority) {
    case 'urgent':
      return { points: 50, reason: 'Dringend' };
    case 'high':
      return { points: 30, reason: 'Hohe Priorität' };
    case 'medium':
      return { points: 15 };
    default:
      return { points: 0 };
  }
}
