import { CalendarDays, CalendarClock, Ellipsis, GraduationCap, ListChecks, ListTodo, Repeat, Settings, Sun, Target, type LucideIcon } from 'lucide-react';
import { PATHS, type RouteName } from './router';

export interface NavItem {
  route: RouteName;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Zusätzliche Routen, bei denen der Eintrag aktiv erscheint. */
  alsoActive?: RouteName[];
}

export const NAV_ITEMS: NavItem[] = [
  { route: 'today', label: 'Heute', path: PATHS.today, icon: Sun, alsoActive: ['day'] },
  { route: 'todos', label: 'To-dos', path: PATHS.todos, icon: ListChecks },
  { route: 'week', label: 'Woche', path: PATHS.week(), icon: CalendarDays },
  { route: 'school', label: 'Schule', path: PATHS.school(), icon: GraduationCap },
  { route: 'tasks', label: 'Aufgaben', path: PATHS.tasks, icon: ListTodo },
  { route: 'goals', label: 'Ziele', path: PATHS.goals, icon: Target },
  { route: 'events', label: 'Termine', path: PATHS.events, icon: CalendarClock },
  { route: 'routines', label: 'Routinen', path: PATHS.routines, icon: Repeat },
  { route: 'settings', label: 'Mein Alltag', path: PATHS.settings(), icon: Settings },
];

const byRoute = (r: RouteName) => NAV_ITEMS.find((i) => i.route === r)!;

/** Bereiche, die mobil unter "Mehr" liegen. */
export const MORE_ROUTES: RouteName[] = ['tasks', 'goals', 'events', 'routines', 'settings'];

/**
 * Mobile Bottom-Navigation: die im Alltag meistgenutzten Bereiche + "Mehr".
 * To-dos stehen direkt neben "Heute", damit sie auf dem iPhone mit einem Tipp erreichbar sind.
 */
export const MOBILE_NAV: NavItem[] = [
  byRoute('today'),
  byRoute('todos'),
  byRoute('week'),
  byRoute('school'),
  { route: 'more', label: 'Mehr', path: PATHS.more, icon: Ellipsis, alsoActive: MORE_ROUTES },
];

export function isActive(item: NavItem, current: RouteName): boolean {
  return item.route === current || !!item.alsoActive?.includes(current);
}
