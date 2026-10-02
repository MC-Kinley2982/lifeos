import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { examDraft, type ExamInput } from '../../domain/factories';
import { PRIORITY_LABEL } from '../../domain/labels';
import { addDays, formatHoursClock, getWeekday, todayKey } from '../../domain/time';
import type { Exam, Priority, TaskEnergy, TimeOfDay } from '../../domain/types';
import { studyProgress, studyStartOf } from '../../services/school/exams';
import { lessonsForWeekday, subjectLabel } from '../../services/school/timetable';
import { usePlannerData } from '../../store/hooks';
import { replanSchool } from '../../store/schoolAutomation';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { DeleteButton, ProgressBar, Segmented, Toggle } from '../../ui/controls';
import { DateInput, Field, NumberInput, TextArea, TextInput, TimeInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { dayShort, planSummary } from './format';
import { BlockRows, SubjectSelect, useSubject } from './SchoolBits';

const TITLES = ['Klassenarbeit', 'Test', 'Vokabeltest', 'Referat', 'Präsentation'];

export function ExamForm({ exam, onClose }: { exam?: Exam; onClose: () => void }) {
  const data = usePlannerData();
  const { addExam, updateExam, removeExam } = useAppStore.getState();
  const live = useAppStore((s) => (exam ? s.exams.find((e) => e.id === exam.id) : undefined));
  const today = todayKey();
  const [draft, setDraft] = useState<ExamInput>(() => (exam ? { ...exam } : examDraft(data.settings, data.subjects[0]?.id ?? '', addDays(today, 7))));
  const set = <K extends keyof ExamInput>(key: K, value: ExamInput[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const color = subjectLabel(useSubject(draft.subjectId)).color;
  const studyOn = draft.desiredStudyMinutes > 0;
  const hours = Math.floor(draft.desiredStudyMinutes / 60);
  const minutes = draft.desiredStudyMinutes % 60;
  const setStudy = (h: number, m: number) => set('desiredStudyMinutes', Math.max(0, h * 60 + m));

  // Stunde des Fachs an diesem Tag – Uhrzeit mit einem Klick übernehmen.
  const lesson = lessonsForWeekday(data, getWeekday(draft.date)).find((e) => e.subjectId === draft.subjectId);
  const defaultStart = studyStartOf(data, { ...draft, id: '', createdAt: '', updatedAt: '' } as Exam);

  const save = () => {
    if (!draft.subjectId || !draft.date) return;
    const { studySessions: _sessions, ...patch } = draft;
    const next = { ...patch, title: draft.title.trim() || 'Test' };
    if (exam) {
      const studyChanged =
        exam.desiredStudyMinutes !== draft.desiredStudyMinutes ||
        exam.studyStartDate !== draft.studyStartDate ||
        exam.sessionMinutes !== draft.sessionMinutes ||
        exam.preferredTimeOfDay !== draft.preferredTimeOfDay ||
        exam.date !== draft.date;
      updateExam(exam.id, next);
      toast(studyChanged ? planSummary(replanSchool({ examIds: [exam.id], reset: true })) : 'Test gespeichert');
    } else {
      const id = addExam({ ...next, studySessions: [] });
      toast(planSummary(replanSchool({ examIds: [id] })));
    }
    onClose();
  };

  const progress = live ? studyProgress(live, new Date()) : null;

  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title={exam ? 'Test bearbeiten' : 'Neuer Test'}
      footer={
        <div className="flex items-center gap-2">
          {exam && <DeleteButton onConfirm={() => { removeExam(exam.id); toast('Test gelöscht', 'info'); onClose(); }} />}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button variant="primary" onClick={save} disabled={!draft.subjectId}>Speichern</Button>
          </div>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fach">
            <SubjectSelect value={draft.subjectId} onChange={(id) => set('subjectId', id)} />
          </Field>
          <Field label="Art">
            <TextInput value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="z. B. Klassenarbeit" />
          </Field>
        </div>
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {TITLES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set('title', t)}
              className={cn('rounded-lg px-2.5 py-1 text-xs transition-colors', draft.title === t ? 'bg-violet-500 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink')}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Datum" className="col-span-2">
            <DateInput value={draft.date} onChange={(v) => v && set('date', v)} />
          </Field>
          <Field label="Beginn (optional)">
            <TimeInput value={draft.startTime ?? ''} onChange={(v) => set('startTime', v)} />
          </Field>
          <Field label="Ende (optional)">
            <TimeInput value={draft.endTime ?? ''} onChange={(v) => set('endTime', v)} />
          </Field>
        </div>
        {lesson && (draft.startTime !== lesson.start || draft.endTime !== lesson.end) && (
          <button type="button" className="-mt-2 text-xs text-violet-300 hover:underline" onClick={() => setDraft((d) => ({ ...d, startTime: lesson.start, endTime: lesson.end }))}>
            Zeit der {subjectLabel(data.subjects.find((s) => s.id === draft.subjectId)).name}-Stunde übernehmen ({lesson.start}–{lesson.end})
          </button>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Raum (optional)">
            <TextInput value={draft.room ?? ''} onChange={(e) => set('room', e.target.value || undefined)} />
          </Field>
          <Field label="Priorität">
            <Segmented<Priority>
              size="sm"
              value={draft.priority}
              onChange={(v) => set('priority', v)}
              options={(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </Field>
        </div>
        <Field label="Notizen (optional)">
          <TextArea value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} placeholder="Themen, Seiten, Hilfsmittel …" />
        </Field>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <Toggle
            checked={studyOn}
            onChange={(v) => set('desiredStudyMinutes', v ? data.settings.school.defaultStudyMinutes : 0)}
            label="Lernzeit einplanen"
            description="LifeOS verteilt die Lernzeit automatisch auf freie Zeit vor dem Test."
          />
          {studyOn && (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Lernzeit insgesamt">
                  <div className="flex gap-2">
                    <NumberInput value={hours} min={0} suffix="h" onChange={(v) => setStudy(v, minutes)} />
                    <NumberInput value={minutes} min={0} max={59} step={15} suffix="min" onChange={(v) => setStudy(hours, Math.min(59, v))} />
                  </div>
                </Field>
                <Field label="Anfangen am" hint={draft.studyStartDate ? undefined : `Standard: ${dayShort(defaultStart, today)} (${data.settings.school.defaultStudyLeadDays} Tage vorher)`}>
                  <DateInput value={draft.studyStartDate ?? ''} onChange={(v) => set('studyStartDate', v || undefined)} />
                </Field>
                <Field label="Lerneinheit">
                  <NumberInput value={draft.sessionMinutes ?? data.settings.school.defaultStudySessionMin} min={15} step={15} suffix="min" onChange={(v) => set('sessionMinutes', v)} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bevorzugte Lernzeit">
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
              {live && progress && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-ink-muted tabular">
                      Gelernt {formatHoursClock(progress.doneMin)} / {formatHoursClock(progress.targetMin)} h · geplant {formatHoursClock(progress.plannedMin)} h
                    </span>
                    <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => toast(planSummary(replanSchool({ examIds: [live.id], reset: true }, true)))}>
                      Lernplan neu berechnen
                    </Button>
                  </div>
                  <ProgressBar className="mb-3" value={progress.percent} planned={progress.targetMin ? (progress.plannedMin / progress.targetMin) * 100 : 0} color={color} />
                  <BlockRows owner={{ kind: 'exam', id: live.id }} blocks={live.studySessions} color={color} deadlineLabel={`vor dem ${dayShort(live.date, today)}`} />
                </div>
              )}
            </div>
          )}
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
