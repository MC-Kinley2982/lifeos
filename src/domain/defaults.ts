/**
 * Start-Konfiguration.
 *
 * Alles hier sind nur Ausgangswerte – sie landen im Store und sind in der App vollständig
 * editierbar. Die Planungslogik liest ausschließlich aus den Einstellungen, nie aus Konstanten.
 */
import { createId, nowIso } from './ids';
import { mealSource, routineSource, SLEEP_SOURCE } from './sources';
import { addDays, ALL_WEEKDAYS, getWeekday, WORKDAYS } from './time';
import type {
  BreakRule,
  CalendarEvent,
  Category,
  DateKey,
  DayStateDefinition,
  EnergySettings,
  Exam,
  Goal,
  IntegrationSettings,
  Meal,
  PlanningSettings,
  ProtectedPeriod,
  Routine,
  SchoolSettings,
  Settings,
  Subject,
  Task,
  TimeHHMM,
  TimetableEntry,
  Weekday,
} from './types';

// Feste IDs für Standard-Kategorien und -Zustände, damit Regeln stabil darauf verweisen können.
export const CATEGORY_IDS = {
  school: 'cat_school',
  sport: 'cat_sport',
  learning: 'cat_learning',
  hobby: 'cat_hobby',
  food: 'cat_food',
  sleep: 'cat_sleep',
  household: 'cat_household',
  social: 'cat_social',
  health: 'cat_health',
  leisure: 'cat_leisure',
  other: 'cat_other',
} as const;

export const STATE_IDS = {
  normal: 'state_normal',
  sick: 'state_sick',
  vacation: 'state_vacation',
  holidays: 'state_holidays',
  trip: 'state_trip',
  special: 'state_special',
} as const;

export function defaultCategories(): Category[] {
  return [
    { id: CATEGORY_IDS.school, name: 'Schule', color: '#60a5fa', icon: 'graduation-cap' },
    { id: CATEGORY_IDS.sport, name: 'Sport', color: '#34d399', icon: 'dumbbell' },
    { id: CATEGORY_IDS.learning, name: 'Lernen', color: '#a78bfa', icon: 'book-open' },
    { id: CATEGORY_IDS.hobby, name: 'Hobby', color: '#f472b6', icon: 'palette' },
    { id: CATEGORY_IDS.food, name: 'Essen', color: '#fbbf24', icon: 'utensils' },
    { id: CATEGORY_IDS.sleep, name: 'Schlaf', color: '#818cf8', icon: 'moon' },
    { id: CATEGORY_IDS.household, name: 'Haushalt', color: '#94a3b8', icon: 'home' },
    { id: CATEGORY_IDS.social, name: 'Soziales', color: '#fb923c', icon: 'users' },
    { id: CATEGORY_IDS.health, name: 'Gesundheit', color: '#f87171', icon: 'heart' },
    { id: CATEGORY_IDS.leisure, name: 'Freizeit', color: '#2dd4bf', icon: 'gamepad' },
    { id: CATEGORY_IDS.other, name: 'Sonstiges', color: '#a1a1aa', icon: 'circle' },
  ];
}

