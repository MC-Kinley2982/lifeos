import { CalendarDays, CalendarClock, Ellipsis, GraduationCap, ListTodo, Repeat, Settings, Sun, Target, type LucideIcon } from 'lucide-react';
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
  { route: 'week', label: 'Woche', path: PATHS.week(), icon: CalendarDays },
  { route: 'school', label: 'Schule', path: PATHS.school(), icon: GraduationCap },
  { route: 'tasks', label: 'Aufgaben', path: PATHS.tasks, icon: ListTodo },
  { route: 'goals', label: 'Ziele', path: PATHS.goals, icon: Target },
  { route: 'events', label: 'Termine', path: PATHS.events, icon: CalendarClock },
  { route: 'routines', label: 'Routinen', path: PATHS.routines, icon: Repeat },
  { route: 'settings', label: 'Mein Alltag', path: PATHS.settings(), icon: Settings },
];

const byRoute = (r: RouteName) => NAV_ITEMS.find((i) => i.route === r)!;

/** Mobile Bottom-Navigation: die wichtigsten Bereiche + "Mehr". */
export const MOBILE_NAV: NavItem[] = [
  byRoute('today'),
  byRoute('week'),
  byRoute('school'),
  byRoute('tasks'),
  { route: 'more', label: 'Mehr', path: PATHS.more, icon: Ellipsis, alsoActive: ['goals', 'events', 'routines', 'settings'] },
];

/** Bereiche, die mobil unter "Mehr" liegen. */
export const MORE_ROUTES: RouteName[] = ['goals', 'events', 'routines', 'settings'];

export function isActive(item: NavItem, current: RouteName): boolean {
  return item.route === current || !!item.alsoActive?.includes(current);
}
