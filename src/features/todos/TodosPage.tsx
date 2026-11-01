import { useMemo, useState } from 'react';
import { ChevronDown, Eye, EyeOff, ListChecks, Sparkles } from 'lucide-react';
import { hrefFor, PATHS } from '../../app/router';
import { toDateKey } from '../../domain/time';
import type { Todo } from '../../domain/types';
import {
  groupTodos,
  groupTodosByPriority,
  TODO_LEVEL_LABEL,
  TODO_LEVELS,
  TODO_SECTION_LABEL,
  todoLevel,
  type TodoLevel,
  type TodoSection,
} from '../../services/todos/todos';
import { useNow } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { IconButton } from '../../ui/Button';
import { Card, PageHeader } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { Segmented } from '../../ui/controls';
import { TodoQuickAdd } from './TodoQuickAdd';
import { TodoRow } from './TodoRow';
import { TodoSheet } from './TodoSheet';

const EMPTY_TEXT: Record<TodoSection, string> = {
  today: 'Nichts für heute. Genieß die freie Zeit.',
  week: 'Für diese Woche ist nichts gesammelt.',
  later: 'Hier landet alles ohne festes Datum.',
};

const LEVEL_SECTION_LABEL: Record<TodoLevel, string> = { high: 'Hohe Priorität', medium: 'Mittlere Priorität', low: 'Niedrige Priorität' };

type LevelFilter = TodoLevel | 'all';

const FILTER_OPTIONS: Array<{ value: LevelFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  ...TODO_LEVELS.map((value) => ({ value, label: TODO_LEVEL_LABEL[value] })),
];

/**
 * Persönliche To-do-Liste. Standard: nach Wichtigkeit (heute Fälliges zuerst, dann hoch · mittel · niedrig);
 * alternativ nach Frist (Heute · Diese Woche · Später). Per Filter nur eine Wichtigkeitsstufe anzeigen.
 * Schnell hinzufügen, mit einem Tipp abhaken. To-dos blockieren keine Zeit – nur "Planen" tut das.
 */
export function TodosPage() {
  const now = useNow();
  const today = toDateKey(now);
  const todos = useAppStore((s) => s.todos);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const hideCompleted = useAppStore((s) => s.settings.ui.hideCompletedTodos);
  const sort = useAppStore((s) => s.settings.ui.todoSort);
  const updateUi = useAppStore((s) => s.updateUi);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [filter, setFilter] = useState<LevelFilter>('all');

  const visible = useMemo(() => (filter === 'all' ? todos : todos.filter((t) => todoLevel(t) === filter)), [todos, filter]);
  const byPriority = useMemo(() => groupTodosByPriority(visible, today, weekStartsOn, hideCompleted), [visible, today, weekStartsOn, hideCompleted]);
  const byDeadline = useMemo(() => groupTodos(visible, today, weekStartsOn, hideCompleted), [visible, today, weekStartsOn, hideCompleted]);
  const done = sort === 'priority' ? byPriority.done : byDeadline.done;
  const openCount = todos.filter((t) => !t.completed).length;
  const open = (t: Todo) => setOpenId(t.id);

  const block = (key: string, title: string, list: Todo[], empty?: string) => {
    const pending = list.filter((t) => !t.completed).length;
    return (
      <Card key={key} className="px-2 py-3 sm:px-3">
        <h2 className="flex items-baseline justify-between px-2 pb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {title}
          {pending > 0 && <span className="text-[11px] font-medium tabular normal-case">{pending} offen</span>}
        </h2>
        {list.length === 0 ? (
          <p className="px-2 py-2 text-sm text-ink-faint">{empty}</p>
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

  const deadlineView = (['today', 'week', 'later'] as const).map((key) => block(key, TODO_SECTION_LABEL[key], byDeadline[key], EMPTY_TEXT[key]));

  const priorityView = () => {
    const blocks = [
      byPriority.dueToday.length > 0 && block('due', 'Heute fällig', byPriority.dueToday),
      ...TODO_LEVELS.map((level) => byPriority[level].length > 0 && block(level, LEVEL_SECTION_LABEL[level], byPriority[level])),
    ].filter(Boolean);
    if (blocks.length > 0) return blocks;
    return [block('empty', 'To-dos', [], filter === 'all' ? 'Nichts offen. Genieß die freie Zeit.' : 'Keine To-dos mit dieser Wichtigkeit.')];
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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-xs font-medium text-ink-muted">Sortieren</span>
            <Segmented<'priority' | 'deadline'>
              size="sm"
              value={sort}
              onChange={(v) => updateUi({ todoSort: v })}
              options={[
                { value: 'priority', label: 'Wichtigkeit' },
                { value: 'deadline', label: 'Frist' },
              ]}
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="radiogroup" aria-label="Nach Wichtigkeit filtern">
            {FILTER_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={filter === o.value}
                onClick={() => setFilter(o.value)}
                className={cn(
                  'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors',
                  filter === o.value ? 'bg-violet-500/90 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {sort === 'priority' ? priorityView() : deadlineView}

        {done.length > 0 && (
          <Card className="px-2 py-2 sm:px-3">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="flex h-10 w-full items-center justify-between px-2 text-xs font-semibold tracking-wide text-ink-muted uppercase"
              aria-expanded={showDone}
            >
              <span>Erledigt ({done.length})</span>
              <ChevronDown size={16} className={cn('transition-transform', showDone && 'rotate-180')} />
            </button>
            {showDone && done.slice(0, 100).map((t) => <TodoRow key={t.id} todo={t} today={today} onOpen={open} />)}
          </Card>
        )}

        <p className="flex items-start gap-2 px-2 text-xs leading-relaxed text-ink-faint">
          <ListChecks size={14} className="mt-0.5 shrink-0" />
          <span>
            Ein To-do steht nur auf deiner Liste und blockiert keine Zeit. Mit <Sparkles size={11} className="inline text-violet-300" /> „Planen“ (To-do antippen)
            sucht LifeOS einen passenden freien Zeitraum. Per Siri hinzufügen:{' '}
            <a href={hrefFor(PATHS.settings('kurzbefehle'))} className="text-violet-300 hover:underline">
              Kurzbefehl einrichten
            </a>
            .
          </span>
        </p>
      </div>

      {openId && <TodoSheet todoId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
