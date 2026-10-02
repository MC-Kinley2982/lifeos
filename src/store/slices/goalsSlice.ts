import { stamp } from '../../domain/factories';
import { createId } from '../../domain/ids';
import type { Goal } from '../../domain/types';
import { patchEntity, removeById } from '../helpers';
import type { GoalActions, SliceCreator } from '../types';

export interface GoalsSlice extends GoalActions {
  goals: Goal[];
}

export const createGoalsSlice: SliceCreator<GoalsSlice> = (set) => ({
  goals: [],

  addGoal: (input) => {
    const goal = stamp(input, 'goal');
    set((state) => ({ goals: [...state.goals, goal] }));
    return goal.id;
  },

  updateGoal: (id, patch) => set((state) => ({ goals: patchEntity(state.goals, id, patch) })),

  removeGoal: (id) =>
    set((state) => {
      // Zuordnungen lösen, Aufgaben/Routinen/Termine bleiben erhalten.
      const unlink = <T extends { goalId?: string }>(list: T[]) => list.map((x) => (x.goalId === id ? { ...x, goalId: undefined } : x));
      return {
        goals: removeById(state.goals, id),
        tasks: unlink(state.tasks),
        routines: unlink(state.routines),
        events: unlink(state.events),
      };
    }),

  logGoalTime: (goalId, minutes, date, note) =>
    set((state) => ({
      goals: state.goals.map((g) =>
        g.id === goalId ? { ...g, log: [...g.log, { id: createId('log'), date, minutes, note }] } : g,
      ),
    })),

  removeGoalLog: (goalId, logId) =>
    set((state) => ({
      goals: state.goals.map((g) => (g.id === goalId ? { ...g, log: g.log.filter((l) => l.id !== logId) } : g)),
    })),
});
