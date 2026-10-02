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
  Goal,
  ID,
  Meal,
  PlanningSettings,
  Routine,
  Settings,
  SleepSettings,
  SleepTimes,
  SourceKey,
  SpecialDay,
  Task,
  TaskSchedule,
  UiSettings,
  UserProfile,
  Vacation,
  Weekday,
  WorkWindow,
} from '../domain/types';
import type { EventInput, GoalInput, RoutineInput, TaskInput } from '../domain/factories';
import type { PlanItem } from '../services/planner/types';

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
  updateUi(patch: Partial<UiSettings>): void;
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
}

export interface DataActions {
  completeOnboarding(opts: { name: string; withExample: boolean; today: DateKey }): void;
  exportData(): string;
  importData(json: string): { ok: true } | { ok: false; error: string };
  resetAll(): void;
}

export type AppState = AppData &
  SettingsActions &
  RoutineActions &
  EventActions &
  TaskActions &
  GoalActions &
  DailyActions &
  DataActions;

export type SliceCreator<T> = StateCreator<AppState, [['zustand/persist', unknown]], [], T>;
