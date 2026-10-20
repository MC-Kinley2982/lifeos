import { beforeEach, describe, expect, it } from 'vitest';
import { createExampleData, defaultVocabSettings } from '../../domain/defaults';
import type { DateKey, VocabCard, VocabDeck, VocabSettings } from '../../domain/types';
import { emptyData, migrate, normalizeData } from '../../store/persistence';
import { useAppStore } from '../../store/useAppStore';
import { applyRecords, toRecords } from '../sync/records';
import {
  deckStats,
  dueCards,
  dueLabel,
  intervalLabel,
  isAnswerCorrect,
  newCardsForToday,
  parseVocabList,
  reviewCard,
  sessionCards,
} from './leitner';

const TODAY: DateKey = '2026-10-06';
const ts = '2026-10-01T08:00:00.000Z';
const settings: VocabSettings = defaultVocabSettings();
const deck: VocabDeck = { id: 'd1', name: 'Russisch', frontLabel: 'Deutsch', backLabel: 'Russisch', direction: 'forward', newPerDay: 2, createdAt: ts, updatedAt: ts };
const card = (id: string, patch: Partial<VocabCard> = {}): VocabCard => ({
  id,
  deckId: 'd1',
  front: `Wort ${id}`,
  back: `слово ${id}`,
  box: 1,
  correct: 0,
  wrong: 0,
  createdAt: `2026-10-01T08:00:0${id.length}.000Z`,
  updatedAt: ts,
  ...patch,
});

describe('Leitner-Boxen', () => {
  it('gewusst → nächste Box mit längerem Abstand, nicht gewusst → Box 1, morgen wieder', () => {
    const fresh = card('a');
    const r1 = reviewCard(fresh, true, settings, TODAY, ts);
    expect(r1).toMatchObject({ box: 2, due: '2026-10-09', introducedOn: TODAY, correct: 1 });
    const r2 = reviewCard(r1, true, settings, '2026-10-09', ts);
    expect(r2).toMatchObject({ box: 3, due: '2026-10-16' });
    const wrong = reviewCard(r2, false, settings, '2026-10-16', ts);
    expect(wrong).toMatchObject({ box: 1, due: '2026-10-17', wrong: 1, introducedOn: TODAY });
    const soft = reviewCard(r2, false, { ...settings, wrongTo: 'previous' }, '2026-10-16', ts);
    expect(soft.box).toBe(2);
  });

  it('die letzte Box bleibt die letzte (monatlich)', () => {
    const top = card('a', { box: 5, due: TODAY });
    expect(reviewCard(top, true, settings, TODAY, ts)).toMatchObject({ box: 5, due: '2026-11-05' });
  });

  it('Anzahl der Boxen folgt den Abständen', () => {
    const three: VocabSettings = { ...settings, intervals: [1, 2, 5] };
    expect(reviewCard(card('a', { box: 3, due: TODAY }), true, three, TODAY, ts)).toMatchObject({ box: 3, due: '2026-10-11' });
  });
});

describe('Fällige Karten pro Tag', () => {
  const cards = [
    card('n1'),
    card('n22'),
    card('n333'),
    card('due-old', { box: 3, due: '2026-10-01' }),
    card('due-today', { box: 1, due: TODAY }),
    card('later', { box: 2, due: '2026-10-08' }),
    card('other', { deckId: 'd2', due: TODAY }),
  ];

  it('Wiederholungen: überfällige zuerst; neue Karten nach Tageslimit', () => {
    expect(dueCards(deck, cards, TODAY).map((c) => c.id)).toEqual(['due-old', 'due-today']);
    expect(newCardsForToday(deck, cards, TODAY).map((c) => c.id)).toEqual(['n1', 'n22']);
    const oneIntroduced = cards.map((c) => (c.id === 'n1' ? { ...c, due: '2026-10-07', introducedOn: TODAY } : c));
    expect(newCardsForToday(deck, oneIntroduced, TODAY).map((c) => c.id)).toEqual(['n22']);
    expect(newCardsForToday({ ...deck, newPerDay: 0 }, cards, TODAY)).toHaveLength(3);
  });

  it('Lernstapel: erst Wiederholungen, dann Neues, optional begrenzt', () => {
    expect(sessionCards([deck], cards, TODAY).map((c) => c.id)).toEqual(['due-old', 'due-today', 'n1', 'n22']);
    expect(sessionCards([deck], cards, TODAY, 3)).toHaveLength(3);
  });

  it('Statistik pro Deck', () => {
    expect(deckStats(deck, cards, settings, TODAY)).toEqual({ total: 6, due: 2, fresh: 2, unseen: 3, learned: 0, boxes: [1, 1, 1, 0, 0] });
  });

  it('Beschriftungen', () => {
    expect(dueLabel(card('x'), TODAY)).toBe('neu');
    expect(dueLabel(card('x', { due: '2026-10-04' }), TODAY)).toBe('seit 2 Tagen fällig');
    expect(dueLabel(card('x', { due: TODAY }), TODAY)).toBe('heute fällig');
    expect(dueLabel(card('x', { due: '2026-10-11' }), TODAY)).toBe('in 5 Tagen');
    expect([1, 3, 7, 14, 30, 60].map(intervalLabel)).toEqual(['täglich', 'alle 3 Tage', 'wöchentlich', 'alle 2 Wochen', 'monatlich', 'alle 2 Monate']);
  });
});

