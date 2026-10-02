import type { DateKey, ID, SchoolBlock, StudySession } from '../../domain/types';

export type SchoolWorkKind = 'homework' | 'exam';

export interface SchoolPlanOptions {
  /** Nur diese Hausaufgaben planen (sonst alle offenen). */
  homeworkIds?: ID[];
  /** Nur diese Tests planen (sonst alle anstehenden). */
  examIds?: ID[];
  /** Zukünftige automatisch geplante Blöcke verwerfen und neu planen (manuelle bleiben). */
  reset?: boolean;
  /**
   * Freizeit-Schutz für diese Einträge ausnahmsweise ignorieren
   * (nur nach ausdrücklicher Bestätigung durch den Nutzer).
   */
  overBudgetIds?: ID[];
}

export interface SchoolPlanAddition {
  owner: SchoolWorkKind;
  id: ID;
  title: string;
  block: SchoolBlock;
}

export interface SchoolPlanGap {
  owner: SchoolWorkKind;
  id: ID;
  title: string;
  /** So viele Minuten konnten nicht eingeplant werden. */
  missingMinutes: number;
  reason: string;
}

export interface SchoolPlanResult {
  /** Vollständige neue Blockliste je geänderter Hausaufgabe. */
  homework: Record<ID, SchoolBlock[]>;
  /** Vollständige neue Lerneinheiten je geändertem Test. */
  exams: Record<ID, StudySession[]>;
  added: SchoolPlanAddition[];
  unplanned: SchoolPlanGap[];
}

/** Fortschritt eines Tests. */
export interface StudyProgress {
  targetMin: number;
  doneMin: number;
  plannedMin: number;
  remainingMin: number;
  percent: number;
}

/** Zeitpunkt (Datum + Minuten seit Mitternacht). */
export interface Moment {
  date: DateKey;
  minute: number;
}
