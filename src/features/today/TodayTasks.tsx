import { useMemo } from 'react';
import { ListChecks } from 'lucide-react';
import { PRIORITY_ORDER } from '../../domain/labels';
import { toDateKey } from '../../domain/time';
import type { DateKey, Task } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { Card, CardHeader } from '../../ui/Card';
import { ProgressBar } from '../../ui/controls';
import { QuickAddTask } from '../tasks/QuickAddTask';
import { TaskItem } from '../tasks/TaskItem';

/** Welche Aufgaben gehören zu diesem Tag? */
export function tasksForDay(tasks: Task[], date: DateKey, today: DateKey): Task[] {
  return tasks.filter((t) => {
    if (t.status === 'done') {
      const completed = t.completedAt ? toDateKey(new Date(t.completedAt)) : undefined;
      return completed === date || (t.schedule?.date === date && !completed);
    }
    if (t.schedule?.date === date) return true;
    if (date < today) return false;
    // Fällige/überfällige Aufgaben ohne (gültige) Planung erscheinen am heutigen Tag
    const staleOrNone = !t.schedule || t.schedule.date < today;
    return date === today && staleOrNone && !!t.deadline && t.deadline <= date;
  });
}

function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
    const as = a.schedule?.start ?? '99:99';
    const bs = b.schedule?.start ?? '99:99';
    if (as !== bs) return as.localeCompare(bs);
    const ad = a.deadline ?? '9999';
    const bd = b.deadline ?? '9999';
    if (ad !== bd) return ad.localeCompare(bd);
    return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
  });
}

export function TodayTasks({ date, today, onOpenTask }: { date: DateKey; today: DateKey; onOpenTask: (t: Task) => void }) {
  const tasks = useAppStore((s) => s.tasks);
  // Geplante To-dos stehen unter "Meine To-dos" (mit Uhrzeit) – hier nicht doppelt.
  const list = useMemo(() => sortTasks(tasksForDay(tasks, date, today).filter((t) => !t.todoId)), [tasks, date, today]);
  const done = list.filter((t) => t.status === 'done').length;

  return (
    <Card>
      <CardHeader
        title={date === today ? 'Heute erledigen' : 'Aufgaben des Tages'}
        icon={ListChecks}
        subtitle={list.length ? `${done} von ${list.length} erledigt` : 'Noch nichts geplant'}
      />
      {list.length > 0 && <ProgressBar value={(done / list.length) * 100} className="mb-3" color="#34d399" />}
      <div className="-mx-2 mb-3">
        {list.map((t) => (
          <TaskItem key={t.id} task={t} today={today} onOpen={onOpenTask} showSchedule compact />
        ))}
      </div>
      {date >= today && <QuickAddTask placeholder="Aufgabe für diesen Tag hinzufügen…" defaults={{ schedule: { date } }} />}
    </Card>
  );
}
