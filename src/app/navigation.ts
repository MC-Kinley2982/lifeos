import { CalendarDays, CalendarClock, Ellipsis, ListTodo, Repeat, Settings, Sun, Target, type LucideIcon } from 'lucide-react';
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
  { route: 'tasks', label: 'Aufgaben', path: PATHS.tasks, icon: ListTodo },
  { route: 'goals', label: 'Ziele', path: PATHS.goals, icon: Target },
  { route: 'events', label: 'Termine', path: PATHS.events, icon: CalendarClock },
  { route: 'routines', label: 'Routinen', path: PATHS.routines, icon: Repeat },
  { route: 'settings', label: 'Mein Alltag', path: PATHS.settings(), icon: Settings },
];

/** Mobile Bottom-Navigation: die vier wichtigsten Bereiche + "Mehr". */
export const MOBILE_NAV: NavItem[] = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  NAV_ITEMS[2],
  NAV_ITEMS[3],
  { route: 'more', label: 'Mehr', path: PATHS.more, icon: Ellipsis, alsoActive: ['events', 'routines', 'settings'] },
];

export function isActive(item: NavItem, current: RouteName): boolean {
  return item.route === current || !!item.alsoActive?.includes(current);
}
