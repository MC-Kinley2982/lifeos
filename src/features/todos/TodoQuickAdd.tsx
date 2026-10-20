import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { DateKey } from '../../domain/types';
import type { QuickTokenKind } from '../../services/nlp/quickAdd';
import { applyQuickParse, whenToFields, type TodoWhen } from '../../services/todos/todos';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../ui/cn';
import { QuickParseChips, useQuickParse } from '../shared/QuickParseChips';

const WHEN_CHIPS: Array<{ value: TodoWhen; label: string }> = [
  { value: 'today', label: 'Heute' },
  { value: 'tomorrow', label: 'Morgen' },
  { value: 'week', label: 'Diese Woche' },
  { value: 'later', label: 'Später' },
];

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
  const inputRef = useRef<HTMLInputElement>(null);
  const quick = useQuickParse(title, today, TODO_KINDS);

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    const fields = fixedDate ? whenToFields('date', today, weekStartsOn, fixedDate) : whenToFields(when, today, weekStartsOn);
    addTodo(applyQuickParse({ title: t, ...fields }, quick.parse));
    setTitle('');
    quick.reset();
    inputRef.current?.focus();
  };

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
              className={cn(
                'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors',
                when === c.value ? 'bg-violet-500/90 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink',
                quick.parse?.horizon && 'opacity-50',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
