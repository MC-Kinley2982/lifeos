import { stamp } from '../../domain/factories';
import { nowIso } from '../../domain/ids';
import { toHHMM } from '../../domain/time';
import type { Task } from '../../domain/types';
import { patchEntity, removeById } from '../helpers';
import type { SliceCreator, TaskActions } from '../types';

export interface TasksSlice extends TaskActions {
  tasks: Task[];
}

/** Beschreibung von Aufgaben, die die Auto-Planung aus Ziel-Einheiten erzeugt. */
export const GOAL_SESSION_DESCRIPTION = 'Automatisch geplante Ziel-Einheit';

export const createTasksSlice: SliceCreator<TasksSlice> = (set, get) => ({
  tasks: [],

  addTask: (input) => {
    const task = stamp(input, 'task');
    set((state) => ({ tasks: [...state.tasks, task] }));
    return task.id;
  },

  updateTask: (id, patch) => set((state) => ({ tasks: patchEntity(state.tasks, id, patch) })),

  removeTask: (id) =>
    set((state) => {
      const todoId = state.tasks.find((t) => t.id === id)?.todoId;
      return {
        tasks: removeById(state.tasks, id),
        // Das To-do bleibt – es ist danach nur nicht mehr geplant.
        ...(todoId ? { todos: patchEntity(state.todos, todoId, { taskId: undefined }) } : {}),
      };
    }),

  toggleTaskDone: (id) =>
    set((state) => {
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return {};
      const done = task.status !== 'done';
      const ts = nowIso();
      const completedAt = done ? ts : undefined;
      return {
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, status: done ? 'done' : 'todo', completedAt, updatedAt: ts } : t)),
        // Geplantes To-do: Aufgabe erledigt = To-do erledigt.
        ...(task.todoId
          ? { todos: state.todos.map((t) => (t.id === task.todoId ? { ...t, completed: done, completedAt, updatedAt: ts } : t)) }
          : {}),
      };
    }),

  setTaskSchedule: (id, schedule) => set((state) => ({ tasks: patchEntity(state.tasks, id, { schedule }) })),

  applyPlan: (items) => {
    const { settings } = get();
    set((state) => {
      let tasks = state.tasks;
      for (const item of items) {
        // auto: von der Planung gesetzt → darf später zum Schutz der Freizeit verschoben werden.
        const schedule = { date: item.date, start: toHHMM(item.start), auto: true };
        if (item.kind === 'task' && item.taskId) {
          tasks = patchEntity(tasks, item.taskId, { schedule });
        } else if (item.kind === 'goal' && item.goalId) {
          const goal = state.goals.find((g) => g.id === item.goalId);
          if (!goal) continue;
          const task = stamp<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>(
            {
              title: goal.title,
              description: GOAL_SESSION_DESCRIPTION,
              estimatedMin: item.end - item.start,
              priority: 'medium',
              categoryId: goal.categoryId ?? settings.categories[0]?.id ?? '',
              goalId: goal.id,
              energy: goal.energy,
              preferredTimeOfDay: goal.preferredTimeOfDay,
              status: 'todo',
              schedule,
            },
            'task',
          );
          tasks = [...tasks, task];
        }
      }
      return { tasks };
    });
  },
});
