/**
 * Zentrales Datenmodell der App.
 *
 * Regeln:
 * - Keine React-Abhängigkeiten in diesem Ordner.
 * - Gespeicherte Daten verwenden Strings für Uhrzeiten ("HH:MM") und Daten ("YYYY-MM-DD"),
 *   damit sie serialisierbar und später leicht mit Cloud/Google Calendar austauschbar sind.
 * - Berechnete Daten (ScheduleBlock, EnergyState, …) werden nie gespeichert,
 *   sondern von den Services in `src/services/planner` abgeleitet.
 */

export type ID = string;
/** Uhrzeit im Format "HH:MM" (24h). */
export type TimeHHMM = string;
/** Lokales Datum im Format "YYYY-MM-DD". */
export type DateKey = string;
/** ISO-Zeitstempel. */
export type ISODateTime = string;

/** 0 = Montag … 6 = Sonntag */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

/** Energie-Level 1 (sehr niedrig) bis 5 (sehr hoch). */
export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

/** Benötigte Energie für eine Aufgabe. Schwellwerte sind in den Planungs-Einstellungen konfigurierbar. */
export type TaskEnergy = 'low' | 'medium' | 'high';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

/**
 * Eindeutige Referenz auf eine Quelle im Tagesplan.
 * Wird von Zustandsregeln, Pausenregeln und Energie-Regeln benutzt.
 *   "sleep" | "meal:<id>" | "routine:<id>"
 */
export type SourceKey = string;

// ─────────────────────────────────────────────────────────────
// Profil & Einstellungen
// ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: ID;
  name: string;
  createdAt: ISODateTime;
}

export interface Category {
  id: ID;
  name: string;
  color: string;
  /** Schlüssel aus der Icon-Registry der UI. */
  icon: string;
}

export interface SleepTimes {
  /** Wann ich an diesem Tag aufstehe. */
  wakeTime: TimeHHMM;
  /** Wann ich am Abend dieses Tages schlafen gehe (< 12:00 = nach Mitternacht). */
  bedtime: TimeHHMM;
}

export interface SleepSettings {
  enabled: boolean;
  default: SleepTimes;
  /** Optionale Abweichungen pro Wochentag. */
  perWeekday: Partial<Record<Weekday, SleepTimes>>;
  color: string;
}

export interface Meal {
  id: ID;
  name: string;
  time: TimeHHMM;
  durationMin: number;
  weekdays: Weekday[];
  enabled: boolean;
  color: string;
}

export type BreakTrigger =
  | { type: 'afterSource'; sourceKey: SourceKey }
  | { type: 'afterCategory'; categoryId: ID }
  | { type: 'afterLongBlock'; minBlockMin: number };

export interface BreakRule {
  id: ID;
  name: string;
  enabled: boolean;
  trigger: BreakTrigger;
  durationMin: number;
}

export interface EnergyTimeWindow {
  id: ID;
  label: string;
  start: TimeHHMM;
  end: TimeHHMM;
  level: EnergyLevel;
}

export interface EnergyCategoryRule {
  id: ID;
  categoryId: ID;
  /** Energie während einer Aktivität dieser Kategorie (optional). */
  duringLevel?: EnergyLevel;
  /** Energie direkt danach (optional) … */
  afterLevel?: EnergyLevel;
  /** … für so viele Minuten, oder bis eine Pause stattfindet. */
  afterDurationMin: number;
}

export interface EnergySettings {
  /** Fallback, wenn kein Zeitfenster greift. */
  baseline: EnergyLevel;
  timeWindows: EnergyTimeWindow[];
  categoryRules: EnergyCategoryRule[];
}

/**
 * Konfigurierbarer Tageszustand (Normal, Krank, Urlaub, …).
 * Bestimmt, welche Routinen/Mahlzeiten/Schlaf an so einem Tag gelten.
 */
