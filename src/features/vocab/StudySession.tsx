import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Keyboard, PartyPopper, RotateCcw, X } from 'lucide-react';
import type { ID, VocabDirection } from '../../domain/types';
import { isAnswerCorrect } from '../../services/vocab/leitner';
import { useToday } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { isEditable } from '../../ui/interaction';
import { Sheet } from '../../ui/Sheet';

interface QueueItem {
  id: ID;
  /** Wiederholung in derselben Einheit (nach "nicht gewusst") – ändert den Lernstand nicht noch einmal. */
  retry: boolean;
  /** forward = Vorderseite zeigen, Rückseite nennen. */
  dir: 'forward' | 'backward';
}

const pickDir = (direction: VocabDirection): QueueItem['dir'] => (direction === 'mixed' ? (Math.random() < 0.5 ? 'forward' : 'backward') : direction);

/**
 * Lerneinheit: Karte zeigen → aufdecken (oder Antwort tippen) → "Gewusst" / "Nicht gewusst".
 * Nicht Gewusstes kommt am Ende der Einheit noch einmal. Tastatur: Leertaste/Enter = aufdecken,
 * 1 bzw. ← = nicht gewusst, 2 bzw. → = gewusst.
 */
export function StudySession({ cardIds, title, onClose }: { cardIds: ID[]; title: string; onClose: () => void }) {
  const today = useToday();
  const cards = useAppStore((s) => s.vocabCards);
  const decks = useAppStore((s) => s.vocabDecks);
  const reviewVocabCard = useAppStore((s) => s.reviewVocabCard);
  const [queue, setQueue] = useState<QueueItem[]>(() =>
    cardIds.map((id) => {
      const card = useAppStore.getState().vocabCards.find((c) => c.id === id);
      const deck = useAppStore.getState().vocabDecks.find((d) => d.id === card?.deckId);
      return { id, retry: false, dir: pickDir(deck?.direction ?? 'forward') };
    }),
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const item = queue[index];
  const card = useMemo(() => cards.find((c) => c.id === item?.id), [cards, item]);
  const deck = decks.find((d) => d.id === card?.deckId);
  const done = !item;
  const firstRound = cardIds.length;
  const question = card ? (item.dir === 'forward' ? card.front : card.back) : '';
  const answer = card ? (item.dir === 'forward' ? card.back : card.front) : '';
  const askLabel = deck ? (item?.dir === 'forward' ? deck.frontLabel : deck.backLabel) : '';
  const answerLabel = deck ? (item?.dir === 'forward' ? deck.backLabel : deck.frontLabel) : '';

  const next = () => {
    setRevealed(false);
    setTyped('');
    setVerdict(null);
    setIndex((i) => i + 1);
  };

  const grade = (correct: boolean) => {
    if (!item || !card) return next();
    if (!item.retry) {
      reviewVocabCard(card.id, correct, today);
      setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1) }));
    }
    if (!correct) setQueue((q) => [...q, { ...item, retry: true }]);
    next();
  };

  const check = () => {
    setVerdict(isAnswerCorrect(typed, answer));
    setRevealed(true);
  };

  // Tastatur (nicht, während in einem Feld getippt wird – außer Enter im Antwortfeld, das das Formular übernimmt).
  const gradeRef = useRef(grade);
  gradeRef.current = grade;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || isEditable(e.target as Element)) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        if (!typing) setRevealed(true);
      } else if (revealed && (e.key === '1' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        gradeRef.current(false);
      } else if (revealed && (e.key === '2' || e.key === 'ArrowRight' || (e.key === 'Enter' && verdict !== null))) {
        e.preventDefault();
        gradeRef.current(verdict ?? true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [done, revealed, typing, verdict]);

  useEffect(() => {
    if (typing && !revealed) inputRef.current?.focus({ preventScroll: true });
  }, [typing, revealed, index]);

  const progress = Math.min(index, queue.length);

  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title={title}
      subtitle={done ? 'Fertig für heute' : `${Math.min(progress + 1, queue.length)} / ${queue.length}${queue.length > firstRound ? ' (inkl. Wiederholungen)' : ''}`}
      footer={
        done ? (
          <Button variant="primary" block onClick={onClose}>
            Fertig
          </Button>
        ) : !revealed ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" icon={Keyboard} onClick={() => setTyping((t) => !t)} aria-pressed={typing}>
              {typing ? 'Aufdecken statt tippen' : 'Antwort tippen'}
            </Button>
            {!typing && (
              <Button variant="primary" className="ml-auto" onClick={() => setRevealed(true)}>
                Aufdecken
              </Button>
            )}
          </div>
        ) : verdict === null ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => grade(false)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 text-[15px] font-medium text-red-200 transition-colors hover:bg-red-500/20 active:scale-[0.98]"
            >
              <X size={17} /> Nicht gewusst
            </button>
            <button
              type="button"
              onClick={() => grade(true)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 text-[15px] font-medium text-emerald-100 transition-colors hover:bg-emerald-500/25 active:scale-[0.98]"
            >
              <Check size={17} /> Gewusst
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {!verdict && (
              <Button variant="ghost" onClick={() => grade(true)}>
                Zählt doch als richtig
              </Button>
            )}
            <Button variant="primary" className="ml-auto" onClick={() => grade(verdict)}>
              Weiter
            </Button>
          </div>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            <PartyPopper size={26} />
          </span>
          <p className="text-lg font-semibold">Geschafft!</p>
          <p className="mt-1 text-sm text-ink-muted">
            {score.correct} gewusst · {score.wrong} noch nicht – die kommen morgen wieder dran.
          </p>
        </div>
      ) : card ? (
        <div className="space-y-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
            <div className="h-full rounded-full bg-violet-400 transition-[width] duration-300" style={{ width: `${(progress / queue.length) * 100}%` }} />
          </div>
          <div className="rounded-3xl border border-line bg-surface p-5 text-center sm:p-8">
            <div className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">
              {askLabel}
              {item.retry && (
                <span className="ml-2 inline-flex items-center gap-1 normal-case">
                  <RotateCcw size={10} /> Wiederholung
                </span>
              )}
            </div>
            <div className="mt-2 text-2xl font-semibold break-words sm:text-3xl">{question}</div>
            {revealed && (
              <div className="mt-5 animate-fade-in border-t border-line pt-5">
                <div className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">{answerLabel}</div>
                <div className={cn('mt-2 text-2xl font-semibold break-words sm:text-3xl', verdict === true && 'text-emerald-300', verdict === false && 'text-amber-200')}>
                  {answer}
                </div>
                {card.note && <p className="mt-2 text-sm text-ink-muted">{card.note}</p>}
                {verdict !== null && (
                  <p className={cn('mt-3 text-sm', verdict ? 'text-emerald-300' : 'text-amber-200')}>
                    {verdict ? 'Richtig ✓' : `Deine Antwort: „${typed.trim() || '–'}“`}
                  </p>
                )}
              </div>
            )}
          </div>
          {typing && !revealed && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                check();
              }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={`${answerLabel} …`}
                aria-label="Antwort"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="done"
                className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 text-base focus:border-violet-400/60 focus:outline-none"
              />
              <Button type="submit" variant="primary" size="lg">
                Prüfen
              </Button>
            </form>
          )}
          <p className="hidden text-center text-[11px] text-ink-faint sm:block">
            Tastatur: Leertaste = aufdecken · 1 / ← = nicht gewusst · 2 / → = gewusst
          </p>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-ink-muted">Diese Karte gibt es nicht mehr.</p>
      )}
    </Sheet>
  );
}
