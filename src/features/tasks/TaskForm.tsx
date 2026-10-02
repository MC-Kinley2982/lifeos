import { useState } from 'react';
import { X } from 'lucide-react';
import { taskDraft, type TaskInput } from '../../domain/factories';
import { nowIso } from '../../domain/ids';
import { PRIORITY_LABEL } from '../../domain/labels';
import type { Priority, Task, TaskEnergy, TaskStatus, TimeOfDay } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { DeleteButton, Segmented } from '../../ui/controls';
import { DateInput, Field, NumberInput, TextArea, TextInput, TimeInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { CategorySelect, GoalSelect } from '../shared/selects';

const DURATIONS = [15, 30, 45, 60, 90, 120];

interface TaskFormProps {
  task?: Task;
  defaults?: Partial<TaskInput>;
  onClose: () => void;
}

/** Aufgabe anlegen/bearbeiten. Wird nur gemountet, solange es offen ist. */
export function TaskForm({ task, defaults, onClose }: TaskFormProps) {
  const settings = useAppStore((s) => s.settings);
  const { addTask, updateTask, removeTask } = useAppStore.getState();
  const [draft, setDraft] = useState<TaskInput>(() => (task ? { ...task } : taskDraft(settings, defaults)));
  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    const title = draft.title.trim();
    if (!title) return;
    const next: TaskInput = { ...draft, title, estimatedMin: Math.max(5, draft.estimatedMin || 5) };
    if (task) {
      if (next.status === 'done' && task.status !== 'done') next.completedAt = nowIso();
      if (next.status !== 'done') next.completedAt = undefined;
      updateTask(task.id, next);
      toast('Aufgabe gespeichert');
    } else {
      if (next.status === 'done') next.completedAt = nowIso();
      addTask(next);
      toast('Aufgabe angelegt');
    }
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
      footer={
        <div className="flex items-center gap-2">
          {task && <DeleteButton onConfirm={() => { removeTask(task.id); toast('Aufgabe gelöscht', 'info'); onClose(); }} />}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button variant="primary" onClick={save} disabled={!draft.title.trim()}>Speichern</Button>
          </div>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Titel">
          <TextInput autoFocus value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="z. B. Mathe Hausaufgaben" />
        </Field>

        <Field label="Geschätzte Dauer">
          <div className="flex flex-wrap items-center gap-1.5">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set('estimatedMin', m)}
                className={cn(
                  'h-8 rounded-lg px-2.5 text-xs font-medium tabular transition-colors',
                  draft.estimatedMin === m ? 'bg-violet-500 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink',
                )}
              >
                {m < 60 ? `${m} min` : `${m / 60} h`.replace('.5', ',5')}
              </button>
            ))}
            <NumberInput className="w-28" value={draft.estimatedMin} min={5} step={5} onChange={(v) => set('estimatedMin', v)} suffix="min" />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priorität">
            <Segmented<Priority>
              size="sm"
              value={draft.priority}
              onChange={(v) => set('priority', v)}
              options={(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </Field>
          <Field label="Benötigte Energie">
            <Segmented<TaskEnergy>
              size="sm"
              value={draft.energy}
              onChange={(v) => set('energy', v)}
              options={[
                { value: 'low', label: 'Leicht' },
                { value: 'medium', label: 'Mittel' },
                { value: 'high', label: 'Hoch' },
              ]}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[170px_minmax(0,1fr)]">
          <Field label="Deadline (optional)">
            <div className="flex gap-2">
              <DateInput value={draft.deadline ?? ''} onChange={(v) => set('deadline', v || undefined)} />
              {draft.deadline && <Button variant="ghost" icon={X} aria-label="Deadline entfernen" onClick={() => set('deadline', undefined)} />}
            </div>
          </Field>
          <Field label="Bevorzugte Tageszeit">
            <Segmented<TimeOfDay | 'any'>
              size="sm"
              value={draft.preferredTimeOfDay ?? 'any'}
              onChange={(v) => set('preferredTimeOfDay', v === 'any' ? undefined : v)}
              options={[
                { value: 'any', label: 'Egal' },
                { value: 'morning', label: 'Morgens' },
                { value: 'afternoon', label: 'Nachm.' },
                { value: 'evening', label: 'Abends' },
              ]}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kategorie">
            <CategorySelect value={draft.categoryId} onChange={(id) => set('categoryId', id)} />
          </Field>
          <Field label="Ziel (optional)">
            <GoalSelect value={draft.goalId} onChange={(id) => set('goalId', id)} />
          </Field>
        </div>

        <Field label="Eingeplant" hint="Ohne Uhrzeit = „an diesem Tag erledigen“. Mit Uhrzeit erscheint die Aufgabe als Block im Tagesplan.">
          <div className="flex gap-2">
            <DateInput
              value={draft.schedule?.date ?? ''}
              onChange={(v) => set('schedule', v ? { date: v, start: draft.schedule?.start } : undefined)}
            />
            {draft.schedule && (
              <>
                <TimeInput
                  className="w-32"
                  value={draft.schedule.start ?? ''}
                  onChange={(v) => set('schedule', { date: draft.schedule!.date, start: v })}
                />
                <Button variant="ghost" icon={X} aria-label="Planung entfernen" onClick={() => set('schedule', undefined)} />
              </>
            )}
          </div>
          {draft.schedule?.start && (
            <button type="button" className="mt-1 text-[11px] text-violet-300 hover:underline" onClick={() => set('schedule', { date: draft.schedule!.date })}>
              Uhrzeit entfernen
            </button>
          )}
        </Field>

        {task && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <Segmented<TaskStatus>
                size="sm"
                value={draft.status}
                onChange={(v) => set('status', v)}
                options={[
                  { value: 'todo', label: 'Offen' },
                  { value: 'in_progress', label: 'In Arbeit' },
                  { value: 'done', label: 'Erledigt' },
                ]}
              />
            </Field>
            {draft.goalId && (
              <Field label="Tatsächliche Zeit (optional)" hint="Zählt statt der Schätzung zum Ziel.">
                <NumberInput value={draft.actualMin ?? 0} min={0} step={5} onChange={(v) => set('actualMin', v || undefined)} suffix="min" />
              </Field>
            )}
          </div>
        )}

        <Field label="Beschreibung (optional)">
          <TextArea value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Notizen, Seiten, Links …" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
