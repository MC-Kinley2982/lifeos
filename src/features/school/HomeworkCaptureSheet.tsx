import { useMemo, useState } from 'react';
import { ChevronDown, NotebookPen } from 'lucide-react';
import type { HomeworkInput } from '../../domain/factories';
import { PRIORITY_LABEL } from '../../domain/labels';
import { todayKey } from '../../domain/time';
import type { DateKey, Priority, Subject } from '../../domain/types';
import { createHomeworkInput } from '../../services/school/homework';
import { subjectLabel, subjectsOn } from '../../services/school/timetable';
import type { SchoolPlanResult } from '../../services/school/types';
import { usePlannerData } from '../../store/hooks';
import { replanSchool } from '../../store/schoolAutomation';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/Card';
import { alpha, cn } from '../../ui/cn';
import { Segmented } from '../../ui/controls';
import { DateInput, Field, NumberInput, TextInput, TimeInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { TaskCheckbox } from '../tasks/TaskItem';
import { formatDeadline } from './format';
import { PlanResultView } from './PlanResultView';

interface CaptureSheetProps {
  /** prompt = automatische Nachfrage nach der Schule, manual = selbst geöffnet. */
  mode: 'prompt' | 'manual';
  date?: DateKey;
  onClose: () => void;
  /** Nur im Prompt-Modus: "Später" bzw. "Keine Hausaufgaben". */
  onSnooze?: () => void;
  onDone?: () => void;
}

/**
 * "Welche Hausaufgaben hast du heute bekommen?"
 * Zeigt die Fächer des Tages; pro ausgewähltem Fach Aufgabe + Dauer (Standard aus den Einstellungen).
 * Deadline (nächste Stunde) und Einplanung passieren automatisch.
 */
export function HomeworkCaptureSheet({ mode, date: initialDate, onClose, onSnooze, onDone }: CaptureSheetProps) {
  const data = usePlannerData();
  const addHomework = useAppStore((s) => s.addHomework);
  const [date, setDate] = useState<DateKey>(initialDate ?? todayKey());
  const [drafts, setDrafts] = useState<Record<string, HomeworkInput>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [result, setResult] = useState<{ plan: SchoolPlanResult; titles: Array<{ id: string; owner: 'homework'; title: string }> } | null>(null);

  // Fächer des Tages (aktiver Unterricht) – sonst laut Stundenplan – sonst alle Fächer.
  const { subjects, hint } = useMemo(() => {
    const active = subjectsOn(data, date, true);
    if (active.length) return { subjects: active, hint: null };
    const planned = subjectsOn(data, date, false);
    if (planned.length) return { subjects: planned, hint: 'Heute ist laut Tageszustand kein Unterricht – Hausaufgaben kannst du trotzdem eintragen.' };
    return { subjects: data.subjects, hint: data.subjects.length ? 'Für diesen Tag ist kein Unterricht eingetragen – alle Fächer werden angezeigt.' : null };
  }, [data, date]);

  const toggle = (s: Subject) =>
    setDrafts((d) => {
      if (d[s.id]) {
        const { [s.id]: _removed, ...rest } = d;
        return rest;
      }
      setExpanded(null);
      return { ...d, [s.id]: createHomeworkInput(data, s.id, date) };
    });

  const patch = (id: string, p: Partial<HomeworkInput>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...p } }));
  const selected = Object.values(drafts);

  const submit = () => {
    const titles = selected.map((input) => {
      const id = addHomework({ ...input, title: input.title.trim() });
      return { id, owner: 'homework' as const, title: `${subjectLabel(data.subjects.find((s) => s.id === input.subjectId)).name}: ${input.title.trim() || 'Hausaufgabe'}` };
    });
    const plan = replanSchool({ homeworkIds: titles.map((t) => t.id) });
    onDone?.();
    setResult({ plan, titles });
  };

  const today = todayKey();

  if (result) {
    return (
      <Sheet open onClose={onClose} title="Hausaufgaben eingetragen" subtitle="Deadline und Planung wurden automatisch gesetzt." footer={<Button variant="primary" block onClick={onClose}>Fertig</Button>}>
        <PlanResultView result={result.plan} titles={result.titles} />
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={mode === 'prompt' ? onSnooze ?? onClose : onClose}
      title={mode === 'prompt' ? 'Schule geschafft 👋' : 'Hausaufgaben eintragen'}
      subtitle={mode === 'prompt' ? 'Welche Hausaufgaben hast du heute bekommen?' : 'Fach auswählen und kurz beschreiben – den Rest plant LifeOS.'}
      footer={
        <div className="flex items-center gap-2">
          {mode === 'prompt' ? (
            <>
              <Button variant="ghost" onClick={onSnooze}>Später</Button>
              <Button variant="ghost" onClick={() => { onDone?.(); onClose(); }}>Keine Hausaufgaben</Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          )}
          <Button variant="primary" className="ml-auto" icon={NotebookPen} onClick={submit} disabled={selected.length === 0}>
            Hinzufügen{selected.length ? ` (${selected.length})` : ''}
          </Button>
        </div>
      }
    >
      {mode === 'manual' && (
        <Field label="Aufgegeben am" className="mb-4">
          <DateInput value={date} onChange={(v) => { if (v) { setDate(v); setDrafts({}); } }} />
        </Field>
      )}
      {hint && <p className="mb-3 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-ink-muted">{hint}</p>}
      {subjects.length === 0 ? (
        <EmptyState icon={NotebookPen} title="Noch keine Fächer" text="Lege im Bereich „Schule“ deine Fächer und deinen Stundenplan an." />
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => {
            const draft = drafts[s.id];
            const label = subjectLabel(s);
            const open = expanded === s.id;
            return (
              <div
                key={s.id}
                className={cn('rounded-2xl border transition-colors', draft ? 'border-transparent' : 'border-line bg-surface')}
                style={draft ? { background: alpha(label.color, 0.08), borderColor: alpha(label.color, 0.3) } : undefined}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(s)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(s))}
                  className="flex w-full cursor-pointer items-center gap-3 p-3 text-left"
                >
                  <TaskCheckbox done={!!draft} onToggle={() => toggle(s)} color={label.color} />
                  <span className="flex-1 text-sm font-medium">{label.name}</span>
                  {draft && <span className="text-[11px] text-ink-muted">bis {formatDeadline(draft.deadline, today)}</span>}
                </div>
                {draft && (
                  <div className="space-y-3 px-3 pb-3">
                    <TextInput autoFocus value={draft.title} onChange={(e) => patch(s.id, { title: e.target.value })} placeholder="Aufgabe, z. B. S. 43 Nr. 3–7" />
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : s.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink-muted hover:text-ink"
                    >
                      {draft.estimatedMinutes} min
                      <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
                    </button>
                    {open && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Geschätzte Zeit">
                          <NumberInput value={draft.estimatedMinutes} min={5} step={5} suffix="min" onChange={(v) => patch(s.id, { estimatedMinutes: v })} />
                        </Field>
                        <Field label="Priorität">
                          <Segmented<Priority>
                            size="sm"
                            value={draft.priority}
                            onChange={(v) => patch(s.id, { priority: v })}
                            options={(['low', 'medium', 'high'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
                          />
                        </Field>
                        <Field label="Deadline" hint={draft.deadline.source === 'nextLesson' ? 'Automatisch: nächste Stunde' : undefined}>
                          <div className="flex gap-2">
                            <DateInput value={draft.deadline.date} onChange={(v) => v && patch(s.id, { deadline: { ...draft.deadline, date: v, source: 'manual' } })} />
                            <TimeInput className="w-28" value={draft.deadline.time ?? ''} onChange={(v) => patch(s.id, { deadline: { ...draft.deadline, time: v, source: 'manual' } })} />
                          </div>
                        </Field>
                        <Field label="Notiz (optional)">
                          <TextInput value={draft.note ?? ''} onChange={(e) => patch(s.id, { note: e.target.value || undefined })} />
                        </Field>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