export function defaultDayStates(): DayStateDefinition[] {
  return [
    {
      id: STATE_IDS.normal,
      name: 'Normal',
      icon: 'sun',
      color: '#a78bfa',
      builtIn: true,
      defaultActive: true,
      categoryRules: {},
      sourceRules: {},
    },
    {
      id: STATE_IDS.sick,
      name: 'Krank',
      icon: 'thermometer',
      color: '#f87171',
      builtIn: false,
      defaultActive: true,
      categoryRules: { [CATEGORY_IDS.school]: false, [CATEGORY_IDS.sport]: false },
      sourceRules: {},
      energyCap: 2,
      maxPlannedShare: 0.3,
      message: 'Gute Besserung! Schule und Sport sind pausiert. Plane nur, was wirklich nötig ist.',
    },
    {
      id: STATE_IDS.vacation,
      name: 'Urlaub',
      icon: 'palmtree',
      color: '#2dd4bf',
      builtIn: false,
      defaultActive: true,
      categoryRules: { [CATEGORY_IDS.school]: false, [CATEGORY_IDS.sport]: false, [CATEGORY_IDS.learning]: false },
      sourceRules: {},
      message: 'Urlaub – genieß die Zeit.',
    },
    {
      id: STATE_IDS.holidays,
      name: 'Ferien',
      icon: 'sparkles',
      color: '#fbbf24',
      builtIn: false,
      defaultActive: true,
      categoryRules: { [CATEGORY_IDS.school]: false },
      sourceRules: {},
      message: 'Ferien – keine Schule.',
    },
    {
      id: STATE_IDS.trip,
      name: 'Ausflug',
      icon: 'map',
      color: '#fb923c',
      builtIn: false,
      defaultActive: false,
      categoryRules: {},
      sourceRules: { [SLEEP_SOURCE]: true },
      message: 'Ausflugstag – nur Schlaf ist eingeplant.',
    },
    {
      id: STATE_IDS.special,
      name: 'Besonderer Tag',
      icon: 'star',
      color: '#f472b6',
      builtIn: false,
      defaultActive: true,
      categoryRules: {},
      sourceRules: {},
    },
  ];
}

export function defaultEnergySettings(): EnergySettings {
  return {
    baseline: 3,
    timeWindows: [
      { id: createId('ew'), label: 'Morgens', start: '05:00', end: '12:00', level: 3 },
      { id: createId('ew'), label: 'Nachmittags', start: '12:00', end: '18:00', level: 3 },
      { id: createId('ew'), label: 'Früher Abend', start: '18:00', end: '20:30', level: 3 },
      { id: createId('ew'), label: 'Später Abend', start: '20:30', end: '24:00', level: 2 },
    ],
    categoryRules: [
      { id: createId('er'), categoryId: CATEGORY_IDS.school, duringLevel: 3, afterLevel: 2, afterDurationMin: 60 },
      { id: createId('er'), categoryId: CATEGORY_IDS.sport, afterLevel: 2, afterDurationMin: 45 },
    ],
  };
}

export function defaultPlanningSettings(): PlanningSettings {
  return {
    minSlotMin: 15,
    granularityMin: 5,
    bufferBetweenTasksMin: 5,
    maxFocusMin: 90,
    breakAfterFocusMin: 15,
    maxPlannedShare: 0.6,
    minFreeTimeMin: 60,
    useWorkWindows: false,
    workWindows: [
      { id: createId('ww'), weekdays: [...WORKDAYS], start: '15:00', end: '21:00' },
      { id: createId('ww'), weekdays: [5, 6], start: '10:00', end: '20:00' },
    ],
    afternoonStarts: '12:00',
    eveningStarts: '18:00',
    energyRequirement: { low: 1, medium: 3, high: 4 },
    defaultGoalSessionMin: 60,
    protectedPeriods: [morningRoutinePeriod()],
  };
}

/**
 * Vorlage "Morgenroutine": ab dem Aufstehen (je Tag die eigene Aufstehzeit) eine Weile geschützt.
 * Ende und Wochentage sind in den Planungs-Einstellungen frei änderbar (z. B. "endet um 07:45").
 */
export function morningRoutinePeriod(): ProtectedPeriod {
  return { id: createId('pp'), name: 'Morgenroutine', enabled: true, weekdays: [...ALL_WEEKDAYS], from: { at: 'wake' }, until: { at: 'duration', minutes: 45 } };
}

/** Google Kalender: nicht verbunden, nichts wird übertragen, bis der Nutzer es einschaltet. */
export function defaultIntegrationSettings(): IntegrationSettings {
  return {
    googleCalendar: {
      importEvents: true,
      push: { events: false, homework: false, study: false, todos: false, routines: false },
      reminder: { type: 'calendarDefault' },
    },
  };
}

