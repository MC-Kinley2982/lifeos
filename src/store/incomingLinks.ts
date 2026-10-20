import { useEffect } from 'react';
import { parseHash, PATHS, replacePath } from '../app/router';
import { toDateKey } from '../domain/time';
import { parseQuickAdd } from '../services/nlp/quickAdd';
import { LINK_PARAM, parseTodoLink } from '../services/todos/links';
import { applyQuickParse } from '../services/todos/todos';
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
  const today = toDateKey(now);
  const { weekStartsOn, smartQuickAdd } = state.settings.ui;
  const link = parseTodoLink(route.query, today, weekStartsOn);
  if (!link) return 0;
  // Ohne ausdrückliches "when" darf die Texterkennung den Tag bestimmen ("Hey Siri … morgen Sporttasche packen").
  const parse = (title: string) => (smartQuickAdd && !link.explicitWhen ? parseQuickAdd(title, { today, weekStartsOn, ignore: ['timeOfDay'] }) : null);
  for (const input of link.todos) state.addTodo(applyQuickParse(input, parse(input.title)));
  const n = link.todos.length;
  toast(n === 1 ? `To-do hinzugefügt: ${useAppStore.getState().todos.at(-1)?.title ?? link.todos[0].title}` : `${n} To-dos hinzugefügt`);
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
