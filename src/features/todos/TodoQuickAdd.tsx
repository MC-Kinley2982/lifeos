import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { DateKey } from '../../domain/types';
import { whenToFields, type TodoWhen } from '../../services/todos/todos';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../ui/cn';

const WHEN_CHIPS: Array<{ value: TodoWhen; label: string }> = [
  { value: 'today', label: 'Heute' },
  { value: 'tomorrow', label: 'Morgen' },
  { value: 'week', label: 'Diese Woche' },
  { value: 'later', label: 'Später' },
];

/**
 * Schnell hinzufügen: tippen, Enter – fertig. Das Feld bleibt aktiv, damit mehrere To-dos
 * hintereinander gehen. Schriftgröße 16 px, damit Safari auf dem iPhone nicht hineinzoomt.
 */
export function TodoQuickAdd({ today, fixedDate, placeholder = 'To-do hinzufügen …' }: { today: DateKey; fixedDate?: DateKey; placeholder?: string }) {
  const addTodo = useAppStore((s) => s.addTodo);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<TodoWhen>('today');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    const fields = fixedDate ? whenToFields('date', today, weekStartsOn, fixedDate) : whenToFields(when, today, weekStartsOn);
    addTodo({ title: t, ...fields });
    setTitle('');
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
