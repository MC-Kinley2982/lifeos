import { useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { hrefFor, PATHS } from '../../app/router';
import type { DateKey } from '../../domain/types';
import { todosForDay } from '../../services/todos/todos';
import { useAppStore } from '../../store/useAppStore';
import { Card, CardHeader } from '../../ui/Card';
import { TodoQuickAdd } from './TodoQuickAdd';
import { TodoRow } from './TodoRow';
import { TodoSheet } from './TodoSheet';

/** "Meine To-dos" auf der Heute-Seite – die To-dos des Tages, direkt abhakbar. */
export function TodayTodosCard({ date, today }: { date: DateKey; today: DateKey }) {
  const todos = useAppStore((s) => s.todos);
  const hideCompleted = useAppStore((s) => s.settings.ui.hideCompletedTodos);
  const list = useMemo(() => todosForDay(todos, date, today, hideCompleted), [todos, date, today, hideCompleted]);
  const [openId, setOpenId] = useState<string | null>(null);
  const done = list.filter((t) => t.completed).length;

  return (
    <Card className="px-2 sm:px-3">
      <CardHeader
        className="mb-2 px-2"
        title="Meine To-dos"
        icon={ListChecks}
        subtitle={list.length ? `${done} von ${list.length} erledigt` : date === today ? 'Nichts auf der Liste für heute' : 'Nichts für diesen Tag'}
        action={
          <a href={hrefFor(PATHS.todos)} className="text-xs text-violet-300 hover:underline">
            Alle
          </a>
        }
      />
      {list.length > 0 && (
        <div className="mb-2">
          {list.map((t) => (
            <TodoRow key={t.id} todo={t} today={today} onOpen={(x) => setOpenId(x.id)} />
          ))}
        </div>
      )}
      {date >= today && (
        <div className="px-1 pb-1">
          <TodoQuickAdd today={today} fixedDate={date} placeholder={date === today ? 'To-do für heute …' : 'To-do für diesen Tag …'} />
        </div>
      )}
      {openId && <TodoSheet todoId={openId} onClose={() => setOpenId(null)} />}
    </Card>
  );
}
