import { stamp } from '../../domain/factories';
import { routineSource } from '../../domain/sources';
import type { Routine } from '../../domain/types';
import { omitKey, patchEntity, removeById } from '../helpers';
import type { RoutineActions, SliceCreator } from '../types';

export interface RoutinesSlice extends RoutineActions {
  routines: Routine[];
}

export const createRoutinesSlice: SliceCreator<RoutinesSlice> = (set) => ({
  routines: [],

  addRoutine: (input) => {
    const routine = stamp(input, 'routine');
    set((state) => ({ routines: [...state.routines, routine] }));
    return routine.id;
  },

  updateRoutine: (id, patch) => set((state) => ({ routines: patchEntity(state.routines, id, patch) })),

  removeRoutine: (id) =>
    set((state) => {
      const key = routineSource(id);
      // Regeln, die auf diese Routine verweisen, mit entfernen.
      return {
        routines: removeById(state.routines, id),
        settings: {
          ...state.settings,
          dayStates: state.settings.dayStates.map((d) => ({ ...d, sourceRules: omitKey(d.sourceRules, key) })),
          breakRules: state.settings.breakRules.filter((r) => !(r.trigger.type === 'afterSource' && r.trigger.sourceKey === key)),
        },
      };
    }),
});
