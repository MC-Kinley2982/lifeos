import { useMemo, useSyncExternalStore } from 'react';

/**
 * Minimaler Hash-Router (#/woche, #/tag/2026-10-03 …).
 * Hash-Routing funktioniert ohne Server-Konfiguration und zuverlässig als PWA auf dem iPhone.
 */
export type RouteName = 'today' | 'day' | 'todos' | 'week' | 'school' | 'tasks' | 'goals' | 'events' | 'routines' | 'vocab' | 'review' | 'settings' | 'more';

export interface Route {
  name: RouteName;
  params: string[];
  /** Parameter nach dem "?" (z. B. #/todos?add=Milch&when=today für Kurzbefehle/Siri). */
  query: URLSearchParams;
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
  vokabeln: 'vocab',
  rueckblick: 'review',
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
  vocab: (deckId?: string) => (deckId ? `/vokabeln/${deckId}` : '/vokabeln'),
  review: (weekStart?: string) => (weekStart ? `/rueckblick/${weekStart}` : '/rueckblick'),
  settings: (section?: string) => (section ? `/einstellungen/${section}` : '/einstellungen'),
  more: '/mehr',
};

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const q = raw.indexOf('?');
  const path = (q >= 0 ? raw.slice(0, q) : raw).replace(/^\/+/, '');
  const query = new URLSearchParams(q >= 0 ? raw.slice(q + 1) : '');
  const [first = '', ...params] = path.split('/').filter((p, i) => p !== '' || i === 0);
  return { name: SEGMENT_TO_ROUTE[first] ?? 'today', params, query };
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

const getHash = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return useMemo(() => parseHash(hash), [hash]);
}

export function navigate(path: string): void {
  const target = `#${path}`;
  if (window.location.hash !== target) {
    window.location.hash = path;
    window.scrollTo({ top: 0 });
  }
}

/** Adresse ersetzen, ohne einen neuen Verlaufseintrag anzulegen (z. B. verarbeitete Link-Parameter entfernen). */
export function replacePath(path: string): void {
  const target = `#${path}`;
  if (window.location.hash === target) return;
  window.history.replaceState(window.history.state, '', target);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function hrefFor(path: string): string {
  return `#${path}`;
}
