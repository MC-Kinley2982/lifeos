import { useMemo, useState } from 'react';
import { ChevronDown, Eye, EyeOff, ListChecks, Sparkles } from 'lucide-react';
import { toDateKey } from '../../domain/time';
import type { Todo } from '../../domain/types';
import { groupTodos, TODO_SECTION_LABEL, type TodoSection } from '../../services/todos/todos';
import { useNow } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { IconButton } from '../../ui/Button';
import { Card, PageHeader } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { TodoQuickAdd } from './TodoQuickAdd';
import { TodoRow } from './TodoRow';
import { TodoSheet } from './TodoSheet';

const EMPTY_TEXT: Record<TodoSection, string> = {
  today: 'Nichts für heute. Genieß die freie Zeit.',
  week: 'Für diese Woche ist nichts gesammelt.',
  later: 'Hier landet alles ohne festes Datum.',
};

/**
 * Persönliche To-do-Liste: Heute · Diese Woche · Später.
 * Schnell hinzufügen, mit einem Tipp abhaken. To-dos blockieren keine Zeit – nur "Planen" tut das.
 */
export function TodosPage() {
  const now = useNow();
  const today = toDateKey(now);
  const todos = useAppStore((s) => s.todos);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const hideCompleted = useAppStore((s) => s.settings.ui.hideCompletedTodos);
  const updateUi = useAppStore((s) => s.updateUi);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => groupTodos(todos, today, weekStartsOn, hideCompleted), [todos, today, weekStartsOn, hideCompleted]);
  const openCount = todos.filter((t) => !t.completed).length;
  const open = (t: Todo) => setOpenId(t.id);

  const section = (key: TodoSection) => {
    const list = groups[key];
    const pending = list.filter((t) => !t.completed).length;
    return (
      <Card key={key} className="px-2 py-3 sm:px-3">
        <h2 className="flex items-baseline justify-between px-2 pb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {TODO_SECTION_LABEL[key]}
          {pending > 0 && <span className="text-[11px] font-medium tabular normal-case">{pending} offen</span>}
        </h2>
        {list.length === 0 ? (
          <p className="px-2 py-2 text-sm text-ink-faint">{EMPTY_TEXT[key]}</p>
        ) : (
          <div>
            {list.map((t) => (
              <TodoRow key={t.id} todo={t} today={today} onOpen={open} />
            ))}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="To-dos"
        subtitle={openCount ? `${openCount} offen` : 'Alles erledigt'}
        actions={
          <IconButton
            icon={hideCompleted ? EyeOff : Eye}
            label={hideCompleted ? 'Erledigte anzeigen' : 'Erledigte ausblenden'}
            variant="secondary"
            onClick={() => updateUi({ hideCompletedTodos: !hideCompleted })}
          />
        }
      />

      <div className="mx-auto max-w-2xl space-y-4">
        <TodoQuickAdd today={today} />

        {section('today')}
        {section('week')}
        {section('later')}

        {groups.done.length > 0 && (
          <Card className="px-2 py-2 sm:px-3">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="flex h-10 w-full items-center justify-between px-2 text-xs font-semibold tracking-wide text-ink-muted uppercase"
              aria-expanded={showDone}
            >
              <span>Erledigt ({groups.done.length})</span>
              <ChevronDown size={16} className={cn('transition-transform', showDone && 'rotate-180')} />
            </button>
            {showDone && groups.done.slice(0, 100).map((t) => <TodoRow key={t.id} todo={t} today={today} onOpen={open} />)}
          </Card>
        )}

        <p className="flex items-start gap-2 px-2 text-xs leading-relaxed text-ink-faint">
          <ListChecks size={14} className="mt-0.5 shrink-0" />
          <span>
            Ein To-do steht nur auf deiner Liste und blockiert keine Zeit. Mit <Sparkles size={11} className="inline text-violet-300" /> „Planen“ (To-do antippen)
            sucht LifeOS einen passenden freien Zeitraum.
          </span>
        </p>
      </div>

      {openId && <TodoSheet todoId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
