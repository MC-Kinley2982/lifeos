import { planSchoolWork } from '../school/schoolPlanner';
import type { SchoolPlanOptions, SchoolPlanResult } from '../school/types';
import { planTasks } from './autoPlan';
import { rebalanceDays, type RebalanceOptions, type RebalanceResult } from './rebalance';
import { suggestNow } from './suggest';
import type { NowSuggestion, PlannerData, PlanOptions, PlanResult } from './types';

export * from './types';
export type { RebalanceOptions, RebalanceResult, MovedItem } from './rebalance';
export { buildDaySchedule, awakeWindow, sleepTimesFor, WORK_KINDS } from './schedule';
export { resolveDayState, isSourceActive, getDailyState, emptyDailyState } from './dayState';
export { estimateEnergy, requiredEnergy, energyFits } from './energy';
export { freeSlotsFrom, freeMinutesFrom, planningBudget, plannableSlots, timeOfDayAt } from './freeTime';
export { computeGoalProgress } from './goals';
export { protectedSlotsFor, protectedAt } from './protected';

/**
 * Abstraktionsschicht für Planungs-Strategien.
 * V1/V2 nutzen die regelbasierte Strategie. Ein späterer KI-Planer (services/ai) implementiert
 * dasselbe Interface und kann ohne Änderungen an der UI eingesetzt werden.
 */
export interface PlannerStrategy {
  id: string;
  name: string;
  /** Aufgaben (und optional Ziele) vorschlagen – wird erst nach Bestätigung übernommen. */
  plan(data: PlannerData, options: PlanOptions): PlanResult;
  suggestNow(data: PlannerData, now: Date): NowSuggestion;
  /** Hausaufgaben und Lernzeit für Tests automatisch einplanen. */
  planSchoolWork(data: PlannerData, now: Date, options?: SchoolPlanOptions): SchoolPlanResult;
  /** Überlastete Tage entlasten (Freizeit-Schutz, keine Doppelungen) – verschiebt automatisch Geplantes. */
  rebalance(data: PlannerData, now: Date, options?: RebalanceOptions): RebalanceResult;
}

export const ruleBasedPlanner: PlannerStrategy = {
  id: 'rule-based',
  name: 'Regelbasiert',
  plan: planTasks,
  suggestNow,
  planSchoolWork,
  rebalance: rebalanceDays,
};

let activePlanner: PlannerStrategy = ruleBasedPlanner;

export function getPlanner(): PlannerStrategy {
  return activePlanner;
}

export function setPlanner(planner: PlannerStrategy): void {
  activePlanner = planner;
}