export interface DayStateDefinition {
  id: ID;
  name: string;
  icon: string;
  color: string;
  /** Eingebaute Zustände (z. B. "normal") können nicht gelöscht werden. */
  builtIn: boolean;
  /** Gilt für Quellen, für die weder Quellen- noch Kategorie-Regel existiert. */
  defaultActive: boolean;
  /** Regeln pro Kategorie (z. B. Schule → pausiert). Greift für alle Routinen dieser Kategorie. */
  categoryRules: Record<ID, boolean>;
  /** Explizite Regeln pro Quelle – haben Vorrang vor Kategorie-Regeln. true = aktiv, false = pausiert. */
  sourceRules: Record<SourceKey, boolean>;
  /** Optionale Energie-Obergrenze, z. B. Krank → max. 2. */
  energyCap?: EnergyLevel;
  /** Optional: An solchen Tagen höchstens diesen Anteil der freien Zeit verplanen (0–1), z. B. Krank → 0,3. */
  maxPlannedShare?: number;
  /** Hinweis, der in der Tagesansicht angezeigt wird. */
  message?: string;
}

export interface WorkWindow {
  id: ID;
  weekdays: Weekday[];
  start: TimeHHMM;
  end: TimeHHMM;
}

export interface PlanningSettings {
  /** Freie Lücken unter dieser Länge werden ignoriert. */
  minSlotMin: number;
  /** Planungs-Raster in Minuten (Startzeiten werden darauf gerundet). */
  granularityMin: number;
  /** Puffer zwischen zwei geplanten Aufgaben. */
  bufferBetweenTasksMin: number;
  /** Nach so viel ununterbrochener Arbeit wird eine Pause eingeplant. */
  maxFocusMin: number;
  breakAfterFocusMin: number;
  /** Maximaler Anteil der freien Zeit, der automatisch verplant wird (0–1). */
  maxPlannedShare: number;
  /** So viel Freizeit pro Tag bleibt immer unverplant. */
  minFreeTimeMin: number;
  /** Nur innerhalb bevorzugter Arbeitszeiten planen. */
  useWorkWindows: boolean;
  workWindows: WorkWindow[];
  /** Grenzen der Tageszeiten für "bevorzugte Tageszeit". */
  afternoonStarts: TimeHHMM;
  eveningStarts: TimeHHMM;
  /** Mindest-Energie, die eine Aufgabe je Stufe braucht. */
  energyRequirement: Record<TaskEnergy, EnergyLevel>;
  /** Standard-Sitzungslänge, wenn Ziele automatisch eingeplant werden. */
  defaultGoalSessionMin: number;
}

export interface UiSettings {
  /** 0 = Montag, 6 = Sonntag */
  weekStartsOn: Weekday;
}

export interface SchoolSettings {
  enabled: boolean;
  /**
   * Routine, deren Zeiten an Tagen mit Stundenplan aus dem Stundenplan kommen (z. B. "Schule").
   * Weg, Pausen-, Zustands- und Energie-Regeln dieser Routine gelten dann für die Schulzeit weiter.
   */
  linkedRoutineId?: ID;
  /** Kategorie der Schulzeit, wenn keine Routine verknüpft ist (für Zustands-, Pausen- und Energie-Regeln). */
  categoryId: ID;
  /** Schulweg, wenn keine Routine verknüpft ist. */
  travelBeforeMin: number;
  travelAfterMin: number;
  /** Kategorie für Hausaufgaben- und Lernblöcke. */
  workCategoryId: ID;
  /** Durchschnittliche Hausaufgabenzeit – Standard für neue Hausaufgaben. */
  defaultHomeworkMinutes: number;
  defaultHomeworkPriority: Priority;
  /** Nach Schulschluss nach neuen Hausaufgaben fragen. */
  askForHomework: boolean;
  /** Hausaufgaben und Lernzeit automatisch in freie Zeit einplanen. */
  autoPlan: boolean;
  /** Hausaufgaben dürfen auf mehrere Blöcke verteilt werden. */
  allowSplitHomework: boolean;
  /** Kleinster sinnvoller Arbeitsblock. */
  minBlockMin: number;
  /** Anteil der freien Zeit, den Schulaufgaben höchstens belegen dürfen (statt des allgemeinen Planungsanteils). */
  maxSchoolShare: number;
  /** Wird kein nächster Unterricht gefunden: Deadline nach so vielen Tagen. */
  fallbackDeadlineDays: number;
  /** So weit im Voraus wird nach der nächsten Stunde eines Fachs gesucht. */
  lookaheadDays: number;
  /** Standard für neue Tests. */
  defaultStudyMinutes: number;
  /** So viele Tage vor einem Test beginnt die Lernzeit (wenn kein eigener Start gesetzt ist). */
  defaultStudyLeadDays: number;
  defaultStudySessionMin: number;
  /** Höchstens so viel Lernzeit pro Tag und Test. */
  maxStudyMinPerDay: number;
}

