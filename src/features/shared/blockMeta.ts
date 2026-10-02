import { Bed, BookOpenCheck, CalendarClock, Car, ClipboardList, Coffee, GraduationCap, NotebookPen, Repeat, SquareCheck, Utensils, type LucideIcon } from 'lucide-react';
import type { BlockKind } from '../../domain/types';

export const BLOCK_ICON: Record<BlockKind, LucideIcon> = {
  sleep: Bed,
  meal: Utensils,
  routine: Repeat,
  event: CalendarClock,
  travel: Car,
  break: Coffee,
  task: SquareCheck,
  school: GraduationCap,
  homework: NotebookPen,
  study: BookOpenCheck,
  exam: ClipboardList,
};

export const BLOCK_KIND_LABEL: Record<BlockKind, string> = {
  sleep: 'Schlaf',
  meal: 'Essen',
  routine: 'Routine',
  event: 'Termin',
  travel: 'Weg',
  break: 'Pause',
  task: 'Aufgabe',
  school: 'Schule',
  homework: 'Hausaufgabe',
  study: 'Lernen',
  exam: 'Test',
};
