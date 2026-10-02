import { stamp } from '../../domain/factories';
import { nowIso } from '../../domain/ids';
import { toHHMM } from '../../domain/time';
import type { Task } from '../../domain/types';
import { patchEntity, removeById } from '../helpers';
import type { SliceCreator, TaskActions } from '../types';

export interface TasksSlice extends TaskActions {
  tasks: Task[];
}

export const createTasksSlice: SliceCreator<TasksSlice> = (set, get) => ({
  tasks: [],

  addTask: (input) => {
    const task = stamp(input, 'task');
    set((state) => ({ tasks: [...state.tasks, task] }));
    return task.id;
  },

  updateTask: (id, patch) => set((state) => ({ tasks: patchEntity(state.tasks, id, patch) })),

  removeTask: (id) => set((state) => ({ tasks: removeById(state.tasks, id) })),

  toggleTaskDone: (id) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== id) return t;
        const done = t.status !== 'done';
        return { ...t, status: done ? 'done' : 'todo', completedAt: done ? nowIso() : undefined, updatedAt: nowIso() };
      }),
    })),

  setTaskSchedule: (id, schedule) => set((state) => ({ tasks: patchEntity(state.tasks, id, { schedule }) })),

  applyPlan: (items) => {
    const { settings } = get();
    set((state) => {
      let tasks = state.tasks;
      for (const item of items) {
        const schedule = { date: item.date, start: toHHMM(item.start) };
        if (item.kind === 'task' && item.taskId) {
          tasks = patchEntity(tasks, item.taskId, { schedule });
        } else if (item.kind === 'goal' && item.goalId) {
          const goal = state.goals.find((g) => g.id === item.goalId);
          if (!goal) continue;
          const task = stamp<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>(
            {
              title: goal.title,
              description: 'Automatisch geplante Ziel-Einheit',
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
