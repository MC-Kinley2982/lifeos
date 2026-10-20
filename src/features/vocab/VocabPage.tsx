import { useEffect, useMemo, useRef, useState } from 'react';
import { BookA, ChevronLeft, Copy, GraduationCap, Languages, Pencil, Plus, Search, Settings2, Sparkles, Upload } from 'lucide-react';
import { hrefFor, navigate, PATHS } from '../../app/router';
import type { ID, VocabCard, VocabDeck } from '../../domain/types';
import { boxCount, deckStats, dueLabel, exportVocabList, intervalOf, intervalLabel, isDue, sessionCards, type DeckStats } from '../../services/vocab/leitner';
import { useToday } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Button, IconButton } from '../../ui/Button';
import { Card, CardHeader, EmptyState, PageHeader } from '../../ui/Card';
import { alpha, cn } from '../../ui/cn';
import { toast } from '../../ui/toast';
import { StudySession } from './StudySession';
import { CardForm, DeckForm, ImportSheet, VocabSettingsSheet } from './VocabSheets';

/** Fächer, für die ein Vokabel-Deck naheliegt. */
const LANGUAGE_RE = /englisch|französisch|franzoesisch|russisch|spanisch|latein|italienisch|griechisch|chinesisch|japanisch|türkisch|polnisch|niederländisch/i;
const BOX_COLOR = '#a855f7';
const DEFAULT_COLOR = '#a78bfa';

export function useDeckColor(deck: VocabDeck | undefined): string {
  return useAppStore((s) => s.subjects.find((x) => x.id === deck?.subjectId)?.color ?? deck?.color ?? DEFAULT_COLOR);
}

/** Vokabeln: #/vokabeln (Übersicht), #/vokabeln/lernen (alles Fällige), #/vokabeln/<deck>(/lernen). */
export function VocabPage({ params }: { params: string[] }) {
  const [first, second] = params;
  if (first && first !== 'lernen') return <DeckDetail key={first} deckId={first} autoStart={second === 'lernen'} />;
  return <Overview autoStart={first === 'lernen'} />;
}

// ─── Übersicht ───────────────────────────────────────────────

