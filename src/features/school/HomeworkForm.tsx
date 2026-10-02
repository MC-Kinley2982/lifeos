import { useState } from 'react';
import { RefreshCw, WandSparkles } from 'lucide-react';
import type { HomeworkInput } from '../../domain/factories';
import { PRIORITY_LABEL } from '../../domain/labels';
import { nowIso } from '../../domain/ids';
import { todayKey } from '../../domain/time';
import type { Homework, Priority, TaskEnergy, TaskStatus } from '../../domain/types';
import { computeHomeworkDeadline, createHomeworkInput, defaultHomeworkMinutes } from '../../services/school/homework';
import { subjectLabel } from '../../services/school/timetable';
import { usePlannerData } from '../../store/hooks';
import { replanSchool } from '../../store/schoolAutomation';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { DeleteButton, Segmented } from '../../ui/controls';
import { DateInput, Field, NumberInput, TextArea, TextInput, TimeInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { formatDeadline, planSummary } from './format';
import { BlockRows, SubjectSelect, useSubject } from './SchoolBits';

const DURATIONS = [15, 30, 45, 60, 90];

const DEADLINE_HINT = {
  nextLesson: 'automatisch: vor der nächsten Stunde dieses Fachs',
  fallback: 'automatisch: keine weitere Stunde gefunden – Standard-Frist',
  manual: 'selbst festgelegt',
} as const;

interface HomeworkFormProps {
  homework?: Homework;
  defaults?: { subjectId?: string; assignedDate?: string };
  onClose: () => void;
}

export function HomeworkForm({ homework, defaults, onClose }: HomeworkFormProps) {
  const data = usePlannerData();
  const { addHomework, updateHomework, removeHomework } = useAppStore.getState();
  const live = useAppStore((s) => (homework ? s.homework.find((h) => h.id === homework.id) : undefined));
  const today = todayKey();
  const [draft, setDraft] = useState<HomeworkInput>(() => {
    if (homework) return { ...homework };
    const subjectId = defaults?.subjectId ?? data.subjects[0]?.id ?? '';
    return createHomeworkInput(data, subjectId, defaults?.assignedDate ?? today);
  });
  const [durationTouched, setDurationTouched] = useState(!!homework);
  const set = <K extends keyof HomeworkInput>(key: K, value: HomeworkInput[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const subject = useSubject(draft.subjectId);
  const color = subjectLabel(subject).color;

  const autoDeadline = (subjectId: string, assignedDate: string) => computeHomeworkDeadline(data, subjectId, assignedDate);

  const changeSubject = (subjectId: string) =>
    setDraft((d) => ({
      ...d,
      subjectId,
      deadline: d.deadline.source === 'manual' ? d.deadline : autoDeadline(subjectId, d.assignedDate),
      estimatedMinutes: durationTouched ? d.estimatedMinutes : defaultHomeworkMinutes(data, subjectId),
    }));

  const changeAssigned = (assignedDate: string) =>
    setDraft((d) => ({ ...d, assignedDate, deadline: d.deadline.source === 'manual' ? d.deadline : autoDeadline(d.subjectId, assignedDate) }));

  const save = () => {
    if (!draft.subjectId) return;
    const { plannedBlocks: _blocks, ...patch } = draft;
    if (homework) {
      const replanNeeded =
        homework.estimatedMinutes !== draft.estimatedMinutes ||
        homework.deadline.date !== draft.deadline.date ||
        homework.deadline.time !== draft.deadline.time ||
        (homework.status === 'done' && draft.status !== 'done');
      updateHomework(homework.id, {
        ...patch,
        completedAt: draft.status === 'done' ? (homework.completedAt ?? nowIso()) : undefined,
      });
      if (replanNeeded) toast(planSummary(replanSchool({ homeworkIds: [homework.id] })));
      else toast('Hausaufgabe gespeichert');
    } else {
      const id = addHomework({ ...draft, title: draft.title.trim() });
      toast(planSummary(replanSchool({ homeworkIds: [id] })));
    }
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title={homework ? 'Hausaufgabe bearbeiten' : 'Neue Hausaufgabe'}
      footer={
        <div className="flex items-center gap-2">
          {homework && <DeleteButton onConfirm={() => { removeHomework(homework.id); toast('Hausaufgabe gelöscht', 'info'); onClose(); }} />}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button variant="primary" onClick={save} disabled={!draft.subjectId}>Speichern</Button>
          </div>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
          <Field label="Fach">
            <SubjectSelect value={draft.subjectId} onChange={changeSubject} />
          </Field>
          <Field label="Aufgegeben am">
            <DateInput value={draft.assignedDate} onChange={(v) => v && changeAssigned(v)} />
          </Field>
        </div>

        <Field label="Aufgabe">
          <TextInput autoFocus={!homework} value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="z. B. S. 43 Nr. 3–7" />
        </Field>

        <Field label="Geschätzte Dauer" hint={`Standard: ${defaultHomeworkMinutes(data, draft.subjectId)} min${subject?.homeworkMinutes ? ` (Ø für ${subject.name})` : ''}`}>
          <div className="flex flex-wrap items-center gap-1.5">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { set('estimatedMinutes', m); setDurationTouched(true); }}
                className={cn('h-8 rounded-lg px-2.5 text-xs font-medium tabular transition-colors', draft.estimatedMinutes === m ? 'bg-violet-500 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink')}
              >
                {m} min
              </button>
            ))}
            <NumberInput className="w-28" value={draft.estimatedMinutes} min={5} step={5} suffix="min" onChange={(v) => { set('estimatedMinutes', v); setDurationTouched(true); }} />
          </div>
        </Field>

        <Field label="Deadline" hint={DEADLINE_HINT[draft.deadline.source]}>
          <div className="flex flex-wrap gap-2">
            <DateInput className="w-44" value={draft.deadline.date} onChange={(v) => v && set('deadline', { ...draft.deadline, date: v, source: 'manual' })} />
            <TimeInput className="w-32" value={draft.deadline.time ?? ''} onChange={(v) => set('deadline', { ...draft.deadline, time: v, source: 'manual' })} />
            {draft.deadline.source === 'manual' && (
              <Button variant="ghost" size="sm" icon={WandSparkles} className="h-10" onClick={() => set('deadline', autoDeadline(draft.subjectId, draft.assignedDate))}>
                Automatisch
              </Button>
            )}
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
          <Field label="Anstrengung">
            <Segmented<TaskEnergy>
              size="sm"
              value={draft.energy}
              onChange={(v) => set('energy', v)}
              options={[
                { value: 'low', label: 'Leicht' },
                { value: 'medium', label: 'Mittel' },
                { value: 'high', label: 'Schwer' },
              ]}
            />
          </Field>
        </div>

        <Field label="Notiz (optional)">
          <TextArea value={draft.note ?? ''} onChange={(e) => set('note', e.target.value || undefined)} placeholder="z. B. Arbeitsblatt im Ordner" />
        </Field>

        {homework && live && (
          <>
            <Field label="Status">
              <Segmented<TaskStatus>
                size="sm"
                value={draft.status}
                onChange={(v) => set('status', v)}
                options={[
                  { value: 'todo', label: 'Offen' },
                  { value: 'in_progress', label: 'Angefangen' },
                  { value: 'done', label: 'Erledigt' },
                ]}
              />
            </Field>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-muted">Eingeplante Zeit</span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={RefreshCw}
                  onClick={() => toast(planSummary(replanSchool({ homeworkIds: [homework.id], reset: true }, true)))}
                >
                  Neu planen
                </Button>
              </div>
              <BlockRows owner={{ kind: 'homework', id: homework.id }} blocks={live.plannedBlocks} color={color} deadlineLabel={formatDeadline(live.deadline, today)} />
            </div>
          </>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
