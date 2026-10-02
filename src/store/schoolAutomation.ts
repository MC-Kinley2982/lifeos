import { useEffect } from 'react';
import { getPlanner } from '../services/planner';
import type { PlannerData } from '../services/planner';
import type { SchoolPlanOptions, SchoolPlanResult } from '../services/school/types';
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

/**
 * Hält den Schulplan aktuell: beim Start, beim Tageswechsel und beim Zurückkehren in die App
 * werden verpasste Blöcke entfernt und offene Restzeit neu eingeplant.
 * `ready` erlaubt es, damit zu warten (z. B. bis die Cloud-Daten geladen sind).
 */
export function useSchoolAutoPlanner(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const run = () => {
      const s = useAppStore.getState();
      if (!s.settings.onboardingDone || !s.settings.school.enabled) return;
      replanSchool();
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
