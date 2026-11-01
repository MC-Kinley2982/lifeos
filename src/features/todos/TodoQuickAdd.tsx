import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { addDays } from '../../domain/time';
import type { DateKey } from '../../domain/types';
import type { QuickTokenKind } from '../../services/nlp/quickAdd';
import { applyQuickParse, TODO_LEVEL_LABEL, whenToFields, type TodoLevel, type TodoWhen } from '../../services/todos/todos';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../ui/cn';
import { DateInput } from '../../ui/fields';
import { QuickParseChips, useQuickParse } from '../shared/QuickParseChips';

const WHEN_CHIPS: Array<{ value: TodoWhen; label: string }> = [
  { value: 'today', label: 'Heute' },
  { value: 'tomorrow', label: 'Morgen' },
  { value: 'week', label: 'Diese Woche' },
  { value: 'later', label: 'Später' },
  { value: 'date', label: 'Datum' },
  { value: 'range', label: 'Zeitraum' },
];

const LEVEL_CHIPS: TodoLevel[] = ['low', 'medium', 'high'];

/** Was die Texterkennung bei To-dos auswertet (Tageszeit gibt es bei To-dos nicht). */
const TODO_KINDS: QuickTokenKind[] = ['date', 'time', 'duration', 'priority', 'repeat'];

/**
 * Schnell hinzufügen: tippen, Enter – fertig. Das Feld bleibt aktiv, damit mehrere To-dos
 * hintereinander gehen. Schriftgröße 16 px, damit Safari auf dem iPhone nicht hineinzoomt.
 * Angaben wie "morgen 17 Uhr" oder "jeden Montag" werden erkannt (Vorschau darunter, antippen = ignorieren).
 */
export function TodoQuickAdd({ today, fixedDate, placeholder = 'To-do hinzufügen …' }: { today: DateKey; fixedDate?: DateKey; placeholder?: string }) {
  const addTodo = useAppStore((s) => s.addTodo);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<TodoWhen>('today');
  const [day, setDay] = useState<DateKey>(today);
  const [endDay, setEndDay] = useState<DateKey>(addDays(today, 2));
  const [due, setDue] = useState<DateKey | ''>('');
  const [level, setLevel] = useState<TodoLevel>('medium');
  const inputRef = useRef<HTMLInputElement>(null);
  const quick = useQuickParse(title, today, TODO_KINDS);
  const showDue = !fixedDate && (when === 'week' || when === 'later');

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    const fields = fixedDate ? whenToFields('date', today, weekStartsOn, fixedDate) : whenToFields(when, today, weekStartsOn, day < today ? today : day, endDay);
    addTodo(applyQuickParse({ title: t, ...fields, priority: level, dueDate: showDue && due ? due : undefined }, quick.parse));
    setTitle('');
    setLevel('medium');
    setDue('');
    quick.reset();
    inputRef.current?.focus();
  };

  const chip = (active: boolean, dimmed = false) =>
    cn(
      'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors',
      active ? 'bg-violet-500/90 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink',
      dimmed && 'opacity-50',
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface pl-3 transition-colors focus-within:border-violet-400/60 focus-within:bg-white/[0.02]">
        <Plus size={18} className="shrink-0 text-ink-faint" />
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          enterKeyHint="done"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent text-base placeholder:text-ink-faint focus:outline-none"
        />
        {title.trim() && (
          <button type="submit" className="mr-1.5 h-9 shrink-0 rounded-xl bg-violet-500 px-3.5 text-sm font-medium text-white active:scale-95">
            Speichern
          </button>
        )}
      </div>
      <QuickParseChips className="mt-2 px-1" parse={quick.parse} ignored={quick.ignored} onToggle={quick.toggle} />
      {!fixedDate && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5" role="radiogroup" aria-label="Wann?">
          {WHEN_CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={when === c.value}
              onClick={() => setWhen(c.value)}
              className={chip(when === c.value, !!quick.parse?.horizon)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {!fixedDate && (when === 'date' || when === 'range') && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <DateInput aria-label={when === 'range' ? 'Zeitraum von' : 'Datum'} value={day} min={today} onChange={(v) => {
              if (!v) return;
              setDay(v);
              if (v > endDay) setEndDay(v);
            }}
          />
          {when === 'range' && <DateInput aria-label="Zeitraum bis (Frist)" value={endDay} min={day} onChange={(v) => v && setEndDay(v < day ? day : v)} />}
        </div>
      )}
      {showDue && (
        <label className="mt-2 flex items-center gap-2 px-1 text-xs text-ink-muted">
          <span className="shrink-0">Frist (optional)</span>
          <DateInput aria-label="Frist" value={due} min={today} onChange={setDue} className="max-w-[11rem]" />
          {due && (
            <button type="button" onClick={() => setDue('')} className="text-violet-300 hover:underline">
              Entfernen
            </button>
          )}
        </label>
      )}
      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5" role="radiogroup" aria-label="Wichtigkeit">
        <span className="shrink-0 pr-1 pl-1 text-xs text-ink-muted">Wichtigkeit</span>
        {LEVEL_CHIPS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={level === l}
            onClick={() => setLevel(l)}
            className={chip(level === l, !!quick.parse?.priority)}
          >
            {TODO_LEVEL_LABEL[l]}
          </button>
        ))}
      </div>
    </form>
  );
}