describe('Antwort prüfen & Import', () => {
  it('tolerant bei Groß-/Kleinschreibung, Satzzeichen, Betonung und ё – aber nicht bei anderen Buchstaben', () => {
    expect(isAnswerCorrect('Дом', 'дом')).toBe(true);
    expect(isAnswerCorrect(' дом! ', 'дом')).toBe(true);
    expect(isAnswerCorrect('молоко', 'молоко́')).toBe(true);
    expect(isAnswerCorrect('еще', 'ещё')).toBe(true);
    expect(isAnswerCorrect('мои', 'мой')).toBe(false);
    expect(isAnswerCorrect('gehen', 'gehen, laufen')).toBe(true);
    expect(isAnswerCorrect('laufen', 'gehen / laufen')).toBe(true);
    expect(isAnswerCorrect('', 'дом')).toBe(false);
  });

  it('liest Listen mit Tab, Semikolon, Gleichheits- oder Bindestrich', () => {
    const { items, skipped } = parseVocabList('Haus ; дом\nKatze\tкошка\nHund = собака\nMilch – молоко\nnur ein Wort\n\nder Ball - мяч');
    expect(items).toEqual([
      { front: 'Haus', back: 'дом' },
      { front: 'Katze', back: 'кошка' },
      { front: 'Hund', back: 'собака' },
      { front: 'Milch', back: 'молоко' },
      { front: 'der Ball', back: 'мяч' },
    ]);
    expect(skipped).toEqual(['nur ein Wort']);
  });
});

describe('Store & Sync', () => {
  const store = () => useAppStore.getState();
  beforeEach(() => {
    store().resetAll();
    store().completeOnboarding({ name: '', withExample: false, today: TODAY });
  });

  it('Deck mit Karten anlegen, abfragen, zurücksetzen, löschen', () => {
    const deckId = store().addVocabDeck({ name: 'Russisch', frontLabel: 'Deutsch', backLabel: 'Russisch', direction: 'forward', newPerDay: 10 });
    const [a, b] = store().addVocabCards([
      { deckId, front: 'Haus', back: 'дом' },
      { deckId, front: 'Katze', back: 'кошка' },
    ]);
    expect(store().vocabCards.map((c) => [c.box, c.due])).toEqual([
      [1, undefined],
      [1, undefined],
    ]);
    store().reviewVocabCard(a, true, TODAY);
    expect(store().vocabCards.find((c) => c.id === a)).toMatchObject({ box: 2, due: '2026-10-09' });
    store().resetVocabCard(a);
    expect(store().vocabCards.find((c) => c.id === a)).toMatchObject({ box: 1, due: undefined, correct: 0 });

    const data = normalizeData({ ...emptyData(), ...store() });
    const records = [...toRecords(data).values()].map((r) => ({ ...r, deleted: false, updatedAt: ts }));
    expect(records.filter((r) => r.collection === 'vocabCards')).toHaveLength(2);
    expect(applyRecords(emptyData(), records).vocabDecks).toEqual(store().vocabDecks);

    store().removeVocabDeck(deckId);
    expect(store().vocabCards.some((c) => c.id === b)).toBe(false);
  });

  it('Migration V6 → V7: Vokabeln leer, Standard-Boxen', () => {
    const old = JSON.parse(JSON.stringify(createExampleData(TODAY, 'Josh')));
    delete old.settings.vocab;
    const data = normalizeData(migrate(old, 6));
    expect(data.vocabDecks).toEqual([]);
    expect(data.vocabCards).toEqual([]);
    expect(data.settings.vocab.intervals).toEqual([1, 3, 7, 14, 30]);
  });
});
