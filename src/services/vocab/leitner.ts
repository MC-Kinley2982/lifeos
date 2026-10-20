import { addDays, diffDays } from '../../domain/time';
import type { DateKey, ID, VocabCard, VocabDeck, VocabSettings } from '../../domain/types';

/**
 * Lernkartei nach dem Leitner-System (reine Logik).
 * - Neue Karten liegen in Box 1 ohne Fälligkeitsdatum; pro Deck kommen täglich höchstens `newPerDay` dazu.
 * - Gewusst → eine Box weiter, nächste Abfrage nach dem Abstand dieser Box.
 * - Nicht gewusst → zurück in Box 1 (oder eine Box zurück) und morgen wieder dran;
 *   in der laufenden Lerneinheit wird die Karte am Ende noch einmal abgefragt.
 */

export const DEFAULT_INTERVALS = [1, 3, 7, 14, 30];

export function boxCount(settings: VocabSettings): number {
  return Math.max(1, settings.intervals.length);
}

/** Abstand in Tagen für eine Box (1-basiert). */
export function intervalOf(settings: VocabSettings, box: number): number {
  const list = settings.intervals.length ? settings.intervals : DEFAULT_INTERVALS;
  return Math.max(1, Math.round(list[Math.min(list.length, Math.max(1, box)) - 1]));
}

export const isNewCard = (card: VocabCard) => !card.due;

/** Bereits gelernte Karte, die heute (oder schon früher) wieder dran ist. */
export const isDue = (card: VocabCard, today: DateKey) => !!card.due && card.due <= today;

/** Neue Karten, die heute noch dazukommen dürfen (Tageslimit des Decks, älteste zuerst). */
export function newCardsForToday(deck: VocabDeck, cards: VocabCard[], today: DateKey): VocabCard[] {
  const deckCards = cards.filter((c) => c.deckId === deck.id);
  const fresh = deckCards.filter(isNewCard).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  if (deck.newPerDay <= 0) return fresh;
  const introducedToday = deckCards.filter((c) => c.introducedOn === today).length;
  return fresh.slice(0, Math.max(0, deck.newPerDay - introducedToday));
}

/** Heute fällige Wiederholungen eines Decks – am längsten überfällige zuerst, niedrige Boxen zuerst. */
export function dueCards(deck: VocabDeck, cards: VocabCard[], today: DateKey): VocabCard[] {
  return cards
    .filter((c) => c.deckId === deck.id && isDue(c, today))
    .sort((a, b) => a.due!.localeCompare(b.due!) || a.box - b.box || a.id.localeCompare(b.id));
}

/** Lernstapel für heute: erst Wiederholungen, dann neue Karten – optional begrenzt. */
export function sessionCards(decks: VocabDeck[], cards: VocabCard[], today: DateKey, limit = 0): VocabCard[] {
  const due = decks.flatMap((d) => dueCards(d, cards, today));
  const fresh = decks.flatMap((d) => newCardsForToday(d, cards, today));
  const all = [...due, ...fresh];
  return limit > 0 ? all.slice(0, limit) : all;
}

export interface DeckStats {
  total: number;
  /** Heute fällige Wiederholungen. */
  due: number;
  /** Heute neu dazukommende Karten. */
  fresh: number;
  /** Noch nie gelernte Karten insgesamt. */
  unseen: number;
  /** Karten in der letzten Box. */
  learned: number;
  /** Anzahl gelernter Karten je Box (Index 0 = Box 1). */
  boxes: number[];
}

export function deckStats(deck: VocabDeck, cards: VocabCard[], settings: VocabSettings, today: DateKey): DeckStats {
  const list = cards.filter((c) => c.deckId === deck.id);
  const n = boxCount(settings);
  const boxes = Array.from({ length: n }, () => 0);
  for (const c of list) if (!isNewCard(c)) boxes[Math.min(n, Math.max(1, c.box)) - 1]++;
  return {
    total: list.length,
    due: list.filter((c) => isDue(c, today)).length,
    fresh: newCardsForToday(deck, cards, today).length,
    unseen: list.filter(isNewCard).length,
    learned: boxes[n - 1],
    boxes,
  };
}

