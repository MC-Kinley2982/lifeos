import { Bell, CalendarCheck, Check, Clock, Flag, Sparkles, StickyNote } from 'lucide-react';
import { relativeDayLabel } from '../../domain/time';
import type { DateKey, Todo } from '../../domain/types';
import { todoDayHint } from '../../services/todos/todos';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../ui/cn';

/**
 * Eine To-do-Zeile: großer Haken (ganze linke Fläche tippbar), Titel öffnet die Details.
 * "Geplant" zeigt, dass LifeOS dafür Zeit eingeplant hat – sonst ist es nur ein To-do.
 */
export function TodoRow({ todo, today, onOpen }: { todo: Todo; today: DateKey; onOpen: (todo: Todo) => void }) {
  const toggleTodo = useAppStore((s) => s.toggleTodo);
  const task = useAppStore((s) => (todo.taskId ? s.tasks.find((t) => t.id === todo.taskId) : undefined));
  const dayHint = todoDayHint(todo, today);
  const overdue = !todo.completed && todo.horizon === 'day' && !!todo.date && todo.date < today;
  const planned = !!task;
  const slot = task?.schedule?.start ? `${task.schedule.date === today ? '' : `${relativeDayLabel(task.schedule.date, today)} `}${task.schedule.start}` : undefined;

  return (
    <div className="group flex items-stretch rounded-2xl transition-colors hover:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => toggleTodo(todo.id)}
        aria-label={todo.completed ? `„${todo.title}“ wieder öffnen` : `„${todo.title}“ abhaken`}
        aria-pressed={todo.completed}
        className="flex h-12 w-12 shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all active:scale-90',
            todo.completed ? 'border-transparent bg-emerald-400' : planned ? 'border-violet-300/70' : 'border-white/30 group-hover:border-white/50',
          )}
        >
          {todo.completed && <Check size={14} strokeWidth={3} className="animate-pop text-black/80" />}
        </span>
      </button>
      <button type="button" onClick={() => onOpen(todo)} className="flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-3 text-left">
        <span className={cn('text-[15px] leading-snug break-words', todo.completed && 'text-ink-faint line-through')}>{todo.title}</span>
        {(dayHint || todo.time || todo.reminder || todo.googleCalendarSync || planned || todo.note || todo.priority === 'high' || todo.priority === 'urgent') && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-ink-muted">
            {planned && (
              <span className="inline-flex items-center gap-1 font-medium text-violet-300">
                <Sparkles size={11} />
                {slot ? `Geplant · ${slot}` : 'Geplant · sucht Zeit'}
              </span>
            )}
            {dayHint && <span className={cn(overdue && 'text-amber-300')}>{dayHint}</span>}
            {todo.time && !slot && (
              <span className="inline-flex items-center gap-1 tabular">
                <Clock size={11} />
                {todo.time}
              </span>
            )}
            {todo.reminder && <Bell size={11} aria-label="Erinnerung" />}
            {todo.googleCalendarSync && <CalendarCheck size={11} aria-label="In Google Kalender" />}
            {todo.note && <StickyNote size={11} aria-label="Notiz" />}
            {(todo.priority === 'high' || todo.priority === 'urgent') && !todo.completed && (
              <span className="inline-flex items-center gap-1 text-orange-300">
                <Flag size={11} />
                Wichtig
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  );
}
