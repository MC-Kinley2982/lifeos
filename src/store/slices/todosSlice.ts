import { stamp } from '../../domain/factories';
import { nowIso } from '../../domain/ids';
import type { Todo } from '../../domain/types';
import { patchEntity, removeById } from '../helpers';
import type { SliceCreator, TodoActions } from '../types';

export interface TodosSlice extends TodoActions {
  todos: Todo[];
}

/**
 * Persönliche To-do-Liste. Ein To-do blockiert keine Zeit und wird nie automatisch geplant –
 * erst "Planen" (siehe store/todoPlanning) verknüpft es mit einer Aufgabe.
 */
export const createTodosSlice: SliceCreator<TodosSlice> = (set) => ({
  todos: [],

  addTodo: (input) => {
    const todo: Todo = { ...stamp(input, 'todo'), completed: false, order: 0 };
    set((state) => ({ todos: [...state.todos, { ...todo, order: state.todos.reduce((max, t) => Math.max(max, t.order), 0) + 1 }] }));
    return todo.id;
  },

  updateTodo: (id, patch) =>
    set((state) => {
      const todo = state.todos.find((t) => t.id === id);
      const renamed = todo?.taskId && patch.title !== undefined && patch.title !== todo.title;
      return {
        todos: patchEntity(state.todos, id, patch),
        ...(renamed ? { tasks: patchEntity(state.tasks, todo.taskId!, { title: patch.title }) } : {}),
      };
    }),

  toggleTodo: (id) =>
    set((state) => {
      const todo = state.todos.find((t) => t.id === id);
      if (!todo) return {};
      const completed = !todo.completed;
      const ts = nowIso();
      const completedAt = completed ? ts : undefined;
      return {
        todos: state.todos.map((t) => (t.id === id ? { ...t, completed, completedAt, updatedAt: ts } : t)),
        // Geplantes To-do: die verknüpfte Aufgabe wird mit erledigt (bzw. wieder geöffnet).
        ...(todo.taskId
          ? { tasks: state.tasks.map((t) => (t.id === todo.taskId ? { ...t, status: completed ? 'done' : 'todo', completedAt, updatedAt: ts } : t)) }
          : {}),
      };
    }),

  removeTodo: (id) =>
    set((state) => ({
      todos: removeById(state.todos, id),
      tasks: state.tasks.filter((t) => t.todoId !== id),
    })),

  setTodoCalendarEventIds: (ids) =>
    set((state) => {
      const changed = state.todos.some((t) => t.id in ids && t.googleCalendarEventId !== ids[t.id]);
      if (!changed) return {};
      return { todos: state.todos.map((t) => (t.id in ids && t.googleCalendarEventId !== ids[t.id] ? { ...t, googleCalendarEventId: ids[t.id] } : t)) };
    }),
});
