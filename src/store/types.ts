import type { StateCreator } from 'zustand';
import type {
  BreakRule,
  CalendarEvent,
  Category,
  DailyState,
  DateKey,
  DayStateDefinition,
  EnergyCategoryRule,
  EnergyLevel,
  EnergySettings,
  EnergyTimeWindow,
  Exam,
  Goal,
  GoogleCalendarSettings,
  Homework,
  ID,
  Meal,
  PlanningSettings,
  ProtectedPeriod,
  Routine,
  SchoolBlock,
  SchoolSettings,
  Settings,
  SleepSettings,
  SleepTimes,
  SourceKey,
  SpecialDay,
  Subject,
  Task,
  TaskSchedule,
  TimetableEntry,
  Todo,
  UiSettings,
  UserProfile,
  Vacation,
  Weekday,
  WorkWindow,
} from '../domain/types';
import type {
  EventInput,
  ExamInput,
  GoalInput,
  HomeworkInput,
  RoutineInput,
  SubjectInput,
  TaskInput,
  TimetableEntryInput,
  TodoInput,
} from '../domain/factories';
import type { PlanItem } from '../services/planner/types';
import type { SchoolPlanResult } from '../services/school/types';
import type { RebalanceResult } from '../services/planner/rebalance';

/** Alles, was persistiert wird. */
export interface AppData {
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
  todos: Todo[];
}

export type BlockOwner = { kind: 'homework'; id: ID } | { kind: 'exam'; id: ID };

export interface SchoolActions {
  updateSchoolSettings(patch: Partial<SchoolSettings>): void;
  addSubject(input: SubjectInput): ID;
  updateSubject(id: ID, patch: Partial<SubjectInput>): void;
  /** Entfernt das Fach samt Stundenplan-Einträgen. Hausaufgaben/Tests bleiben erhalten. */
  removeSubject(id: ID): void;
  addLesson(input: TimetableEntryInput): ID;
  updateLesson(id: ID, patch: Partial<TimetableEntryInput>): void;
  removeLesson(id: ID): void;
  addHomework(input: HomeworkInput): ID;
  updateHomework(id: ID, patch: Partial<HomeworkInput>): void;
  removeHomework(id: ID): void;
  toggleHomeworkDone(id: ID): void;
  addExam(input: ExamInput): ID;
  updateExam(id: ID, patch: Partial<ExamInput>): void;
  removeExam(id: ID): void;
  /** Block einer Hausaufgabe bzw. Lerneinheit eines Tests ändern (wird dadurch "manuell"). */
  updateSchoolBlock(owner: BlockOwner, blockId: ID, patch: Partial<Omit<SchoolBlock, 'id'>>): void;
  addSchoolBlock(owner: BlockOwner, block: Omit<SchoolBlock, 'id'>): void;
  removeSchoolBlock(owner: BlockOwner, blockId: ID): void;
  toggleSchoolBlockDone(owner: BlockOwner, blockId: ID): void;
  /** Ergebnis der automatischen Schulplanung übernehmen. */
  applySchoolPlan(result: SchoolPlanResult): void;
}

export interface SettingsActions {
  updateProfile(patch: Partial<UserProfile>): void;
  updateSleep(patch: Partial<SleepSettings>): void;
  setSleepOverride(weekday: Weekday, times: SleepTimes | null): void;
  addMeal(meal: Meal): void;
  updateMeal(id: ID, patch: Partial<Meal>): void;
  removeMeal(id: ID): void;
  addBreakRule(rule: BreakRule): void;
  updateBreakRule(id: ID, patch: Partial<BreakRule>): void;
  removeBreakRule(id: ID): void;
  updateEnergySettings(patch: Partial<EnergySettings>): void;
  upsertEnergyWindow(window: EnergyTimeWindow): void;
  removeEnergyWindow(id: ID): void;
  upsertEnergyRule(rule: EnergyCategoryRule): void;
  removeEnergyRule(id: ID): void;
  addDayState(state: DayStateDefinition): void;
  updateDayState(id: ID, patch: Partial<DayStateDefinition>): void;
  removeDayState(id: ID): void;
  /** active = null entfernt die Regel (dann gilt Kategorie bzw. Standard). */
  setStateSourceRule(stateId: ID, sourceKey: SourceKey, active: boolean | null): void;
  setStateCategoryRule(stateId: ID, categoryId: ID, active: boolean | null): void;
  addCategory(category: Category): void;
  updateCategory(id: ID, patch: Partial<Category>): void;
  removeCategory(id: ID): void;
  updatePlanning(patch: Partial<PlanningSettings>): void;
  upsertWorkWindow(window: WorkWindow): void;
  removeWorkWindow(id: ID): void;
  upsertProtectedPeriod(period: ProtectedPeriod): void;
  removeProtectedPeriod(id: ID): void;
  updateUi(patch: Partial<UiSettings>): void;
  updateGoogleCalendar(patch: Partial<GoogleCalendarSettings>): void;
}

