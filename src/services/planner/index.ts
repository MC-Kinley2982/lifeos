import { planTasks } from './autoPlan';
import { suggestNow } from './suggest';
import type { NowSuggestion, PlannerData, PlanOptions, PlanResult } from './types';

export * from './types';
export { buildDaySchedule, awakeWindow, sleepTimesFor } from './schedule';
export { resolveDayState, isSourceActive, getDailyState, emptyDailyState } from './dayState';
export { estimateEnergy, requiredEnergy, energyFits } from './energy';
export { freeSlotsFrom, freeMinutesFrom, planningBudget, plannableSlots, timeOfDayAt } from './freeTime';
export { computeGoalProgress } from './goals';

/**
 * Abstraktionsschicht für Planungs-Strategien.
 * V1 nutzt die regelbasierte Strategie. Ein späterer KI-Planer (services/ai) implementiert
 * dasselbe Interface und kann ohne Änderungen an der UI eingesetzt werden.
 */
export interface PlannerStrategy {
  id: string;
  name: string;
  plan(data: PlannerData, options: PlanOptions): PlanResult;
  suggestNow(data: PlannerData, now: Date): NowSuggestion;
}

export const ruleBasedPlanner: PlannerStrategy = {
  id: 'rule-based',
  name: 'Regelbasiert',
  plan: planTasks,
  suggestNow,
};

let activePlanner: PlannerStrategy = ruleBasedPlanner;

export function getPlanner(): PlannerStrategy {
  return activePlanner;
}

export function setPlanner(planner: PlannerStrategy): void {
  activePlanner = planner;
}
