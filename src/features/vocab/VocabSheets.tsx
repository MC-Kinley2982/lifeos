import { useMemo, useState } from 'react';
import { Minus, Plus, RotateCcw, Upload } from 'lucide-react';
import { vocabDeckDraft, type VocabDeckInput } from '../../domain/factories';
import type { ID, VocabCard, VocabDeck, VocabDirection } from '../../domain/types';
import { duplicateFronts, intervalLabel, normalizeAnswer, parseVocabList } from '../../services/vocab/leitner';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { ColorPicker, DeleteButton, Segmented } from '../../ui/controls';
import { Field, NumberInput, Select, TextArea, TextInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';

// ─── Deck anlegen / bearbeiten ───────────────────────────────

export function DeckForm({ deck, subjectId, onClose, onCreated }: { deck?: VocabDeck; subjectId?: ID; onClose: () => void; onCreated?: (id: ID) => void }) {
  const subjects = useAppStore((s) => s.subjects);
  const { addVocabDeck, updateVocabDeck, removeVocabDeck } = useAppStore.getState();
  const cardCount = useAppStore((s) => (deck ? s.vocabCards.filter((c) => c.deckId === deck.id).length : 0));
  const [draft, setDraft] = useState<VocabDeckInput>(() => (deck ? { ...deck } : vocabDeckDraft(subjects.find((s) => s.id === subjectId))));
  const set = <K extends keyof VocabDeckInput>(key: K, value: VocabDeckInput[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    if (!draft.name.trim()) return;
    const next = { ...draft, name: draft.name.trim(), frontLabel: draft.frontLabel.trim() || 'Vorderseite', backLabel: draft.backLabel.trim() || 'Rückseite' };
    if (deck) updateVocabDeck(deck.id, next);
    else onCreated?.(addVocabDeck(next));
    toast(deck ? 'Deck gespeichert' : 'Deck angelegt');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={deck ? 'Deck bearbeiten' : 'Neues Deck'}
      footer={
        <div className="flex items-center gap-2">
          {deck && (
            <DeleteButton
              label={cardCount ? `Löschen (${cardCount} Karten)` : 'Löschen'}
              onConfirm={() => {
                removeVocabDeck(deck.id);
                toast('Deck gelöscht', 'info');
                onClose();
              }}
            />
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={save} disabled={!draft.name.trim()}>
              Speichern
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Name">
          <TextInput autoFocus={!deck} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. Russisch Lektion 3" />
        </Field>
        <Field label="Fach (optional)">
          <Select
            value={draft.subjectId ?? ''}
            onChange={(e) => {
              const subject = subjects.find((s) => s.id === e.target.value);
              setDraft((d) => ({ ...d, subjectId: subject?.id, backLabel: !deck && subject ? subject.name : d.backLabel }));
            }}
          >
            <option value="">Kein Fach</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        {!draft.subjectId && (
          <Field label="Farbe">
            <ColorPicker value={draft.color ?? '#a78bfa'} onChange={(c) => set('color', c)} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vorderseite">
            <TextInput value={draft.frontLabel} onChange={(e) => set('frontLabel', e.target.value)} placeholder="Deutsch" />
          </Field>
          <Field label="Rückseite">
            <TextInput value={draft.backLabel} onChange={(e) => set('backLabel', e.target.value)} placeholder="Russisch" />
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Abfragen</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Abfragerichtung">
            {(
              [
                { value: 'forward', label: `${draft.frontLabel || 'Vorne'} → ${draft.backLabel || 'Hinten'}` },
                { value: 'backward', label: `${draft.backLabel || 'Hinten'} → ${draft.frontLabel || 'Vorne'}` },
                { value: 'mixed', label: 'Gemischt' },
              ] as Array<{ value: VocabDirection; label: string }>
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={draft.direction === o.value}
                onClick={() => set('direction', o.value)}
                className={cn(
                  'h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors',
                  draft.direction === o.value ? 'bg-violet-500/90 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Neue Karten pro Tag" hint="0 = alle neuen Karten auf einmal. So bleibt das tägliche Pensum überschaubar.">
          <NumberInput className="w-36" value={draft.newPerDay} min={0} max={200} suffix="pro Tag" onChange={(v) => set('newPerDay', Math.max(0, Math.min(200, Math.round(v))))} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}

// ─── Karte bearbeiten ────────────────────────────────────────

export function CardForm({ card, deck, onClose }: { card: VocabCard; deck: VocabDeck; onClose: () => void }) {
  const { updateVocabCard, removeVocabCard, resetVocabCard } = useAppStore.getState();
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [note, setNote] = useState(card.note ?? '');
  const valid = front.trim() && back.trim();

  const save = () => {
    if (!valid) return;
    updateVocabCard(card.id, { front: front.trim(), back: back.trim(), note: note.trim() || undefined });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Karte bearbeiten"
      subtitle={`Box ${card.box}${card.due ? '' : ' · neu'} · ${card.correct}× gewusst · ${card.wrong}× nicht`}
      footer={
        <div className="flex items-center gap-2">
          <DeleteButton
            onConfirm={() => {
              removeVocabCard(card.id);
              onClose();
            }}
          />
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={save} disabled={!valid}>
              Speichern
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label={deck.frontLabel}>
          <TextInput value={front} onChange={(e) => setFront(e.target.value)} className="text-base" />
        </Field>
        <Field label={deck.backLabel} hint="Mehrere richtige Antworten mit Komma oder / trennen (zählt beim Tippen).">
          <TextInput value={back} onChange={(e) => setBack(e.target.value)} className="text-base" />
        </Field>
        <Field label="Notiz (optional)">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Merksatz, Beispielsatz, Genus" />
        </Field>
        {card.due && (
          <Button
            size="sm"
            variant="ghost"
            icon={RotateCcw}
            onClick={() => {
              resetVocabCard(card.id);
              toast('Lernstand zurückgesetzt', 'info');
              onClose();
            }}
          >
            Lernstand zurücksetzen (wieder neu)
          </Button>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}

// ─── Liste importieren ───────────────────────────────────────

export function ImportSheet({ deck, onClose }: { deck: VocabDeck; onClose: () => void }) {
  const cards = useAppStore((s) => s.vocabCards);
  const addVocabCards = useAppStore((s) => s.addVocabCards);
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseVocabList(text), [text]);
  const existing = useMemo(() => duplicateFronts(cards, deck.id), [cards, deck.id]);
  const fresh = parsed.items.filter((i, idx) => !existing.has(normalizeAnswer(i.front)) && parsed.items.findIndex((x) => normalizeAnswer(x.front) === normalizeAnswer(i.front)) === idx);
  const duplicates = parsed.items.length - fresh.length;

  const run = () => {
    if (fresh.length === 0) return;
    addVocabCards(fresh.map((i) => ({ deckId: deck.id, front: i.front, back: i.back })));
    toast(`${fresh.length} ${fresh.length === 1 ? 'Karte' : 'Karten'} importiert`);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title="Vokabeln importieren"
      subtitle={`Eine Vokabel pro Zeile: ${deck.frontLabel} ; ${deck.backLabel}`}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" className="ml-auto" icon={Upload} onClick={run} disabled={fresh.length === 0}>
            {fresh.length ? `${fresh.length} importieren` : 'Importieren'}
          </Button>
        </div>
      }
    >
      <TextArea
        rows={10}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="font-mono text-sm"
        placeholder={'Haus ; дом\nKatze ; кошка\nHund = собака'}
        aria-label="Vokabelliste"
      />
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        Trennzeichen: Semikolon, Tabulator (aus Excel/Numbers kopiert), „=“ oder „ - “. {parsed.items.length > 0 && `${parsed.items.length} erkannt`}
        {duplicates > 0 && ` · ${duplicates} doppelt oder schon im Deck (werden übersprungen)`}
        {parsed.skipped.length > 0 && ` · ${parsed.skipped.length} ${parsed.skipped.length === 1 ? 'Zeile' : 'Zeilen'} ohne Trennzeichen`}
      </p>
      {fresh.length > 0 && (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-2xl border border-line">
          {fresh.slice(0, 50).map((i, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-3 border-b border-line px-3 py-1.5 text-sm last:border-0">
              <span className="truncate">{i.front}</span>
              <span className="truncate text-ink-muted">{i.back}</span>
            </div>
          ))}
          {fresh.length > 50 && <p className="px-3 py-1.5 text-xs text-ink-faint">… und {fresh.length - 50} weitere</p>}
        </div>
      )}
    </Sheet>
  );
}

// ─── Lernkartei-Einstellungen ────────────────────────────────

export function VocabSettingsSheet({ onClose }: { onClose: () => void }) {
  const vocab = useAppStore((s) => s.settings.vocab);
  const update = useAppStore((s) => s.updateVocabSettings);
  const setDays = (i: number, days: number) => update({ intervals: vocab.intervals.map((d, j) => (j === i ? Math.max(1, Math.min(365, Math.round(days) || 1)) : d)) });

  return (
    <Sheet open onClose={onClose} title="Lernkartei" subtitle="Leitner-System: Gewusstes wandert in die nächste Box und kommt seltener dran." footer={<Button variant="primary" block onClick={onClose}>Fertig</Button>}>
      <div className="space-y-5">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Boxen & Wiederholungsabstand</span>
          <div className="space-y-2">
            {vocab.intervals.map((days, i) => (
              <div key={i} className="grid grid-cols-[64px_minmax(0,1fr)_120px] items-center gap-3">
                <span className="text-sm font-medium">Box {i + 1}</span>
                <span className="text-xs text-ink-muted">{intervalLabel(days)}</span>
                <NumberInput value={days} min={1} max={365} suffix="Tage" onChange={(v) => setDays(i, v)} aria-label={`Abstand Box ${i + 1}`} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={Plus}
              disabled={vocab.intervals.length >= 8}
              onClick={() => update({ intervals: [...vocab.intervals, Math.min(365, (vocab.intervals.at(-1) ?? 30) * 2)] })}
            >
              Box
            </Button>
            <Button size="sm" variant="ghost" icon={Minus} disabled={vocab.intervals.length <= 2} onClick={() => update({ intervals: vocab.intervals.slice(0, -1) })}>
              Box
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">Karten in einer entfernten Box zählen danach zur letzten Box.</p>
        </div>
        <Field label="Nicht gewusst">
          <Segmented<'first' | 'previous'>
            size="sm"
            value={vocab.wrongTo}
            onChange={(v) => update({ wrongTo: v })}
            options={[
              { value: 'first', label: 'Zurück in Box 1' },
              { value: 'previous', label: 'Eine Box zurück' },
            ]}
          />
        </Field>
        <Field label="Höchstens pro Lerneinheit" hint="0 = alle fälligen Karten.">
          <NumberInput className="w-36" value={vocab.sessionLimit} min={0} max={500} suffix="Karten" onChange={(v) => update({ sessionLimit: Math.max(0, Math.min(500, Math.round(v))) })} />
        </Field>
      </div>
    </Sheet>
  );
}
