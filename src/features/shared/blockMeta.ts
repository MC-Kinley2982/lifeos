import { Bed, Car, SquareCheck, Coffee, Repeat, CalendarClock, Utensils, type LucideIcon } from 'lucide-react';
import type { BlockKind } from '../../domain/types';

export const BLOCK_ICON: Record<BlockKind, LucideIcon> = {
  sleep: Bed,
  meal: Utensils,
  routine: Repeat,
  event: CalendarClock,
  travel: Car,
  break: Coffee,
  task: SquareCheck,
};

export const BLOCK_KIND_LABEL: Record<BlockKind, string> = {
  sleep: 'Schlaf',
  meal: 'Essen',
  routine: 'Routine',
  event: 'Termin',
  travel: 'Weg',
  break: 'Pause',
  task: 'Aufgabe',
};