export interface Settings {
  profile: UserProfile;
  onboardingDone: boolean;
  sleep: SleepSettings;
  meals: Meal[];
  breakRules: BreakRule[];
  energy: EnergySettings;
  dayStates: DayStateDefinition[];
  categories: Category[];
  planning: PlanningSettings;
  school: SchoolSettings;
  ui: UiSettings;
}

// ─────────────────────────────────────────────────────────────
// Routinen, Termine, Aufgaben, Ziele
// ─────────────────────────────────────────────────────────────

export interface Routine {
  id: ID;
  name: string;
  description?: string;
  categoryId: ID;
  color: string;
  weekdays: Weekday[];
  start: TimeHHMM;
  end: TimeHHMM;
  priority: Priority;
  /** Blockiert die Routine freie Zeit? (z. B. "Lesen (optional)" → nein) */
  blocksFreeTime: boolean;
  enabled: boolean;
  /** Weg-/Vorbereitungszeit vor bzw. nach der Routine. */
  travelBeforeMin: number;
  travelAfterMin: number;
  /** Optionaler Gültigkeitszeitraum (z. B. Schuljahr). */
  validFrom?: DateKey;
  validUntil?: DateKey;
  /** Zeit zählt automatisch auf dieses Ziel ein. */
  goalId?: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Herkunft eines Termins – Grundlage für spätere Synchronisierung (Google Calendar …). */
export type EventSource = 'local' | 'google';

export interface CalendarEvent {
  id: ID;
  title: string;
  description?: string;
  location?: string;
  date: DateKey;
  start: TimeHHMM;
  end: TimeHHMM;
  allDay: boolean;
  categoryId: ID;
  color?: string;
  blocksFreeTime: boolean;
  travelBeforeMin: number;
  travelAfterMin: number;
  goalId?: ID;
  source: EventSource;
  /** ID im externen System (z. B. Google-Event-ID). */
  externalId?: string;
  calendarId?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface TaskSchedule {
  date: DateKey;
  /** Ohne Startzeit = "an diesem Tag erledigen", mit Startzeit = fester Block im Tagesplan. */
  start?: TimeHHMM;
  /** Von der automatischen Planung gesetzt – darf zum Schutz der Freizeit verschoben werden. */
  auto?: boolean;
}

export interface Task {
  id: ID;
  title: string;
  description?: string;
  estimatedMin: number;
  deadline?: DateKey;
  priority: Priority;
  categoryId: ID;
  goalId?: ID;
  energy: TaskEnergy;
  preferredTimeOfDay?: TimeOfDay;
  status: TaskStatus;
  schedule?: TaskSchedule;
  /** Tatsächlich investierte Zeit (optional, sonst zählt die Schätzung). */
  actualMin?: number;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type GoalTarget = { type: 'weeklyMinutes'; minutes: number };

export interface GoalLogEntry {
  id: ID;
  date: DateKey;
  minutes: number;
  note?: string;
}

export interface Goal {
  id: ID;
  title: string;
  description?: string;
  color: string;
  categoryId: ID;
  target: GoalTarget;
  /** Bevorzugte Länge einer automatisch geplanten Einheit. */
  sessionMin: number;
  energy: TaskEnergy;
  preferredTimeOfDay?: TimeOfDay;
  active: boolean;
  log: GoalLogEntry[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ─────────────────────────────────────────────────────────────
// Schule: Fächer, Stundenplan, Hausaufgaben, Tests
// ─────────────────────────────────────────────────────────────

export interface Subject {
  id: ID;
  name: string;
  /** Kurzform für kompakte Anzeigen, z. B. "Ma". */
  shortName?: string;
  color: string;
  teacher?: string;
  room?: string;
  /**
   * Optionale Ø-Hausaufgabenzeit für dieses Fach – überschreibt den allgemeinen Standard.
   * (Vorbereitet, um später Durchschnittswerte pro Fach automatisch zu lernen.)
   */
  homeworkMinutes?: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TimetableEntry {
  id: ID;
  subjectId: ID;
  weekday: Weekday;
  start: TimeHHMM;
  end: TimeHHMM;
  teacher?: string;
  room?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Geplanter Arbeitsblock für eine Hausaufgabe bzw. Lerneinheit für einen Test. */
export interface SchoolBlock {
  id: ID;
  date: DateKey;
  start: TimeHHMM;
  durationMin: number;
  /** auto = vom Planer gesetzt, manual = vom Nutzer gesetzt oder verschoben (wird nie automatisch bewegt). */
  source: 'auto' | 'manual';
  done: boolean;
}

/** Lerneinheit für einen Test. */
export type StudySession = SchoolBlock;

export interface HomeworkDeadline {
  date: DateKey;
  /** Beginn der Stunde, vor der die Hausaufgabe fertig sein muss. */
  time?: TimeHHMM;
  /** nextLesson = aus dem Stundenplan, fallback = keine Stunde gefunden, manual = selbst gesetzt */
  source: 'nextLesson' | 'fallback' | 'manual';
}

export interface Homework {
  id: ID;
  subjectId: ID;
  /** Aufgabe, z. B. "S. 43 Nr. 3–7". */
  title: string;
  description?: string;
  note?: string;
  estimatedMinutes: number;
  priority: Priority;
  energy: TaskEnergy;
  /** Tag, an dem die Hausaufgabe aufgegeben wurde. */
  assignedDate: DateKey;
  deadline: HomeworkDeadline;
  status: TaskStatus;
  plannedBlocks: SchoolBlock[];
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Exam {
  id: ID;
  subjectId: ID;
  /** z. B. "Klassenarbeit", "Vokabeltest". */
  title: string;
  date: DateKey;
  startTime?: TimeHHMM;
  endTime?: TimeHHMM;
  room?: string;
  notes?: string;
  priority: Priority;
  energy: TaskEnergy;
  /** Gewünschte Lernzeit insgesamt in Minuten (0 = kein Lernplan). */
  desiredStudyMinutes: number;
  /** Lernbeginn – sonst gilt der Standard-Vorlauf aus den Einstellungen. */
  studyStartDate?: DateKey;
  /** Bevorzugte Länge einer Lerneinheit. */
  sessionMinutes?: number;
  preferredTimeOfDay?: TimeOfDay;
  studySessions: StudySession[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ─────────────────────────────────────────────────────────────
// Tageszustand, Urlaub, besondere Tage
// ─────────────────────────────────────────────────────────────

export interface DailyState {
  date: DateKey;
  /** Manuell gewählter Zustand – überschreibt besondere Tage und Urlaub. */
  stateId?: ID;
  /** Manuelle Energie – gilt für den ganzen Tag. */
  energy?: EnergyLevel;
  energyUpdatedAt?: ISODateTime;
  /** Einzelne Quellen nur heute auslassen (z. B. "Fußball fällt aus"). */
  skippedSources: SourceKey[];
  note?: string;
  /** Nachfrage "Welche Hausaufgaben hast du heute bekommen?" – beantwortet oder vertagt. */
  homeworkPrompt?: { status: 'done' | 'snoozed'; until?: ISODateTime };
  /**
   * "Ich brauche heute mehr Freizeit": an diesem Tag mindestens so viele Minuten frei halten
   * (gemessen ab dem Zeitpunkt der Anfrage). Automatisch geplante Dinge werden dafür verschoben.
   */
  freeTarget?: number;
}

export interface Vacation {
  id: ID;
  name: string;
  startDate: DateKey;
  endDate: DateKey;
  /** Zustand, der im Zeitraum gilt (z. B. "Urlaub" oder "Ferien"). */
  stateId: ID;
}

export interface SpecialDay {
  id: ID;
  name: string;
  date: DateKey;
  stateId: ID;
  note?: string;
}

// ─────────────────────────────────────────────────────────────
// Berechnete Strukturen (werden nicht gespeichert)
// ─────────────────────────────────────────────────────────────

export type BlockKind =
  | 'sleep'
  | 'meal'
  | 'routine'
  | 'event'
  | 'travel'
  | 'break'
  | 'task'
  | 'school'
  | 'homework'
  | 'study'
  | 'exam';

/** Eine Unterrichtsstunde innerhalb eines Schul-Blocks. */
export interface LessonInfo {
  entryId: ID;
  subjectId: ID;
  title: string;
  shortName: string;
  color: string;
  start: number;
  end: number;
  room?: string;
}

export interface ScheduleBlock {
  /** Deterministische ID: `${sourceKey}@${date}` (+ Suffix). */
  id: string;
  date: DateKey;
  /** Minuten seit Mitternacht. */
  start: number;
  end: number;
  kind: BlockKind;
  title: string;
  color: string;
  categoryId?: ID;
  sourceKey: SourceKey;
  /** ID des Ursprungsobjekts (Routine, Event, Task, …). */
  sourceId?: ID;
  blocksFreeTime: boolean;
  priority?: Priority;
  goalId?: ID;
  /** Wofür eine Wegzeit/Pause gehört. */
  relatedTo?: string;
  /** Kann (nur für heute) ausgelassen werden. */
  skippable: boolean;
  /** ID eines Unterelements, z. B. des Hausaufgaben- oder Lernblocks. */
  itemId?: ID;
  /** Erledigt (für Arbeitsblöcke wie Hausaufgaben und Lerneinheiten). */
  done?: boolean;
  /** Unterrichtsstunden innerhalb eines Schul-Blocks. */
  lessons?: LessonInfo[];
}

export interface TimeSlot {
  start: number;
  end: number;
}

export type DayStateOrigin = 'manual' | 'specialDay' | 'vacation' | 'default';

export interface ResolvedDayState {
  definition: DayStateDefinition;
  origin: DayStateOrigin;
  /** z. B. Name des Urlaubs oder besonderen Tages. */
  label?: string;
}

export interface EnergyState {
  level: EnergyLevel;
  source: 'manual' | 'estimated';
  reason: string;
  /** Wurde durch den Tageszustand begrenzt. */
  capped: boolean;
}

export interface DaySchedule {
  date: DateKey;
  weekday: Weekday;
  dayState: ResolvedDayState;
  /** Wachzeit des Tages (Minuten). */
  awake: TimeSlot;
  blocks: ScheduleBlock[];
  /** Ganztägige Termine (blockieren keine Uhrzeit). */
  allDayEvents: CalendarEvent[];
  /** Unterricht an diesem Tag (leer, wenn die Schule pausiert ist). */
  lessons: LessonInfo[];
  /** Tests an diesem Tag (auch ohne Uhrzeit). */
  exams: Exam[];
  /** Ausgelassene Quellen (pausiert durch Zustand oder manuell). */
  inactive: Array<{ sourceKey: SourceKey; title: string; reason: 'state' | 'skipped' }>;
  freeSlots: TimeSlot[];
  totalFreeMin: number;
  /** So viel Zeit muss an diesem Tag frei bleiben (Einstellung bzw. "Mehr Freizeit"-Wunsch). */
  requiredFreeMin: number;
  scheduledTaskMin: number;
}