export interface RoutineActions {
  addRoutine(input: RoutineInput): ID;
  updateRoutine(id: ID, patch: Partial<RoutineInput>): void;
  removeRoutine(id: ID): void;
}

export interface EventActions {
  addEvent(input: EventInput): ID;
  updateEvent(id: ID, patch: Partial<EventInput>): void;
  removeEvent(id: ID): void;
  /**
   * Gelesene Google-Termine übernehmen: ersetzt alle Google-Termine im Zeitraum (from ≤ Datum < to).
   * calendarId = null entfernt alle Google-Termine (z. B. nach dem Trennen). Ändert nichts, wenn gleich.
   */
  replaceGoogleEvents(calendarId: string | null, events: CalendarEvent[], range?: { from: DateKey; to: DateKey }): void;
}

export interface TodoActions {
  addTodo(input: TodoInput): ID;
  updateTodo(id: ID, patch: Partial<TodoInput>): void;
  /** Abhaken bzw. wieder öffnen – das To-do bleibt gespeichert. Eine verknüpfte Aufgabe folgt. */
  toggleTodo(id: ID): void;
  /** Löscht das To-do samt der Aufgabe, die durch "Planen" entstanden ist. */
  removeTodo(id: ID): void;
  /** Nach der Google-Synchronisierung: IDs der von LifeOS angelegten Termine merken. */
  setTodoCalendarEventIds(ids: Record<ID, string | undefined>): void;
}

export interface TaskActions {
  addTask(input: TaskInput): ID;
  updateTask(id: ID, patch: Partial<TaskInput>): void;
  removeTask(id: ID): void;
  toggleTaskDone(id: ID): void;
  setTaskSchedule(id: ID, schedule: TaskSchedule | undefined): void;
  /** Übernimmt Vorschläge der Auto-Planung (Ziel-Einheiten werden zu Aufgaben). */
  applyPlan(items: PlanItem[]): void;
}

export interface GoalActions {
  addGoal(input: GoalInput): ID;
  updateGoal(id: ID, patch: Partial<GoalInput>): void;
  removeGoal(id: ID): void;
  logGoalTime(goalId: ID, minutes: number, date: DateKey, note?: string): void;
  removeGoalLog(goalId: ID, logId: ID): void;
}

export interface DailyActions {
  setDayState(date: DateKey, stateId: ID | null): void;
  setEnergy(date: DateKey, level: EnergyLevel | null): void;
  toggleSkipSource(date: DateKey, sourceKey: SourceKey): void;
  setDayNote(date: DateKey, note: string): void;
  addVacation(v: Vacation): void;
  updateVacation(id: ID, patch: Partial<Vacation>): void;
  removeVacation(id: ID): void;
  addSpecialDay(d: SpecialDay): void;
  updateSpecialDay(id: ID, patch: Partial<SpecialDay>): void;
  removeSpecialDay(id: ID): void;
  /** Hausaufgaben-Nachfrage für einen Tag als erledigt markieren oder vertagen. */
  setHomeworkPrompt(date: DateKey, status: 'done' | 'snoozed', until?: string): void;
  /** "Mehr Freizeit": an diesem Tag mindestens so viele Minuten frei halten (null = aufheben). */
  setFreeTarget(date: DateKey, minutes: number | null): void;
}

export interface DataActions {
  completeOnboarding(opts: { name: string; withExample: boolean; today: DateKey }): void;
  exportData(): string;
  importData(json: string): { ok: true } | { ok: false; error: string };
  resetAll(): void;
  /** Ersetzt alle Daten (z. B. durch Cloud-Daten). Wird von der Synchronisierung genutzt. */
  replaceData(data: AppData): void;
  /** Verschiebungen zur Entlastung von Tagen übernehmen. */
  applyRebalance(result: RebalanceResult): void;
}

export type AppState = AppData &
  SettingsActions &
  RoutineActions &
  EventActions &
  TaskActions &
  TodoActions &
  GoalActions &
  DailyActions &
  SchoolActions &
  DataActions;

export type SliceCreator<T> = StateCreator<AppState, [['zustand/persist', unknown]], [], T>;
