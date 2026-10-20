import { useEffect } from 'react';
import { parseHash, PATHS, replacePath } from '../app/router';
import { toDateKey } from '../domain/time';
import { LINK_PARAM, parseTodoLink } from '../services/todos/links';
import { toast } from '../ui/toast';
import { useAppStore } from './useAppStore';

/**
 * Verarbeitet Links wie `#/todos?add=Milch%20kaufen&when=today` (Siri/Kurzbefehle):
 * legt die To-dos an, zeigt eine Bestätigung und entfernt die Parameter aus der Adresse,
 * damit Neuladen oder "Zurück" nichts doppelt anlegt.
 * `ready` wartet wie die Planung, bis Onboarding und Cloud-Daten bereit sind.
 */
export function handleIncomingLink(now = new Date()): number {
  const route = parseHash(window.location.hash);
  if (!route.query.has(LINK_PARAM)) return 0;
  // Zuerst die Adresse bereinigen – so kann derselbe Link nie zweimal verarbeitet werden.
  replacePath(PATHS.todos);
  const state = useAppStore.getState();
  const link = parseTodoLink(route.query, toDateKey(now), state.settings.ui.weekStartsOn);
  if (!link) return 0;
  for (const input of link.todos) state.addTodo(input);
  const n = link.todos.length;
  toast(n === 1 ? `To-do hinzugefügt: ${link.todos[0].title}` : `${n} To-dos hinzugefügt`);
  return n;
}

export function useIncomingLinks(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    handleIncomingLink();
    const onHash = () => handleIncomingLink();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [ready]);
}
