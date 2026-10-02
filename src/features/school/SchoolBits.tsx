import { Plus, Trash } from 'lucide-react';
import { todayKey, toHHMM, toMinutes } from '../../domain/time';
import type { ID, SchoolBlock } from '../../domain/types';
import { subjectLabel } from '../../services/school/timetable';
import { useAppStore } from '../../store/useAppStore';
import type { BlockOwner } from '../../store/types';
import { Button } from '../../ui/Button';
import { alpha, cn } from '../../ui/cn';
import { Badge } from '../../ui/controls';
import { DateInput, NumberInput, Select, TimeInput } from '../../ui/fields';
import { TaskCheckbox } from '../tasks/TaskItem';

export function useSubject(id: ID | undefined) {
  return useAppStore((s) => (id ? s.subjects.find((x) => x.id === id) : undefined));
}

export function SubjectBadge({ subjectId, short }: { subjectId: ID; short?: boolean }) {
  const label = subjectLabel(useSubject(subjectId));
  return <Badge color={label.color}>{short ? label.short : label.name}</Badge>;
}

/** Farbiger Balken für Listen. */
export function SubjectBar({ subjectId, className }: { subjectId: ID; className?: string }) {
  const label = subjectLabel(useSubject(subjectId));
  return <span className={cn('w-1 shrink-0 self-stretch rounded-full', className)} style={{ background: label.color }} />;
}

export function SubjectSelect({ value, onChange }: { value: ID; onChange: (id: ID) => void }) {
  const subjects = useAppStore((s) => s.subjects);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {subjects.length === 0 && <option value="">Noch keine Fächer</option>}
      {subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}

/**
 * Geplante Blöcke direkt bearbeiten (verschieben, kürzen, erledigen, löschen).
 * Jede Zeit-Änderung macht den Block "manuell" – der Planer verschiebt ihn danach nicht mehr.
 */
export function BlockRows({ owner, blocks, deadlineLabel, color }: { owner: BlockOwner; blocks: SchoolBlock[]; deadlineLabel?: string; color: string }) {
  const { updateSchoolBlock, removeSchoolBlock, addSchoolBlock } = useAppStore.getState();
  const today = todayKey();
  const sorted = [...blocks].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const last = sorted[sorted.length - 1];

  return (
    <div className="space-y-2">
      {sorted.length === 0 && <p className="text-xs text-ink-faint">Noch keine Blöcke geplant.</p>}
      {sorted.map((b) => (
        <div
          key={b.id}
          className={cn('flex flex-wrap items-center gap-2 rounded-2xl border p-2', b.done && 'opacity-60')}
          style={{ borderColor: alpha(color, 0.25), background: alpha(color, 0.06) }}
        >
          <TaskCheckbox done={b.done} onToggle={() => updateSchoolBlock(owner, b.id, { done: !b.done })} color={color} />
          <DateInput className="h-9 w-[9.5rem]" value={b.date} onChange={(v) => v && updateSchoolBlock(owner, b.id, { date: v })} />
          <TimeInput className="h-9 w-[6.5rem]" value={b.start} onChange={(v) => updateSchoolBlock(owner, b.id, { start: v })} />
          <NumberInput className="w-[6.5rem]" value={b.durationMin} min={5} step={5} suffix="min" onChange={(v) => v >= 5 && updateSchoolBlock(owner, b.id, { durationMin: v })} />
          <span className="text-[11px] text-ink-faint">
            bis {toHHMM(toMinutes(b.start) + b.durationMin)} · {b.source === 'manual' ? 'manuell' : 'automatisch'}
          </span>
          <button type="button" aria-label="Block löschen" onClick={() => removeSchoolBlock(owner, b.id)} className="ml-auto rounded-lg p-2 text-ink-faint hover:bg-white/5 hover:text-red-300">
            <Trash size={14} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          icon={Plus}
          onClick={() => addSchoolBlock(owner, { date: last && last.date >= today ? last.date : today, start: '16:00', durationMin: 30, source: 'manual', done: false })}
        >
          Block hinzufügen
        </Button>
        {deadlineLabel && <span className="text-[11px] text-ink-faint">Muss fertig sein: {deadlineLabel}</span>}
      </div>
    </div>
  );
}
