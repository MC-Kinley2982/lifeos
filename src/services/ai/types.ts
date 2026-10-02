import type { PlannerStrategy } from '../planner';

/**
 * Platzhalter für einen späteren KI-Planer.
 *
 * Ein KI-Planer implementiert dasselbe `PlannerStrategy`-Interface wie der regelbasierte
 * Planer und wird über `setPlanner()` aktiviert. Er bekommt denselben `PlannerData`-Snapshot,
 * damit keine UI-Komponente angepasst werden muss. Noch nicht implementiert.
 */
export type AIPlannerStrategy = PlannerStrategy & {
  model: string;
};
