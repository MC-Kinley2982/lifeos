import { CalendarClock, Clock, TriangleAlert } from 'lucide-react';
import { formatDuration } from '../../domain/time';
import type { Homework } from '../../domain/types';
import { homeworkRemainingMinutes, isBlockUpcoming, isHomeworkOverdue } from '../../services/school/homework';
import { subjectLabel } from '../../services/school/timetable';
import { replanSchool } from '../../store/schoolAutomation';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../ui/cn';
import { Badge } from '../../ui/controls';
import { TaskCheckbox } from '../tasks/TaskItem';
import { formatBlock, formatDeadline } from './format';
import { useSubject } from './SchoolBits';

export function HomeworkItem({ homework, today, now, onOpen }: { homework: Homework; today: string; now: Date; onOpen: (h: Homework) => void }) {
  const toggleHomeworkDone = useAppStore((s) => s.toggleHomeworkDone);
  const label = subjectLabel(useSubject(homework.subjectId));
  const done = homework.status === 'done';
  const overdue = isHomeworkOverdue(homework, now);
  const upcoming = homework.plannedBlocks.filter((b) => !b.done && isBlockUpcoming(b, now));
  const missing = homeworkRemainingMinutes(homework, now);

  const toggle = () => {
    const reopening = done;
    toggleHomeworkDone(homework.id);
    if (reopening) replanSchool({ homeworkIds: [homework.id] });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(homework)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(homework)}
      className="group flex cursor-pointer items-start gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
    >
      <div className="pt-0.5">
        <TaskCheckbox done={done} onToggle={toggle} color={label.color} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('flex flex-wrap items-center gap-x-2 text-sm font-medium', done && 'text-ink-faint line-through')}>
          <span style={{ color: done ? undefined : label.color }}>{label.name}</span>
          <span className="truncate">{homework.title || 'Hausaufgabe'}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1 tabular">
            <Clock size={12} />
            {formatDuration(homework.estimatedMinutes)}
          </span>
          {!done && upcoming.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={12} />
              {formatBlock(upcoming[0], today)}
              {upcoming.length > 1 ? ` +${upcoming.length - 1}` : ''}
            </span>
          )}
          {!done && missing > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <TriangleAlert size={12} />
              {formatDuration(missing)} nicht eingeplant
            </span>
          )}
        </div>
      </div>
      {!done && (
        <Badge color={overdue ? '#f87171' : homework.deadline.date <= today ? '#fbbf24' : '#a1a1aa'} className="mt-0.5">
          {overdue ? 'Überfällig' : `bis ${formatDeadline(homework.deadline, today)}`}
        </Badge>
      )}
    </div>
  );
}
