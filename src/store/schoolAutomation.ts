import { useEffect } from 'react';
import { minutesSinceMidnight, toDateKey } from '../domain/time';
import type { DateKey } from '../domain/types';
import { buildDaySchedule, freeMinutesFrom, getPlanner } from '../services/planner';
import type { PlannerData, RebalanceOptions, RebalanceResult } from '../services/planner';
import type { SchoolPlanOptions, SchoolPlanResult } from '../services/school/types';
import { toast } from '../ui/toast';
import { useAppStore } from './useAppStore';
import type { AppState } from './types';

/** Daten-Snapshot für den Planer aus dem Store. */
export function plannerDataFrom(state: AppState): PlannerData {
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
  };
}

const EMPTY: SchoolPlanResult = { homework: {}, exams: {}, added: [], unplanned: [] };

/**
 * Hausaufgaben/Lernzeit (neu) einplanen und das Ergebnis übernehmen.
 * Ist die automatische Planung ausgeschaltet, passiert nichts (außer bei `force`).
 */
export function replanSchool(opts: SchoolPlanOptions = {}, force = false): SchoolPlanResult {
  const state = useAppStore.getState();
  if (!force && !state.settings.school.autoPlan) return EMPTY;
  const result = getPlanner().planSchoolWork(plannerDataFrom(state), new Date(), opts);
  state.applySchoolPlan(result);
  return result;
}

/** Überlastete Tage entlasten (Freizeit-Schutz, keine Doppelungen) und das Ergebnis übernehmen. */
export function rebalanceNow(opts: RebalanceOptions = {}): RebalanceResult {
  const state = useAppStore.getState();
  const result = getPlanner().rebalance(plannerDataFrom(state), new Date(), opts);
  if (result.moved.length) state.applyRebalance(result);
  return result;
}

export interface FreeTimeOutcome {
  before: number;
  after: number;
  target: number;
  result: RebalanceResult;
}

/** Freie Zeit eines Tages – heute ab jetzt oder (wholeDay) inkl. schon vergangener Freizeit. */
function freeOn(date: DateKey, now: Date, wholeDay = false): number {
  const from = !wholeDay && date === toDateKey(now) ? minutesSinceMidnight(now) : 0;
  return freeMinutesFrom(buildDaySchedule(plannerDataFrom(useAppStore.getState()), date), from);
}

/**
 * "Ich brauche heute mehr Freizeit": Ziel = aktuelle freie Zeit + gewünschte Minuten.
 * Was an diesem Tag geplant ist, wird – soweit vor der Deadline möglich – auf andere Tage verlegt.
 * Das Ziel bleibt gespeichert (für den ganzen Tag gerechnet, damit es im Laufe des Tages gleich bleibt),
 * damit der Tag nicht wieder vollgeplant wird. Angezeigt wird die Zeit ab jetzt.
 */
export function makeFreeTime(date: DateKey, extraMin: number): FreeTimeOutcome {
  const now = new Date();
  const extra = Math.max(0, Math.round(extraMin));
  const before = freeOn(date, now);
  useAppStore.getState().setFreeTarget(date, freeOn(date, now, true) + extra);
  const result = rebalanceNow({ dates: [date], includeManual: true });
  return { before, after: freeOn(date, now), target: before + extra, result };
}

export function clearFreeTarget(date: DateKey): void {
  useAppStore.getState().setFreeTarget(date, null);
}

/**
 * Hält den Plan aktuell: beim Start, beim Zurückkehren in die App und alle 10 Minuten
 * 1. überlastete Tage entlasten (Mindest-Freizeit, Planungsanteil, keine Doppelungen),
 * 2. verpasste Schulblöcke entfernen und offene Restzeit neu einplanen.
 * `ready` erlaubt es, damit zu warten (z. B. bis die Cloud-Daten geladen sind).
 */
export function usePlanMaintenance(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const run = () => {
      const s = useAppStore.getState();
      if (!s.settings.onboardingDone) return;
      const moved = rebalanceNow().moved;
      if (moved.length) toast(`Plan angepasst: ${moved.length} ${moved.length === 1 ? 'Eintrag' : 'Einträge'} verschoben, damit genug Freizeit bleibt`, 'info');
      if (s.settings.school.enabled) replanSchool();
    };
    run();
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(run, 10 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [ready]);
}
