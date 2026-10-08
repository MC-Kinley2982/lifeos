import { useSyncExternalStore } from 'react';

/**
 * Minimaler Hash-Router (#/woche, #/tag/2026-10-03 …).
 * Hash-Routing funktioniert ohne Server-Konfiguration und zuverlässig als PWA auf dem iPhone.
 */
export type RouteName = 'today' | 'day' | 'todos' | 'week' | 'school' | 'tasks' | 'goals' | 'events' | 'routines' | 'settings' | 'more';

export interface Route {
  name: RouteName;
  params: string[];
}

const SEGMENT_TO_ROUTE: Record<string, RouteName> = {
  '': 'today',
  tag: 'day',
  todos: 'todos',
  woche: 'week',
  schule: 'school',
  aufgaben: 'tasks',
  ziele: 'goals',
  termine: 'events',
  routinen: 'routines',
  einstellungen: 'settings',
  mehr: 'more',
};

export const PATHS = {
  today: '/',
  day: (date: string) => `/tag/${date}`,
  todos: '/todos',
  week: (date?: string) => (date ? `/woche/${date}` : '/woche'),
  school: (tab?: string) => (tab ? `/schule/${tab}` : '/schule'),
  tasks: '/aufgaben',
  goals: '/ziele',
  events: '/termine',
  routines: '/routinen',
  settings: (section?: string) => (section ? `/einstellungen/${section}` : '/einstellungen'),
  more: '/mehr',
};

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '');
  const [first = '', ...params] = path.split('/').filter((p, i) => p !== '' || i === 0);
  return { name: SEGMENT_TO_ROUTE[first] ?? 'today', params };
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

const getHash = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return parse(hash);
}

export function navigate(path: string): void {
  const target = `#${path}`;
  if (window.location.hash !== target) {
    window.location.hash = path;
    window.scrollTo({ top: 0 });
  }
}

export function hrefFor(path: string): string {
  return `#${path}`;
}