export function defaultMeals(): Meal[] {
  return [
    { id: createId('meal'), name: 'Frühstück', time: '07:15', durationMin: 20, weekdays: [...ALL_WEEKDAYS], enabled: true, color: '#fbbf24' },
    { id: createId('meal'), name: 'Mittagessen', time: '13:00', durationMin: 30, weekdays: [5, 6], enabled: true, color: '#fbbf24' },
    { id: createId('meal'), name: 'Abendessen', time: '19:30', durationMin: 30, weekdays: [...ALL_WEEKDAYS], enabled: true, color: '#fbbf24' },
  ];
}

export function defaultBreakRules(): BreakRule[] {
  return [
    { id: createId('br'), name: 'Nach einem langen Block', enabled: true, trigger: { type: 'afterLongBlock', minBlockMin: 180 }, durationMin: 15 },
  ];
}

export function defaultSchoolSettings(): SchoolSettings {
  return {
    enabled: true,
    linkedRoutineId: undefined,
    categoryId: CATEGORY_IDS.school,
    travelBeforeMin: 0,
    travelAfterMin: 0,
    workCategoryId: CATEGORY_IDS.learning,
    defaultHomeworkMinutes: 30,
    defaultHomeworkPriority: 'medium',
    askForHomework: true,
    autoPlan: true,
    allowSplitHomework: true,
    minBlockMin: 30,
    maxSchoolShare: 0.8,
    fallbackDeadlineDays: 7,
    lookaheadDays: 28,
    defaultStudyMinutes: 120,
    defaultStudyLeadDays: 5,
    defaultStudySessionMin: 45,
    maxStudyMinPerDay: 60,
  };
}

/** Vorschläge für Fächer (Name, Kurzform, Farbe) – werden nur auf Wunsch angelegt. */
export const SUBJECT_SUGGESTIONS: Array<{ name: string; shortName: string; color: string }> = [
  { name: 'Mathematik', shortName: 'Ma', color: '#60a5fa' },
  { name: 'Deutsch', shortName: 'De', color: '#f87171' },
  { name: 'Englisch', shortName: 'En', color: '#fbbf24' },
  { name: 'Physik', shortName: 'Ph', color: '#a78bfa' },
  { name: 'Russisch', shortName: 'Ru', color: '#2dd4bf' },
  { name: 'Biologie', shortName: 'Bio', color: '#34d399' },
  { name: 'Chemie', shortName: 'Ch', color: '#22d3ee' },
  { name: 'Geschichte', shortName: 'Ge', color: '#fb923c' },
  { name: 'Erdkunde', shortName: 'Ek', color: '#a3e635' },
  { name: 'Informatik', shortName: 'If', color: '#818cf8' },
  { name: 'Kunst', shortName: 'Ku', color: '#f472b6' },
  { name: 'Musik', shortName: 'Mu', color: '#e879f9' },
  { name: 'Sport', shortName: 'Spo', color: '#4ade80' },
  { name: 'Religion/Ethik', shortName: 'Re', color: '#94a3b8' },
];

export function createDefaultSettings(name = ''): Settings {
  return {
    profile: { id: createId('user'), name, createdAt: nowIso() },
    onboardingDone: false,
    sleep: {
      enabled: true,
      default: { wakeTime: '07:00', bedtime: '22:30' },
      perWeekday: {},
      color: '#818cf8',
    },
    meals: defaultMeals(),
    breakRules: defaultBreakRules(),
    energy: defaultEnergySettings(),
    dayStates: defaultDayStates(),
    categories: defaultCategories(),
    planning: defaultPlanningSettings(),
    school: defaultSchoolSettings(),
    ui: { weekStartsOn: 0, hideCompletedTodos: false },
    integrations: defaultIntegrationSettings(),
  };
}

// ─────────────────────────────────────────────────────────────
// Beispiel-Alltag (optional beim ersten Start)
// ─────────────────────────────────────────────────────────────

export interface ExampleData {
  settings: Settings;
  routines: Routine[];
  events: CalendarEvent[];
  tasks: Task[];
  goals: Goal[];
  subjects: Subject[];
  timetable: TimetableEntry[];
  exams: Exam[];
}

