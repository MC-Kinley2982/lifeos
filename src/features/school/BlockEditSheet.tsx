import { useMemo, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { toDateKey, toHHMM, toMinutes } from '../../domain/time';
import type { ID } from '../../domain/types';
import { buildDaySchedule } from '../../services/planner';
import { deadlineMoment } from '../../services/school/homework';
import { subjectById, subjectLabel } from '../../services/school/timetable';
import { usePlannerData } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import type { BlockOwner } from '../../store/types';
import { Button } from '../../ui/Button';
import { DeleteButton, Toggle } from '../../ui/controls';
import { DateInput, Field, NumberInput, TimeInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { formatDeadline } from './format';

/**
 * Einen Hausaufgaben- oder Lernblock verschieben (z. B. aus der Timeline).
 * Der Block bleibt mit seiner Hausaufgabe/seinem Test – und damit der Deadline – verbunden.
 */
export function BlockEditSheet({ owner, blockId, onClose }: { owner: BlockOwner; blockId: ID; onClose: () => void }) {
  const data = usePlannerData();
  const { updateSchoolBlock, removeSchoolBlock, toggleHomeworkDone } = useAppStore.getState();
  const hw = owner.kind === 'homework' ? data.homework.find((h) => h.id === owner.id) : undefined;
  const exam = owner.kind === 'exam' ? data.exams.find((e) => e.id === owner.id) : undefined;
  const block = (hw?.plannedBlocks ?? exam?.studySessions ?? []).find((b) => b.id === blockId);
  const [draft, setDraft] = useState(() => (block ? { date: block.date, start: block.start, durationMin: block.durationMin, done: block.done } : null));

  const label = subjectLabel(subjectById(data, hw?.subjectId ?? exam?.subjectId ?? ''));
  const title = hw ? `${label.name}: ${hw.title || 'Hausaufgabe'}` : exam ? `Lernen: ${label.name} · ${exam.title}` : '';
  const today = toDateKey(new Date());

  // Hinweise: nach der Deadline? Überschneidung mit festen Terminen? Außerhalb der Wachzeit?
  const warnings = useMemo(() => {
    if (!draft) return [];
    const out: string[] = [];
    const start = toMinutes(draft.start);
    const end = start + draft.durationMin;
    if (hw) {
      const due = deadlineMoment(hw.deadline);
      if (draft.date > due.date || (draft.date === due.date && end > due.minute)) out.push(`Liegt nach der Deadline (${formatDeadline(hw.deadline, today)}).`);
    }
    if (exam && draft.date >= exam.date) out.push('Liegt nicht vor dem Test.');
    const schedule = buildDaySchedule(data, draft.date);
    const clash = schedule.blocks.find((b) => b.blocksFreeTime && b.kind !== 'sleep' && b.itemId !== blockId && b.start < end && start < b.end);
    if (clash) out.push(`Überschneidet sich mit „${clash.title}“ (${toHHMM(clash.start)}–${toHHMM(clash.end)}).`);
    if (start < schedule.awake.start || end > schedule.awake.end) out.push('Liegt außerhalb deiner Wachzeit.');
    return out;
  }, [draft, data, hw, exam, blockId, today]);

  if (!block || !draft) return null;

  const save = () => {
    updateSchoolBlock(owner, blockId, draft);
    toast('Block gespeichert');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Block bearbeiten"
      subtitle={title}
      footer={
        <div className="flex items-center gap-2">
          <DeleteButton
            label="Löschen"
            onConfirm={() => {
              removeSchoolBlock(owner, blockId);
              toast('Block gelöscht', 'info');
              onClose();
            }}
          />
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button variant="primary" onClick={save}>Speichern</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Datum" className="col-span-2 sm:col-span-1">
            <DateInput value={draft.date} onChange={(v) => v && setDraft({ ...draft, date: v })} />
          </Field>
          <Field label="Beginn">
            <TimeInput value={draft.start} onChange={(v) => setDraft({ ...draft, start: v })} />
          </Field>
          <Field label="Dauer">
            <NumberInput value={draft.durationMin} min={5} step={5} suffix="min" onChange={(v) => setDraft({ ...draft, durationMin: Math.max(5, v) })} />
          </Field>
        </div>
        <Toggle checked={draft.done} onChange={(v) => setDraft({ ...draft, done: v })} label="Erledigt" description="Zählt als geschaffte Zeit." />
        {warnings.map((w) => (
          <p key={w} className="flex items-start gap-2 rounded-xl bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {w}
          </p>
        ))}
        <p className="text-[11px] text-ink-faint">Verschobene Blöcke werden vom automatischen Planer nicht mehr verändert.</p>
        {hw && hw.status !== 'done' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              toggleHomeworkDone(hw.id);
              toast('Hausaufgabe erledigt');
              onClose();
            }}
          >
            Ganze Hausaufgabe als erledigt markieren
          </Button>
        )}
      </div>
    </Sheet>
  );
}