function Overview({ autoStart }: { autoStart: boolean }) {
  const today = useToday();
  const decks = useAppStore((s) => s.vocabDecks);
  const cards = useAppStore((s) => s.vocabCards);
  const subjects = useAppStore((s) => s.subjects);
  const vocab = useAppStore((s) => s.settings.vocab);
  const [form, setForm] = useState<{ subjectId?: ID } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [session, setSession] = useState<ID[] | null>(null);

  const stats = useMemo(() => new Map(decks.map((d) => [d.id, deckStats(d, cards, vocab, today)])), [decks, cards, vocab, today]);
  const todo = useMemo(() => sessionCards(decks, cards, today, vocab.sessionLimit), [decks, cards, today, vocab.sessionLimit]);
  const due = [...stats.values()].reduce((s, x) => s + x.due, 0);
  const fresh = [...stats.values()].reduce((s, x) => s + x.fresh, 0);
  const languageSubjects = subjects.filter((s) => LANGUAGE_RE.test(s.name) && !decks.some((d) => d.subjectId === s.id));

  // #/vokabeln/lernen (z. B. von der Heute-Seite): direkt mit allem Fälligen starten.
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    navigate(PATHS.vocab());
    if (todo.length) setSession(todo.map((c) => c.id));
  }, [autoStart, todo]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Vokabeln"
        subtitle={decks.length ? (due + fresh ? `Heute: ${due} Wiederholungen · ${fresh} neu` : 'Für heute alles gelernt ✓') : 'Lernkartei nach dem Leitner-System'}
        actions={
          <>
            <IconButton icon={Settings2} label="Lernkartei-Einstellungen" variant="secondary" onClick={() => setSettingsOpen(true)} />
            <Button variant="primary" icon={Plus} onClick={() => setForm({})}>
              Neues Deck
            </Button>
          </>
        }
      />

      {decks.length === 0 ? (
        <Card>
          <EmptyState
            icon={Languages}
            title="Noch keine Vokabeln"
            text="Leg ein Deck an (z. B. pro Fach oder Lektion) und trag Vokabeln ein oder füge eine ganze Liste ein. LifeOS fragt jeden Tag genau die Karten ab, die fällig sind: Gewusstes kommt seltener, Vergessenes öfter."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {languageSubjects.slice(0, 3).map((s) => (
                  <Button key={s.id} variant="secondary" icon={GraduationCap} onClick={() => setForm({ subjectId: s.id })}>
                    Deck für {s.name}
                  </Button>
                ))}
                <Button variant="primary" icon={Plus} onClick={() => setForm({})}>
                  Erstes Deck anlegen
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {todo.length > 0 && (
            <button
              type="button"
              onClick={() => setSession(todo.map((c) => c.id))}
              className="group flex w-full items-center gap-4 rounded-3xl bg-gradient-to-br from-violet-500 via-violet-600 to-indigo-600 p-4 text-left shadow-xl shadow-violet-950/40 transition-transform active:scale-[0.99] sm:p-5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <Sparkles size={22} className="text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-white">Jetzt lernen · {todo.length} {todo.length === 1 ? 'Karte' : 'Karten'}</span>
                <span className="block text-xs text-white/75">
                  {due} Wiederholungen · {fresh} neu{vocab.sessionLimit > 0 && due + fresh > todo.length ? ` · höchstens ${vocab.sessionLimit} pro Einheit` : ''}
                </span>
              </span>
            </button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {decks.map((d) => (
              <DeckTile key={d.id} deck={d} stats={stats.get(d.id)!} boxes={boxCount(vocab)} />
            ))}
          </div>
          {languageSubjects.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {languageSubjects.map((s) => (
                <Button key={s.id} size="sm" variant="ghost" icon={Plus} onClick={() => setForm({ subjectId: s.id })}>
                  Deck für {s.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {form && <DeckForm subjectId={form.subjectId} onClose={() => setForm(null)} onCreated={(id) => navigate(PATHS.vocab(id))} />}
      {settingsOpen && <VocabSettingsSheet onClose={() => setSettingsOpen(false)} />}
      {session && <StudySession cardIds={session} title="Vokabeln lernen" onClose={() => setSession(null)} />}
    </div>
  );
}

function DeckTile({ deck, stats, boxes }: { deck: VocabDeck; stats: DeckStats; boxes: number }) {
  const color = useDeckColor(deck);
  const subject = useAppStore((s) => s.subjects.find((x) => x.id === deck.subjectId));
  const open = stats.due + stats.fresh;
  return (
    <a href={hrefFor(PATHS.vocab(deck.id))} className="block rounded-3xl border border-line bg-surface/80 p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: alpha(color, 0.15), color }}>
          <BookA size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{deck.name}</span>
          <span className="block truncate text-xs text-ink-muted">
            {deck.frontLabel} → {deck.backLabel}
            {subject ? ` · ${subject.name}` : ''}
          </span>
        </span>
        {open > 0 && <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-100 tabular">{open}</span>}
      </div>
      <BoxBar stats={stats} boxes={boxes} className="mt-3" />
      <p className="mt-2 text-[11px] text-ink-muted tabular">
        {stats.total} Karten · {stats.due} fällig · {stats.fresh} neu heute · {stats.learned} sicher
      </p>
    </a>
  );
}

/** Verteilung der Karten auf die Boxen (neu → sicher), hell = frisch, kräftig = gut gelernt. */
function BoxBar({ stats, boxes, className }: { stats: DeckStats; boxes: number; className?: string }) {
  const segments = [{ label: 'Neu', n: stats.unseen, color: 'rgba(255,255,255,0.12)' }, ...stats.boxes.map((n, i) => ({ label: `Box ${i + 1}`, n, color: alpha(BOX_COLOR, 0.3 + (0.7 * (i + 1)) / boxes) }))];
  const total = segments.reduce((s, x) => s + x.n, 0);
  if (total === 0) return <div className={cn('h-2 rounded-full bg-white/6', className)} />;
  return (
    <div className={cn('flex h-2 gap-[2px] overflow-hidden rounded-full', className)} role="img" aria-label={segments.map((s) => `${s.label}: ${s.n}`).join(', ')}>
      {segments.map((s) => (s.n > 0 ? <span key={s.label} title={`${s.label}: ${s.n}`} style={{ flexGrow: s.n, flexBasis: 0, background: s.color }} /> : null))}
    </div>
  );
}

// ─── Deck ────────────────────────────────────────────────────

function DeckDetail({ deckId, autoStart }: { deckId: ID; autoStart: boolean }) {
  const today = useToday();
  const deck = useAppStore((s) => s.vocabDecks.find((d) => d.id === deckId));
  const allCards = useAppStore((s) => s.vocabCards);
  const vocab = useAppStore((s) => s.settings.vocab);
  const addVocabCards = useAppStore((s) => s.addVocabCards);
  const color = useDeckColor(deck);
  const [sheet, setSheet] = useState<'edit' | 'import' | null>(null);
  const [editing, setEditing] = useState<VocabCard | null>(null);
  const [session, setSession] = useState<ID[] | null>(null);
  const [query, setQuery] = useState('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const frontRef = useRef<HTMLInputElement>(null);

  const cards = useMemo(() => allCards.filter((c) => c.deckId === deckId), [allCards, deckId]);
  const stats = useMemo(() => (deck ? deckStats(deck, allCards, vocab, today) : null), [deck, allCards, vocab, today]);
  const todo = useMemo(() => (deck ? sessionCards([deck], allCards, today, vocab.sessionLimit) : []), [deck, allCards, today, vocab.sessionLimit]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? cards.filter((c) => `${c.front} ${c.back} ${c.note ?? ''}`.toLowerCase().includes(q)) : cards;
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [cards, query]);

  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current || !deck) return;
    started.current = true;
    navigate(PATHS.vocab(deck.id));
    if (todo.length) setSession(todo.map((c) => c.id));
  }, [autoStart, deck, todo]);

  if (!deck || !stats) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Deck nicht gefunden" />
        <Card>
          <EmptyState icon={Languages} title="Dieses Deck gibt es nicht (mehr)." action={<Button onClick={() => navigate(PATHS.vocab())}>Zu den Vokabeln</Button>} />
        </Card>
      </div>
    );
  }

  const add = () => {
    if (!front.trim() || !back.trim()) return;
    addVocabCards([{ deckId: deck.id, front: front.trim(), back: back.trim() }]);
    setFront('');
    setBack('');
    frontRef.current?.focus();
  };

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(exportVocabList(cards));
      toast(`${cards.length} Vokabeln kopiert`);
    } catch {
      toast('Kopieren nicht möglich', 'info');
    }
  };

  return (
    <div className="animate-fade-in">
      <a href={hrefFor(PATHS.vocab())} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> Vokabeln
      </a>
      <PageHeader
        title={deck.name}
        subtitle={`${deck.frontLabel} → ${deck.backLabel} · ${stats.total} Karten`}
        actions={
          <>
            <IconButton icon={Pencil} label="Deck bearbeiten" variant="secondary" onClick={() => setSheet('edit')} />
            <Button variant="secondary" icon={Upload} onClick={() => setSheet('import')}>
              Liste einfügen
            </Button>
            <Button variant="primary" icon={Sparkles} disabled={todo.length === 0} onClick={() => setSession(todo.map((c) => c.id))}>
              Lernen{todo.length ? ` (${todo.length})` : ''}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-5">
          <Card>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <input
                ref={frontRef}
                value={front}
                onChange={(e) => setFront(e.target.value)}
                placeholder={deck.frontLabel}
                aria-label={deck.frontLabel}
                autoComplete="off"
                enterKeyHint="next"
                className="h-11 rounded-xl border border-line bg-surface px-3 text-base focus:border-violet-400/60 focus:outline-none"
              />
              <input
                value={back}
                onChange={(e) => setBack(e.target.value)}
                placeholder={deck.backLabel}
                aria-label={deck.backLabel}
                autoComplete="off"
                autoCapitalize="off"
                enterKeyHint="done"
                className="h-11 rounded-xl border border-line bg-surface px-3 text-base focus:border-violet-400/60 focus:outline-none"
              />
              <Button type="submit" variant="primary" icon={Plus} className="h-11" disabled={!front.trim() || !back.trim()}>
                Hinzufügen
              </Button>
            </form>
          </Card>

          <Card className="px-2 sm:px-3">
            <div className="mb-2 flex items-center gap-2 px-2">
              <Search size={15} className="shrink-0 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suchen …"
                aria-label="Vokabeln suchen"
                className="h-9 min-w-0 flex-1 bg-transparent text-base placeholder:text-ink-faint focus:outline-none sm:text-sm"
              />
              {cards.length > 0 && <IconButton icon={Copy} size="sm" label="Als Text kopieren" onClick={copyList} />}
            </div>
            {list.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-ink-muted">{cards.length ? 'Nichts gefunden.' : 'Noch keine Karten – oben eintragen oder eine Liste einfügen.'}</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {list.slice(0, 300).map((c) => (
                  <button key={c.id} type="button" onClick={() => setEditing(c)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/[0.03]">
                    <span className="grid min-w-0 flex-1 grid-cols-2 gap-3 text-sm">
                      <span className="truncate">{c.front}</span>
                      <span className="truncate text-ink-muted">{c.back}</span>
                    </span>
                    <span className={cn('shrink-0 text-[11px] tabular', isDue(c, today) ? 'text-violet-200' : 'text-ink-faint')}>
                      {c.due ? `Box ${c.box} · ${dueLabel(c, today)}` : 'neu'}
                    </span>
                  </button>
                ))}
                {list.length > 300 && <p className="px-2 py-2 text-xs text-ink-faint">… und {list.length - 300} weitere (Suche nutzen)</p>}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Lernstand" icon={BookA} subtitle={`${stats.due} fällig · ${stats.fresh} neu heute · ${stats.unseen} noch nie gelernt`} />
          <div className="space-y-2.5">
            {stats.boxes.map((n, i) => {
              const max = Math.max(1, ...stats.boxes);
              return (
                <div key={i} className="grid grid-cols-[52px_minmax(0,1fr)_32px] items-center gap-3 text-xs">
                  <span className="text-ink-muted">Box {i + 1}</span>
                  <span className="h-2 overflow-hidden rounded-r-[4px]">
                    <span className="block h-full" style={{ width: `${(n / max) * 100}%`, background: alpha(BOX_COLOR, 0.3 + (0.7 * (i + 1)) / stats.boxes.length) }} />
                  </span>
                  <span className="text-right font-semibold text-ink tabular">{n}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
            Abstände: {stats.boxes.map((_, i) => intervalLabel(intervalOf(vocab, i + 1))).join(' · ')}. Neue Karten pro Tag: {deck.newPerDay || 'alle'}.
          </p>
          <div className="mt-3 h-1 rounded-full" style={{ background: alpha(color, 0.35) }} />
        </Card>
      </div>

      {sheet === 'edit' && <DeckForm deck={deck} onClose={() => setSheet(null)} />}
      {sheet === 'import' && <ImportSheet deck={deck} onClose={() => setSheet(null)} />}
      {editing && <CardForm card={editing} deck={deck} onClose={() => setEditing(null)} />}
      {session && <StudySession cardIds={session} title={deck.name} onClose={() => setSession(null)} />}
    </div>
  );
}
