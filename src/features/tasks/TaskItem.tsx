import { Check, Clock, Flag, Target } from 'lucide-react';
import { PRIORITY_LABEL } from '../../domain/labels';
import { formatDuration, relativeDayLabel } from '../../domain/time';
import type { DateKey, Task } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../ui/cn';
import { Badge, ColorDot } from '../../ui/controls';
import { TaskEnergyTag } from '../shared/energy';

const PRIORITY_COLOR = { low: '#94a3b8', medium: '#a1a1aa', high: '#fb923c', urgent: '#f87171' } as const;

export function TaskCheckbox({ done, onToggle, color = '#a78bfa' }: { done: boolean; onToggle: () => void; color?: string }) {
  return (
    <button
      type="button"
      aria-label={done ? 'Als offen markieren' : 'Als erledigt markieren'}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90',
        done ? 'border-transparent' : 'border-white/25 hover:border-white/50',
      )}
      style={done ? { background: color } : undefined}
    >
      {done && <Check size={13} strokeWidth={3} className="animate-pop text-black/80" />}
    </button>
  );
}

interface TaskItemProps {
  task: Task;
  today: DateKey;
  onOpen: (task: Task) => void;
  showSchedule?: boolean;
  compact?: boolean;
}

export function TaskItem({ task, today, onOpen, showSchedule = true, compact }: TaskItemProps) {
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const category = useAppStore((s) => s.settings.categories.find((c) => c.id === task.categoryId));
  const goal = useAppStore((s) => (task.goalId ? s.goals.find((g) => g.id === task.goalId) : undefined));
  const done = task.status === 'done';
  const overdue = !done && !!task.deadline && task.deadline < today;
  const dueToday = !done && task.deadline === today;
  const color = category?.color ?? '#a78bfa';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(task)}
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-2xl px-2 transition-colors hover:bg-white/[0.03]',
        compact ? 'py-2' : 'py-2.5',
      )}
    >
      <div className="pt-0.5">
        <TaskCheckbox done={done} onToggle={() => toggleTaskDone(task.id)} color={color} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('flex items-center gap-2 text-sm font-medium', done && 'text-ink-faint line-through')}>
          <span className="truncate">{task.title}</span>
          {task.status === 'in_progress' && <Badge color="#60a5fa">In Arbeit</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <ColorDot color={color} className="h-2 w-2" />
            {category?.name ?? 'Ohne Kategorie'}
          </span>
          <span className="inline-flex items-center gap-1 tabular">
            <Clock size={12} />
            {showSchedule && task.schedule?.start ? `${task.schedule.start} · ` : ''}
            {formatDuration(task.estimatedMin)}
          </span>
          {!done && <TaskEnergyTag energy={task.energy} />}
          {showSchedule && task.schedule && !task.schedule.start && task.schedule.date !== today && (
            <span>Geplant: {relativeDayLabel(task.schedule.date, today)}</span>
          )}
          {showSchedule && task.schedule?.start && task.schedule.date !== today && (
            <span>{relativeDayLabel(task.schedule.date, today)}</span>
          )}
          {goal && (
            <span className="inline-flex items-center gap-1" style={{ color: goal.color }}>
              <Target size={12} />
              {goal.title}
            </span>
          )}
          {(task.priority === 'high' || task.priority === 'urgent') && !done && (
            <span className="inline-flex items-center gap-1" style={{ color: PRIORITY_COLOR[task.priority] }}>
              <Flag size={12} />
              {PRIORITY_LABEL[task.priority]}
            </span>
          )}
        </div>
      </div>
      {(overdue || dueToday || (task.deadline && !done)) && (
        <Badge color={overdue ? '#f87171' : dueToday ? '#fbbf24' : '#a1a1aa'} className="mt-0.5">
          {overdue ? 'Überfällig' : dueToday ? 'Heute fällig' : `bis ${relativeDayLabel(task.deadline!, today)}`}
        </Badge>
      )}
    </div>
  );
}
