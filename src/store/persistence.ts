import { CATEGORY_IDS, createDefaultSettings, defaultSchoolSettings, STATE_IDS } from '../domain/defaults';
import type { Exam, Homework, Routine, SchoolSettings, Settings, Todo } from '../domain/types';
import { GOAL_SESSION_DESCRIPTION } from './slices/tasksSlice';
import type { AppData, AppState } from './types';

export const DATA_KEYS = [
  'settings',
  'routines',
  'events',
  'tasks',
  'goals',
  'dailyStates',
  'vacations',
  'specialDays',
  'subjects',
  'timetable',
  'homework',
  'exams',
  'todos',
] as const;

export function pickData(state: AppState): AppData {
  return {
    settings: state.settings,
    routines: state.routines,
    events: state.events,
    tasks: state.tasks,
    goals: state.goals,
    dailyStates: state.dailyStates,
    vacations: state.vacations,
    specialDays: state.specialDays,
    subjects: state.subjects,
    timetable: state.timetable,
    homework: state.homework,
    exams: state.exams,
    todos: state.todos,
  };
}

export function emptyData(): AppData {
  return {
    settings: createDefaultSettings(),
    routines: [],
    events: [],
    tasks: [],
    goals: [],
    dailyStates: {},
    vacations: [],
    specialDays: [],
    subjects: [],
    timetable: [],
    homework: [],
    exams: [],
    todos: [],
  };
}

/**
 * Schul-Einstellungen ergänzen. Fehlen sie ganz (Daten aus V1), wird eine eindeutige
 * Routine der Kategorie "Schule" automatisch mit dem Stundenplan verknüpft.
 */
function normalizeSchool(raw: Partial<SchoolSettings> | undefined, routines: Routine[]): SchoolSettings {
  const defaults = defaultSchoolSettings();
  if (raw && typeof raw === 'object') return { ...defaults, ...raw };
  const schoolRoutines = routines.filter((r) => r.categoryId === CATEGORY_IDS.school && r.enabled);
  return { ...defaults, linkedRoutineId: schoolRoutines.length === 1 ? schoolRoutines[0].id : undefined };
}

/**
 * Ergänzt fehlende Felder mit Standardwerten.
 * So bleiben alte gespeicherte Daten gültig, wenn spätere Versionen neue Einstellungen einführen.
 */
export function normalizeData(raw: Partial<AppData> | undefined): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const routines = arr<Routine>(raw.routines);
  const s = (raw.settings ?? {}) as Partial<Settings>;
  const d = base.settings;
  const google = s.integrations?.googleCalendar;
  const settings: Settings = {
    ...d,
    ...s,
    profile: { ...d.profile, ...s.profile },
    sleep: { ...d.sleep, ...s.sleep, perWeekday: { ...(s.sleep?.perWeekday ?? {}) } },
    energy: { ...d.energy, ...s.energy },
    planning: {
      ...d.planning,
      ...s.planning,
      energyRequirement: { ...d.planning.energyRequirement, ...s.planning?.energyRequirement },
    },
    school: normalizeSchool(s.school, routines),
    ui: { ...d.ui, ...s.ui },
    integrations: {
      ...d.integrations,
      ...s.integrations,
      googleCalendar: {
        ...d.integrations.googleCalendar,
        ...google,
        push: { ...d.integrations.googleCalendar.push, ...google?.push },
      },
    },
    meals: Array.isArray(s.meals) ? s.meals : d.meals,
    breakRules: Array.isArray(s.breakRules) ? s.breakRules : d.breakRules,
    dayStates: Array.isArray(s.dayStates) && s.dayStates.length
      ? s.dayStates.map((st) => ({ ...st, categoryRules: st.categoryRules ?? {}, sourceRules: st.sourceRules ?? {} }))
      : d.dayStates,
    categories: Array.isArray(s.categories) && s.categories.length ? s.categories : d.categories,
  };
  return {
    settings,
    routines,
    events: arr(raw.events),
    tasks: arr(raw.tasks),
    goals: arr<AppData['goals'][number]>(raw.goals).map((g) => ({ ...g, log: g.log ?? [] })),
    dailyStates: raw.dailyStates && typeof raw.dailyStates === 'object' ? raw.dailyStates : {},
    vacations: arr(raw.vacations),
    specialDays: arr(raw.specialDays),
    subjects: arr(raw.subjects),
    timetable: arr(raw.timetable),
    homework: arr<Homework>(raw.homework).map((h) => ({ ...h, plannedBlocks: Array.isArray(h.plannedBlocks) ? h.plannedBlocks : [] })),
    exams: arr<Exam>(raw.exams).map((e) => ({ ...e, studySessions: Array.isArray(e.studySessions) ? e.studySessions : [] })),
    todos: arr<Todo>(raw.todos),
  };
}

/** Bisheriger Standard für den kleinsten Hausaufgaben-/Lernblock – erzeugte künstliche 15-Minuten-Stücke. */
const OLD_DEFAULT_MIN_BLOCK = 15;

/**
 * Migrationen zwischen Speicher-Versionen.
 * V1 → V2: Schule (Fächer, Stundenplan, Hausaufgaben, Tests) und Planungsanteil für "Krank".
 * V2 → V3: Früher automatisch geplante Ziel-Einheiten als `auto` markieren – sie dürfen
 *          zum Schutz der Freizeit (und gegen Doppelungen) verschoben werden.
 * V3 → V4: To-dos, geschützte Zeiträume (Morgenroutine) und Integrationen kommen über die
 *          Standardwerte in normalizeData dazu. Der unveränderte alte Standard für den kleinsten
 *          Schul-Arbeitsblock (15 min) wird auf den neuen Standard gehoben – keine Mini-Lernblöcke mehr.
 */
export function migrate(persisted: unknown, version: number): Partial<AppData> {
  const data = (persisted ?? {}) as Partial<AppData>;
  if (version < 2 && Array.isArray(data.settings?.dayStates)) {
    data.settings = {
      ...data.settings,
      dayStates: data.settings.dayStates.map((st) =>
        st.id === STATE_IDS.sick && st.maxPlannedShare === undefined ? { ...st, maxPlannedShare: 0.3 } : st,
      ),
    };
  }
  if (version < 3 && Array.isArray(data.tasks)) {
    data.tasks = data.tasks.map((t) =>
      t.description === GOAL_SESSION_DESCRIPTION && t.schedule && !t.schedule.auto ? { ...t, schedule: { ...t.schedule, auto: true } } : t,
    );
  }
  if (version < 4 && data.settings?.school?.minBlockMin === OLD_DEFAULT_MIN_BLOCK) {
    data.settings = { ...data.settings, school: { ...data.settings.school, minBlockMin: defaultSchoolSettings().minBlockMin } };
  }
  return data;
}
