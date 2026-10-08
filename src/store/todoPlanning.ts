import { taskDraft } from '../domain/factories';
import { toDateKey, toHHMM } from '../domain/time';
import type { DateKey, ID } from '../domain/types';
import { getPlanner } from '../services/planner';
import { todoPlanDates, todoPlanDeadline } from '../services/todos/todos';
import { plannerDataFrom } from './schoolAutomation';
import { useAppStore } from './useAppStore';

/** Dauer-Vorschläge für "Planen". */
export const TODO_PLAN_MINUTES = [15, 30, 45, 60, 90];

export interface TodoPlanOutcome {
  placed?: { date: DateKey; start: string; end: string };
  /** Warum (noch) kein Zeitraum gefunden wurde – die Aufgabe bleibt offen und wird später mitgeplant. */
  reason?: string;
}

/**
 * "Planen": Das To-do wird zu einer Aufgabe, für die LifeOS über die normale Planung einen
 * passenden Zeitraum sucht (nach Aufgaben, vor Zielen – und nie in Freizeit-Schutz oder geschützten Zeiten).
 * Erneutes Planen (z. B. mit anderer Dauer) nutzt dieselbe Aufgabe.
 */
export function planTodo(todoId: ID, minutes: number, now = new Date()): TodoPlanOutcome {
  const state = useAppStore.getState();
  const todo = state.todos.find((t) => t.id === todoId);
  if (!todo) return { reason: 'To-do nicht gefunden.' };
  const today = toDateKey(now);
  const weekStartsOn = state.settings.ui.weekStartsOn;
  const deadline = todoPlanDeadline(todo, today, weekStartsOn);
  const estimatedMin = Math.max(5, Math.round(minutes));

  let taskId = todo.taskId && state.tasks.some((t) => t.id === todo.taskId) ? todo.taskId : undefined;
  if (taskId) {
    state.updateTask(taskId, { title: todo.title, estimatedMin, deadline, schedule: undefined, status: 'todo' });
  } else {
    taskId = state.addTask(
      taskDraft(state.settings, { title: todo.title, description: todo.note, estimatedMin, priority: todo.priority ?? 'medium', deadline, todoId }),
    );
    state.updateTodo(todoId, { taskId });
  }

  const fresh = useAppStore.getState();
  const plan = getPlanner().plan(plannerDataFrom(fresh), {
    dates: todoPlanDates(todo, today, weekStartsOn),
    now,
    includeGoals: false,
    taskIds: [taskId],
    preferSoon: true,
  });
  const item = plan.items[0];
  if (!item) return { reason: plan.unplanned[0]?.reason ?? 'Im gewünschten Zeitraum ist gerade kein passender Platz frei.' };
  fresh.applyPlan([item]);
  return { placed: { date: item.date, start: toHHMM(item.start), end: toHHMM(item.end) } };
}

/** "Nicht mehr planen": Die Aufgabe verschwindet, das To-do bleibt in der Liste. */
export function unplanTodo(todoId: ID): void {
  const state = useAppStore.getState();
  const taskId = state.todos.find((t) => t.id === todoId)?.taskId;
  if (taskId && state.tasks.some((t) => t.id === taskId)) state.removeTask(taskId);
  else if (taskId) state.updateTodo(todoId, { taskId: undefined });
}