/** Ergebnis einer Abfrage auf die Karte anwenden. */
export function reviewCard(card: VocabCard, correct: boolean, settings: VocabSettings, today: DateKey, ts: string): VocabCard {
  const n = boxCount(settings);
  const current = Math.min(n, Math.max(1, card.box));
  const box = correct ? (isNewCard(card) ? Math.min(n, 2) : Math.min(n, current + 1)) : settings.wrongTo === 'previous' ? Math.max(1, current - 1) : 1;
  // Gewusst: Abstand der neuen Box. Nicht gewusst: morgen wieder.
  const due = addDays(today, correct ? intervalOf(settings, box) : 1);
  return {
    ...card,
    box,
    due,
    introducedOn: card.introducedOn ?? today,
    lastReviewed: today,
    correct: card.correct + (correct ? 1 : 0),
    wrong: card.wrong + (correct ? 0 : 1),
    updatedAt: ts,
  };
}

/** "heute", "morgen", "in 5 Tagen", "seit 2 Tagen fällig", "neu" */
export function dueLabel(card: VocabCard, today: DateKey): string {
  if (!card.due) return 'neu';
  const d = diffDays(today, card.due);
  if (d < 0) return `seit ${-d} ${-d === 1 ? 'Tag' : 'Tagen'} fällig`;
  if (d === 0) return 'heute fällig';
  if (d === 1) return 'morgen';
  return `in ${d} Tagen`;
}

/** "täglich", "alle 3 Tage", "alle 2 Wochen", "monatlich" */
export function intervalLabel(days: number): string {
  if (days <= 1) return 'täglich';
  if (days % 30 === 0) return days === 30 ? 'monatlich' : `alle ${days / 30} Monate`;
  if (days % 7 === 0) return days === 7 ? 'wöchentlich' : `alle ${days / 7} Wochen`;
  return `alle ${days} Tage`;
}

// ─── Antworten prüfen (Tipp-Modus) ───────────────────────────

/**
 * Vergleichbare Form: Kleinschreibung, ohne Satzzeichen, ohne Betonungsakzente (´ `), ё = е,
 * Leerzeichen zusammengefasst. Buchstaben wie й, ä, ß bleiben, wie sie sind.
 */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀́]/g, '') // Betonungszeichen (z. B. in russischen Wörterbüchern), é → e
    .normalize('NFC')
    .replace(/ё/g, 'е')
    .replace(/[.,;:!?¡¿"'„“”«»()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stimmt die getippte Antwort? Mehrere erlaubte Antworten können mit "," "/" oder ";" getrennt sein. */
export function isAnswerCorrect(typed: string, expected: string): boolean {
  const t = normalizeAnswer(typed);
  if (!t) return false;
  const options = [expected, ...expected.split(/[,/;]/)].map(normalizeAnswer).filter(Boolean);
  return options.includes(t);
}

// ─── Import ──────────────────────────────────────────────────

export interface ParsedVocab {
  front: string;
  back: string;
}

/**
 * Text mit einer Vokabel pro Zeile einlesen. Trennzeichen (das erste gefundene):
 * Tab, ";", " = ", " – ", " - ", "=" – z. B. "Haus ; дом" oder aus einer Tabelle kopiert.
 */
export function parseVocabList(text: string): { items: ParsedVocab[]; skipped: string[] } {
  const items: ParsedVocab[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sep = ['\t', ';', ' = ', ' – ', ' — ', ' - ', '='].find((s) => line.includes(s));
    if (!sep) {
      skipped.push(line);
      continue;
    }
    const i = line.indexOf(sep);
    const front = line.slice(0, i).trim();
    const back = line.slice(i + sep.length).trim();
    if (front && back) items.push({ front, back });
    else skipped.push(line);
  }
  return { items, skipped };
}

/** Deck als Text (eine Vokabel pro Zeile, "Vorderseite ; Rückseite") – zum Sichern oder Teilen. */
export function exportVocabList(cards: VocabCard[]): string {
  return cards.map((c) => `${c.front} ; ${c.back}`).join('\n');
}

/** IDs der Karten, deren Vorderseite es im Deck schon gibt (für den Import ohne Duplikate). */
export function duplicateFronts(cards: VocabCard[], deckId: ID): Set<string> {
  return new Set(cards.filter((c) => c.deckId === deckId).map((c) => normalizeAnswer(c.front)));
}
