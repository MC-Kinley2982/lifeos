import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { minutesSinceMidnight, toDateKey, weekDays } from '../domain/time';
import type { DateKey } from '../domain/types';
import { buildDaySchedule, computeGoalProgress, estimateEnergy } from '../services/planner';
import type { PlannerData } from '../services/planner';
import { useAppStore } from './useAppStore';

/** Daten-Snapshot für den Planer (stabil, solange sich nichts ändert). */
export function usePlannerData(): PlannerData {
  return useAppStore(
    useShallow((s) => ({
      settings: s.settings,
      routines: s.routines,
      events: s.events,
      tasks: s.tasks,
      goals: s.goals,
      dailyStates: s.dailyStates,
      vacations: s.vacations,
      specialDays: s.specialDays,
      subjects: s.subjects,
      timetable: s.timetable,
      homework: s.homework,
      exams: s.exams,
    })),
  );
}

/** Aktuelle Zeit, aktualisiert sich regelmäßig und beim Zurückkehren in die App. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

export function useToday(): DateKey {
  return toDateKey(useNow());
}

export function useDaySchedule(date: DateKey) {
  const data = usePlannerData();
  return useMemo(() => buildDaySchedule(data, date), [data, date]);
}

export function useWeekSchedules(dates: DateKey[]) {
  const data = usePlannerData();
  const key = dates.join(',');
  return useMemo(() => dates.map((d) => buildDaySchedule(data, d)), [data, key]);
}

/** Energie für einen Tag – jetzt (heute) bzw. zur Tagesmitte (andere Tage). */
export function useEnergy(date: DateKey, now: Date) {
  const data = usePlannerData();
  const schedule = useDaySchedule(date);
  const minute = date === toDateKey(now) ? minutesSinceMidnight(now) : 15 * 60;
  return useMemo(() => estimateEnergy(data, schedule, minute), [data, schedule, minute]);
}

export function useGoalProgress(date: DateKey, now: Date) {
  const data = usePlannerData();
  const week = weekDays(date, data.settings.ui.weekStartsOn);
  const key = week.join(',');
  const nowKey = Math.floor(now.getTime() / 60_000);
  return useMemo(() => computeGoalProgress(data, week, now), [data, key, nowKey]);
}
