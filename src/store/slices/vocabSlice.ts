import { stamp } from '../../domain/factories';
import { nowIso } from '../../domain/ids';
import type { VocabCard, VocabDeck } from '../../domain/types';
import { reviewCard } from '../../services/vocab/leitner';
import { patchEntity, removeById } from '../helpers';
import type { SliceCreator, VocabActions } from '../types';

export interface VocabSlice extends VocabActions {
  vocabDecks: VocabDeck[];
  vocabCards: VocabCard[];
}

/** Vokabeln: Decks (z. B. pro Fach) und Karten mit Leitner-Lernstand. */
export const createVocabSlice: SliceCreator<VocabSlice> = (set, get) => ({
  vocabDecks: [],
  vocabCards: [],

  updateVocabSettings: (patch) => set((s) => ({ settings: { ...s.settings, vocab: { ...s.settings.vocab, ...patch } } })),

  addVocabDeck: (input) => {
    const deck = stamp(input, 'deck');
    set((s) => ({ vocabDecks: [...s.vocabDecks, deck] }));
    return deck.id;
  },
  updateVocabDeck: (id, patch) => set((s) => ({ vocabDecks: patchEntity(s.vocabDecks, id, patch) })),
  removeVocabDeck: (id) =>
    set((s) => ({
      vocabDecks: removeById(s.vocabDecks, id),
      vocabCards: s.vocabCards.filter((c) => c.deckId !== id),
    })),

  addVocabCards: (inputs) => {
    // Zeitstempel je Karte um 1 ms versetzt – so bleibt die Reihenfolge einer importierten Liste beim Lernen erhalten.
    const base = Date.now();
    const cards: VocabCard[] = inputs.map((input, i) => {
      const ts = new Date(base + i).toISOString();
      return { ...stamp(input, 'card'), createdAt: ts, updatedAt: ts, box: 1, correct: 0, wrong: 0 };
    });
    set((s) => ({ vocabCards: [...s.vocabCards, ...cards] }));
    return cards.map((c) => c.id);
  },
  updateVocabCard: (id, patch) => set((s) => ({ vocabCards: patchEntity(s.vocabCards, id, patch) })),
  removeVocabCard: (id) => set((s) => ({ vocabCards: removeById(s.vocabCards, id) })),

  reviewVocabCard: (id, correct, today) => {
    const settings = get().settings.vocab;
    const ts = nowIso();
    set((s) => ({ vocabCards: s.vocabCards.map((c) => (c.id === id ? reviewCard(c, correct, settings, today, ts) : c)) }));
  },
  resetVocabCard: (id) =>
    set((s) => ({
      vocabCards: s.vocabCards.map((c) =>
        c.id === id ? { ...c, box: 1, due: undefined, introducedOn: undefined, lastReviewed: undefined, correct: 0, wrong: 0, updatedAt: nowIso() } : c,
      ),
    })),
});
