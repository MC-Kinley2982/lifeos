import { useMemo, useState } from 'react';
import { CircleCheck, ListTodo, Plus, Sparkles } from 'lucide-react';
import { PRIORITY_ORDER } from '../../domain/labels';
import { addDays, toDateKey } from '../../domain/time';
import type { Task } from '../../domain/types';
import { useNow } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { Card, EmptyState, PageHeader } from '../../ui/Card';
import { Segmented } from '../../ui/controls';
import { AutoPlanSheet } from '../planning/AutoPlanSheet';
import { QuickAddTask } from './QuickAddTask';
import { TaskForm } from './TaskForm';
import { TaskItem } from './TaskItem';

type Filter = 'open' | 'today' | 'planned' | 'unplanned' | 'done';

/** Sortierung: überfällig → Deadline → Priorität → zuletzt angelegt. */
function smartSort(a: Task, b: Task): number {
  const ad = a.deadline ?? '9999-99-99';
  const bd = b.deadline ?? '9999-99-99';
  if (ad !== bd) return ad.localeCompare(bd);
  const pa = PRIORITY_ORDER.indexOf(a.priority);
  const pb = PRIORITY_ORDER.indexOf(b.priority);
  if (pa !== pb) return pa - pb;
  return b.createdAt.localeCompare(a.createdAt);
}

export function TasksPage() {
  const now = useNow();
  const today = toDateKey(now);
  const tasks = useAppStore((s) => s.tasks);
  const [filter, setFilter] = useState<Filter>('open');
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [planning, setPlanning] = useState(false);

  const counts = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done');
    return {
      open: open.length,
      today: open.filter((t) => t.schedule?.date === today || (t.deadline && t.deadline <= today)).length,
      planned: open.filter((t) => t.schedule && t.schedule.date >= today).length,
      unplanned: open.filter((t) => !t.schedule || t.schedule.date < today).length,
      done: tasks.length - open.length,
    };
  }, [tasks, today]);

  const list = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done');
    switch (filter) {
      case 'today':
        return open.filter((t) => t.schedule?.date === today || (t.deadline && t.deadline <= today)).sort(smartSort);
      case 'planned':
        return open
          .filter((t) => t.schedule && t.schedule.date >= today)
          .sort((a, b) => `${a.schedule!.date}${a.schedule!.start ?? ''}`.localeCompare(`${b.schedule!.date}${b.schedule!.start ?? ''}`));
      case 'unplanned':
        return open.filter((t) => !t.schedule || t.schedule.date < today).sort(smartSort);
      case 'done':
        return tasks.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
      default:
        return open.sort(smartSort);
    }
  }, [tasks, filter, today]);

  const planDates = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Aufgaben"
        subtitle={`${counts.open} offen · ${counts.done} erledigt`}
        actions={
          <>
            <Button variant="secondary" icon={Sparkles} onClick={() => setPlanning(true)} disabled={counts.unplanned === 0}>
              Automatisch planen
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              Neue Aufgabe
            </Button>
          </>
        }
      />

      <div className="scrollbar-none -mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented<Filter>
          className="min-w-[480px] sm:max-w-xl"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: `Offen ${counts.open}` },
            { value: 'today', label: `Heute ${counts.today}` },
            { value: 'planned', label: `Geplant ${counts.planned}` },
            { value: 'unplanned', label: `Ungeplant ${counts.unplanned}` },
            { value: 'done', label: `Erledigt ${counts.done}` },
          ]}
        />
      </div>

      <Card>
        {filter !== 'done' && (
          <div className="mb-3">
            <QuickAddTask placeholder="Neue Aufgabe – Titel eingeben und Enter" defaults={filter === 'today' ? { schedule: { date: today } } : undefined} />
          </div>
        )}
        {list.length === 0 ? (
          filter === 'done' ? (
            <EmptyState icon={CircleCheck} title="Noch nichts erledigt" text="Erledigte Aufgaben erscheinen hier." />
          ) : (
            <EmptyState icon={ListTodo} title="Keine Aufgaben in dieser Ansicht" text="Lege eine Aufgabe an – mit Dauer, Energie und Deadline kann die App sie sinnvoll einplanen." />
          )
        ) : (
          <div className="-mx-2 divide-y divide-white/[0.04]">
            {list.map((t) => (
              <TaskItem key={t.id} task={t} today={today} onOpen={setEditing} />
            ))}
          </div>
        )}
      </Card>

      {editing && <TaskForm task={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {planning && <AutoPlanSheet dates={planDates} title="Aufgaben einplanen (7 Tage)" defaultIncludeGoals={false} onClose={() => setPlanning(false)} />}
    </div>
  );
}
