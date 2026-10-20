import type { TodoInput } from '../../domain/factories';
import { isValidTime } from '../../domain/time';
import type { DateKey, Weekday } from '../../domain/types';
import { whenToFields, type TodoWhen } from './todos';

/**
 * To-dos per Link anlegen – Grundlage für Kurzbefehle (Siri, iOS-Kurzbefehle-App, Lesezeichen):
 *
 *   #/todos?add=Sporttasche%20packen&when=tomorrow&time=07:30
 *
 * add   Titel (Pflicht). Mehrere Zeilen = mehrere To-dos.
 * when  today|heute · tomorrow|morgen · week|woche · later|spaeter|später · YYYY-MM-DD (Standard: today)
 * time  optionale Uhrzeit HH:MM
 * note  optionale Notiz
 * important=1  als wichtig markieren
 */
export const LINK_PARAM = 'add';

const WHEN_ALIASES: Record<string, TodoWhen> = {
  today: 'today',
  heute: 'today',
  tomorrow: 'tomorrow',
  morgen: 'tomorrow',
  week: 'week',
  woche: 'week',
  later: 'later',
  spaeter: 'later',
  später: 'later',
  irgendwann: 'later',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TRUE_VALUES = new Set(['1', 'true', 'ja', 'yes']);

export interface TodoLink {
  todos: TodoInput[];
  /** Wurde "when" ausdrücklich angegeben? (sonst darf die Texterkennung den Tag bestimmen) */
  explicitWhen: boolean;
}

/** Liest die Link-Parameter. Ohne gültigen Titel → null. */
export function parseTodoLink(query: URLSearchParams, today: DateKey, weekStartsOn: Weekday): TodoLink | null {
  const raw = query.get(LINK_PARAM);
  if (!raw) return null;
  const titles = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((line) => line.slice(0, 300));
  if (titles.length === 0) return null;

  const whenRaw = query.get('when')?.trim().toLowerCase() ?? '';
  const explicitWhen = whenRaw !== '';
  const fields = DATE_RE.test(whenRaw)
    ? whenToFields('date', today, weekStartsOn, whenRaw)
    : whenToFields(WHEN_ALIASES[whenRaw] ?? 'today', today, weekStartsOn);
  const time = query.get('time')?.trim();
  const note = query.get('note')?.trim();
  const important = TRUE_VALUES.has(query.get('important')?.trim().toLowerCase() ?? '');

  return {
    explicitWhen,
    todos: titles.map((title) => ({
      title,
      ...fields,
      ...(time && isValidTime(time) && fields.horizon === 'day' ? { time } : {}),
      ...(note ? { note } : {}),
      ...(important ? { priority: 'high' as const } : {}),
    })),
  };
}

/** Link zum Anlegen eines To-dos (für die Anleitung und zum Ausprobieren). */
export function buildTodoLink(appUrl: string, title: string, when: string = 'today'): string {
  const params = new URLSearchParams({ [LINK_PARAM]: title, when });
  return `${appUrl}#/todos?${params.toString().replace(/\+/g, '%20')}`;
}
