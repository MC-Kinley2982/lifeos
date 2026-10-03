import type {
  CalendarEvent,
  DailyState,
  DateKey,
  EnergyLevel,
  EnergyState,
  Exam,
  Goal,
  Homework,
  ID,
  Routine,
  ScheduleBlock,
  Settings,
  SpecialDay,
  Subject,
  Task,
  TaskEnergy,
  TimetableEntry,
  Vacation,
} from '../../domain/types';

/**
 * Alles, was die Planung braucht – ein reiner Daten-Snapshot.
 * Der Planer kennt weder React noch den Store; er bekommt diese Daten übergeben.
 * Externe Quellen (z. B. Google Calendar) werden später vorher in `events` gemerged.
 */
export interface PlannerData {
  settings: Settings;
  routines: Routine[];
  events: CalendarEvent[];
  tasks: Task[];
  goals: Goal[];
  dailyStates: Record<DateKey, DailyState>;
  vacations: Vacation[];
  specialDays: SpecialDay[];
  subjects: Subject[];
  timetable: TimetableEntry[];
  homework: Homework[];
  exams: Exam[];
}

export interface PlanItem {
  id: string;
  kind: 'task' | 'goal';
  taskId?: ID;
  goalId?: ID;
  title: string;
  date: DateKey;
  start: number;
  end: number;
  energy: TaskEnergy;
  estimatedEnergy: EnergyLevel;
  reasons: string[];
}

export interface UnplannedItem {
  taskId?: ID;
  goalId?: ID;
  title: string;
  reason: string;
}

export interface PlanDaySummary {
  date: DateKey;
  freeMin: number;
  budgetMin: number;
  plannedMin: number;
}

export interface PlanResult {
  items: PlanItem[];
  unplanned: UnplannedItem[];
  days: PlanDaySummary[];
}

export interface PlanOptions {
  dates: DateKey[];
  now: Date;
  /** Wöchentliche Ziele mit Einheiten auffüllen. */
  includeGoals: boolean;
  /** Nur diese Aufgaben planen (optional). */
  taskIds?: ID[];
  /** Frühere Tage deutlich bevorzugen – beim Verschieben soll es nicht unnötig weit nach hinten gehen. */
  preferSoon?: boolean;
}

export interface SuggestionItem {
  key: string;
  task?: Task;
  goal?: Goal;
  homework?: Homework;
  exam?: Exam;
  /** Geplanter Block, der gerade läuft (Hausaufgabe/Lernen). */
  blockId?: ID;
  title: string;
  minutes: number;
  /** Nur ein Teil der Aufgabe passt in die verfügbare Zeit. */
  partial: boolean;
  reasons: string[];
}

export type SuggestionMode = 'tasks' | 'free' | 'rest' | 'night' | 'short';

export interface NowSuggestion {
  mode: SuggestionMode;
  headline: string;
  lines: string[];
  energy: EnergyState;
  /** Ab wann der Vorschlag gilt (Minuten) – jetzt oder nach dem laufenden Block. */
  fromMinute: number;
  availableMin: number;
  currentBlock?: ScheduleBlock;
  nextBlock?: ScheduleBlock;
  items: SuggestionItem[];
  /** Aufgaben, die gerade zu viel Energie bräuchten. */
  laterForEnergy: SuggestionItem[];
}

export interface GoalProgress {
  goalId: ID;
  targetMin: number;
  doneMin: number;
  plannedMin: number;
  remainingMin: number;
  percent: number;
}
