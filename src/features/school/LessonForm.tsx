import { useMemo, useState } from 'react';
import { lessonDraft, type TimetableEntryInput } from '../../domain/factories';
import { toHHMM, toMinutes, WEEKDAY_SHORT } from '../../domain/time';
import type { TimetableEntry, Weekday } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { DeleteButton, Segmented } from '../../ui/controls';
import { Field, TextInput, TimeInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { SubjectSelect } from './SchoolBits';

/** Stunde anlegen/bearbeiten. Bekannte Klingelzeiten lassen sich mit einem Klick übernehmen. */
export function LessonForm({ lesson, weekday, onClose }: { lesson?: TimetableEntry; weekday?: Weekday; onClose: () => void }) {
  const timetable = useAppStore((s) => s.timetable);
  const subjects = useAppStore((s) => s.subjects);
  const { addLesson, updateLesson, removeLesson } = useAppStore.getState();

  const [draft, setDraft] = useState<TimetableEntryInput>(() => {
    if (lesson) return { ...lesson };
    const day = weekday ?? 0;
    const sameDay = timetable.filter((e) => e.weekday === day).sort((a, b) => a.end.localeCompare(b.end));
    const start = sameDay.length ? toHHMM(toMinutes(sameDay[sameDay.length - 1].end) + 5) : '08:00';
    return lessonDraft(subjects[0]?.id ?? '', day, start, toHHMM(toMinutes(start) + 45));
  });
  const set = <K extends keyof TimetableEntryInput>(key: K, value: TimetableEntryInput[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // Klingelzeiten aus dem bestehenden Stundenplan
  const periods = useMemo(() => {
    const seen = new Map<string, [string, string]>();
    for (const e of timetable) seen.set(`${e.start}-${e.end}`, [e.start, e.end]);
    return [...seen.values()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [timetable]);

  const invalid = toMinutes(draft.end) <= toMinutes(draft.start) || !draft.subjectId;

  const save = () => {
    if (invalid) return;
    if (lesson) updateLesson(lesson.id, draft);
    else addLesson(draft);
    toast(lesson ? 'Stunde gespeichert' : 'Stunde hinzugefügt');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={lesson ? 'Stunde bearbeiten' : 'Stunde hinzufügen'}
      footer={
        <div className="flex items-center gap-2">
          {lesson && <DeleteButton onConfirm={() => { removeLesson(lesson.id); toast('Stunde entfernt', 'info'); onClose(); }} />}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button variant="primary" onClick={save} disabled={invalid}>Speichern</Button>
          </div>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Fach">
          <SubjectSelect value={draft.subjectId} onChange={(id) => set('subjectId', id)} />
        </Field>
        <Field label="Wochentag">
          <Segmented<Weekday>
            size="sm"
            value={draft.weekday}
            onChange={(v) => set('weekday', v)}
            options={([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => ({ value: d, label: WEEKDAY_SHORT[d] }))}
          />
        </Field>
        {periods.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {periods.map(([s, e]) => (
              <button
                key={`${s}-${e}`}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, start: s, end: e }))}
                className={cn('rounded-lg px-2 py-1 text-[11px] tabular transition-colors', draft.start === s && draft.end === e ? 'bg-violet-500 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink')}
              >
                {s}–{e}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Beginn">
            <TimeInput value={draft.start} onChange={(v) => set('start', v)} />
          </Field>
          <Field label="Ende">
            <TimeInput value={draft.end} onChange={(v) => set('end', v)} />
          </Field>
        </div>
        {toMinutes(draft.end) <= toMinutes(draft.start) && <p className="-mt-2 text-xs text-red-300">Das Ende muss nach dem Beginn liegen.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Raum (optional)">
            <TextInput value={draft.room ?? ''} onChange={(e) => set('room', e.target.value || undefined)} />
          </Field>
          <Field label="Lehrkraft (optional)">
            <TextInput value={draft.teacher ?? ''} onChange={(e) => set('teacher', e.target.value || undefined)} />
          </Field>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
