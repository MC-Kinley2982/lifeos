import { useMemo } from 'react';
import { Languages, Sparkles } from 'lucide-react';
import { hrefFor, PATHS } from '../../app/router';
import type { DateKey } from '../../domain/types';
import { dueCards, newCardsForToday } from '../../services/vocab/leitner';
import { useAppStore } from '../../store/useAppStore';
import { Card } from '../../ui/Card';

/** Heute fällige Vokabeln (nur sichtbar, wenn es etwas zu lernen gibt). */
export function VocabTodayCard({ today }: { today: DateKey }) {
  const decks = useAppStore((s) => s.vocabDecks);
  const cards = useAppStore((s) => s.vocabCards);
  const { due, fresh } = useMemo(
    () => ({
      due: decks.reduce((n, d) => n + dueCards(d, cards, today).length, 0),
      fresh: decks.reduce((n, d) => n + newCardsForToday(d, cards, today).length, 0),
    }),
    [decks, cards, today],
  );
  if (due + fresh === 0) return null;

  return (
    <Card className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200">
        <Languages size={19} />
      </span>
      <a href={hrefFor(PATHS.vocab())} className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold tracking-tight">Vokabeln</span>
        <span className="block text-xs text-ink-muted">
          {due} fällig · {fresh} neu
        </span>
      </a>
      <a
        href={hrefFor(`${PATHS.vocab()}/lernen`)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 px-3.5 text-sm font-medium text-white shadow-lg shadow-violet-900/30"
      >
        <Sparkles size={14} /> Lernen
      </a>
    </Card>
  );
}