function nextWeekday(from: DateKey, weekday: Weekday): DateKey {
  const offset = (weekday - getWeekday(from) + 7) % 7;
  return addDays(from, offset);
}

/** Klingelzeiten des Beispiel-Stundenplans (1.–7. Stunde). */
const EXAMPLE_PERIODS: Array<[TimeHHMM, TimeHHMM]> = [
  ['08:00', '08:45'],
  ['08:50', '09:35'],
  ['09:55', '10:40'],
  ['10:45', '11:30'],
  ['11:50', '12:35'],
  ['12:40', '13:25'],
  ['13:45', '14:30'],
];

/** Beispiel-Woche: Fach-Kurzform je Stunde (Mo–Fr). */
const EXAMPLE_WEEK: string[][] = [
  ['Ma', 'Ma', 'De', 'En', 'Ph', 'Bio'],
  ['En', 'De', 'Ru', 'Ru', 'Ma', 'Ge', 'Spo'],
  ['Ma', 'De', 'En', 'Ph', 'Ph', 'Ru'],
  ['Ma', 'Ma', 'Bio', 'De', 'Ru', 'En', 'Ku'],
  ['Ph', 'En', 'Ma', 'Ge', 'De', 'De'],
];

export function createExampleData(today: DateKey, name = ''): ExampleData {
  const ts = nowIso();
  const settings = createDefaultSettings(name);
  settings.sleep.perWeekday = {
    4: { wakeTime: '07:00', bedtime: '23:30' },
    5: { wakeTime: '09:00', bedtime: '23:30' },
    6: { wakeTime: '09:00', bedtime: '22:30' },
  };
  // Am Wochenende später aufstehen → eigenes Frühstück.
  const weekdayBreakfast = settings.meals[0];
  weekdayBreakfast.weekdays = [...WORKDAYS];
  const weekendBreakfast: Meal = { ...weekdayBreakfast, id: createId('meal'), name: 'Frühstück (Wochenende)', time: '09:30', durationMin: 30, weekdays: [5, 6] };
  settings.meals.splice(1, 0, weekendBreakfast);

  const routine = (r: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>): Routine => ({
    ...r,
    id: createId('routine'),
    createdAt: ts,
    updatedAt: ts,
  });

  const goalId = createId('goal');
  const school = routine({
    name: 'Schule',
    categoryId: CATEGORY_IDS.school,
    color: '#60a5fa',
    weekdays: [...WORKDAYS],
    start: '08:00',
    end: '14:30',
    priority: 'high',
    blocksFreeTime: true,
    enabled: true,
    travelBeforeMin: 0,
    travelAfterMin: 30,
  });
  const football = routine({
    name: 'Fußballtraining',
    categoryId: CATEGORY_IDS.sport,
    color: '#34d399',
    weekdays: [1, 3],
    start: '17:00',
    end: '19:00',
    priority: 'high',
    blocksFreeTime: true,
    enabled: true,
    travelBeforeMin: 15,
    travelAfterMin: 15,
  });
  const chess = routine({
    name: 'Schach-AG',
    categoryId: CATEGORY_IDS.hobby,
    color: '#f472b6',
    weekdays: [2],
    start: '16:30',
    end: '18:00',
    priority: 'medium',
    blocksFreeTime: true,
    enabled: true,
    travelBeforeMin: 10,
    travelAfterMin: 10,
  });

  settings.breakRules.push({
    id: createId('br'),
    name: 'Nach der Schule',
    enabled: true,
    trigger: { type: 'afterSource', sourceKey: routineSource(school.id) },
    durationMin: 30,
  });

  // Urlaub: Schlaf & Frühstück bleiben, Schule & Fußball pausieren (über Kategorie-Regeln bereits abgedeckt).
  const vacation = settings.dayStates.find((s) => s.id === STATE_IDS.vacation);
  if (vacation) {
    vacation.sourceRules[SLEEP_SOURCE] = true;
    vacation.sourceRules[mealSource(weekdayBreakfast.id)] = true;
    vacation.sourceRules[mealSource(weekendBreakfast.id)] = true;
  }

  const event = (e: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'allDay'>): CalendarEvent => ({
    ...e,
    id: createId('event'),
    source: 'local',
    allDay: false,
    createdAt: ts,
    updatedAt: ts,
  });

  const task = (t: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Task => ({
    ...t,
    id: createId('task'),
    status: 'todo',
    createdAt: ts,
    updatedAt: ts,
  });

  // Schule: Fächer + Stundenplan. Die Routine "Schule" übernimmt an Schultagen die Zeiten des Stundenplans.
  const subjects: Subject[] = SUBJECT_SUGGESTIONS.filter((s) => ['Ma', 'De', 'En', 'Ph', 'Ru', 'Bio', 'Ge', 'Spo', 'Ku'].includes(s.shortName)).map(
    (s) => ({ ...s, id: createId('subj'), createdAt: ts, updatedAt: ts }),
  );
  const byShort = new Map(subjects.map((s) => [s.shortName, s.id]));
  const timetable: TimetableEntry[] = EXAMPLE_WEEK.flatMap((lessons, weekday) =>
    lessons.map((short, period) => ({
      id: createId('tt'),
      subjectId: byShort.get(short) ?? subjects[0].id,
      weekday: weekday as Weekday,
      start: EXAMPLE_PERIODS[period][0],
      end: EXAMPLE_PERIODS[period][1],
      createdAt: ts,
      updatedAt: ts,
    })),
  );
  settings.school.linkedRoutineId = school.id;

  const exams: Exam[] = [
    {
      id: createId('exam'),
      subjectId: byShort.get('Ma') ?? subjects[0].id,
      title: 'Klassenarbeit',
      date: nextWeekday(addDays(today, 8), 3),
      startTime: '08:00',
      endTime: '08:45',
      priority: 'high',
      energy: 'medium',
      desiredStudyMinutes: 180,
      studySessions: [],
      createdAt: ts,
      updatedAt: ts,
    },
  ];

  return {
    settings,
    subjects,
    timetable,
    exams,
    routines: [school, football, chess],
    events: [
      event({
        title: 'Fußballspiel',
        date: nextWeekday(addDays(today, 1), 5),
        start: '14:00',
        end: '16:00',
        categoryId: CATEGORY_IDS.sport,
        blocksFreeTime: true,
        travelBeforeMin: 30,
        travelAfterMin: 30,
      }),
      event({
        title: 'Geburtstag Oma',
        date: nextWeekday(addDays(today, 1), 6),
        start: '15:00',
        end: '18:00',
        categoryId: CATEGORY_IDS.social,
        blocksFreeTime: true,
        travelBeforeMin: 20,
        travelAfterMin: 20,
      }),
    ],
    tasks: [
      task({ title: 'Mathe Hausaufgaben', estimatedMin: 45, deadline: today, priority: 'high', categoryId: CATEGORY_IDS.learning, energy: 'medium' }),
      task({ title: 'Blender üben', estimatedMin: 60, priority: 'medium', categoryId: CATEGORY_IDS.hobby, energy: 'high', goalId }),
      task({ title: 'Russisch-Vokabeln', estimatedMin: 20, deadline: addDays(today, 1), priority: 'medium', categoryId: CATEGORY_IDS.learning, energy: 'low' }),
      task({ title: 'Zimmer aufräumen', estimatedMin: 15, priority: 'low', categoryId: CATEGORY_IDS.household, energy: 'low' }),
    ],
    goals: [
      {
        id: goalId,
        title: 'Blender verbessern',
        description: '3 Stunden pro Woche üben',
        color: '#f472b6',
        categoryId: CATEGORY_IDS.hobby,
        target: { type: 'weeklyMinutes', minutes: 180 },
        sessionMin: 60,
        energy: 'high',
        active: true,
        log: [],
        createdAt: ts,
        updatedAt: ts,
      },
    ],
  };
}
