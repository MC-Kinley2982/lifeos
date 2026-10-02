import { AlarmClock, CalendarClock, Moon, Pause, Play, Sparkles, Undo2 } from 'lucide-react';
import { formatDuration, toHHMM } from '../../domain/time';
import type { DateKey, DaySchedule, ScheduleBlock, Task, TimeSlot } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { Card, CardHeader } from '../../ui/Card';
import { alpha, cn } from '../../ui/cn';
import { BLOCK_ICON } from '../shared/blockMeta';
import { TaskCheckbox } from '../tasks/TaskItem';

type Entry =
  | { type: 'block'; start: number; block: ScheduleBlock }
  | { type: 'free'; start: number; slot: TimeSlot }
  | { type: 'wake'; start: number }
  | { type: 'bed'; start: number }
  | { type: 'now'; start: number };

interface TimelineProps {
  schedule: DaySchedule;
  date: DateKey;
  today: DateKey;
  nowMin: number;
  onPlan: () => void;
  onOpenTask: (task: Task) => void;
}

export function Timeline({ schedule, date, today, nowMin, onPlan, onOpenTask }: TimelineProps) {
  const tasks = useAppStore((s) => s.tasks);
  const toggleSkipSource = useAppStore((s) => s.toggleSkipSource);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const minSlot = useAppStore((s) => s.settings.planning.minSlotMin);
  const isToday = date === today;
  const editable = date >= today;
  const hasSleep = schedule.blocks.some((b) => b.kind === 'sleep');

  const entries: Entry[] = [
    ...schedule.blocks.filter((b) => b.kind !== 'sleep').map((block) => ({ type: 'block' as const, start: block.start, block })),
    // Sehr kurze Lücken (z. B. Puffer zwischen Aufgaben) nicht als eigene Zeile zeigen.
    ...schedule.freeSlots.filter((slot) => slot.end - slot.start >= Math.min(minSlot, 15)).map((slot) => ({ type: 'free' as const, start: slot.start, slot })),
  ].sort((a, b) => a.start - b.start || (a.type === 'block' ? -1 : 1));
  if (hasSleep) {
    entries.unshift({ type: 'wake', start: schedule.awake.start });
    if (schedule.awake.end < 24 * 60) entries.push({ type: 'bed', start: schedule.awake.end });
  }
  if (isToday && nowMin >= schedule.awake.start && nowMin < schedule.awake.end) {
    const idx = entries.findIndex((e) => e.start > nowMin);
    entries.splice(idx === -1 ? entries.length : idx, 0, { type: 'now', start: nowMin });
  }

  const paused = schedule.inactive.filter((x, i, arr) => arr.findIndex((y) => y.sourceKey === x.sourceKey) === i);

  return (
    <Card>
      <CardHeader title="Tagesablauf" icon={CalendarClock} subtitle={`${toHHMM(schedule.awake.start)} – ${toHHMM(schedule.awake.end)}`} />

      {schedule.allDayEvents.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {schedule.allDayEvents.map((e) => (
            <span key={e.id} className="rounded-full bg-white/5 px-3 py-1 text-xs">
              Ganztägig · {e.title}
            </span>
          ))}
        </div>
      )}

      <ol className="relative">
        {entries.map((entry, i) => {
          if (entry.type === 'now') {
            return (
              <li key="now" className="relative flex items-center gap-3 py-1.5">
                <span className="w-11 shrink-0 text-right text-[11px] font-semibold text-violet-300 tabular">{toHHMM(entry.start)}</span>
                <span className="relative h-2.5 w-2.5 shrink-0 rounded-full bg-violet-400 shadow-[0_0_0_4px_rgba(139,92,246,0.25)]" />
                <span className="h-px flex-1 bg-gradient-to-r from-violet-400/70 to-transparent" />
                <span className="text-[11px] font-medium text-violet-300">Jetzt</span>
              </li>
            );
          }
          if (entry.type === 'wake' || entry.type === 'bed') {
            const Icon = entry.type === 'wake' ? AlarmClock : Moon;
            return (
              <li key={entry.type} className="flex items-center gap-3 py-1.5 text-ink-muted">
                <span className="w-11 shrink-0 text-right text-xs tabular">{toHHMM(entry.start)}</span>
                <span className="flex h-2.5 w-2.5 shrink-0 items-center justify-center" />
                <span className="flex items-center gap-2 text-xs">
                  <Icon size={14} className="text-indigo-300" />
                  {entry.type === 'wake' ? 'Aufstehen' : 'Schlafenszeit'}
                </span>
              </li>
            );
          }
          if (entry.type === 'free') {
            const dur = entry.slot.end - entry.slot.start;
            const future = isToday ? entry.slot.end > nowMin : editable;
            const past = isToday && entry.slot.end <= nowMin;
            return (
              <li key={`free-${entry.slot.start}`} className={cn('flex gap-3 py-1', past && 'opacity-40')}>
                <span className="w-11 shrink-0 pt-2 text-right text-xs text-ink-faint tabular">{toHHMM(entry.slot.start)}</span>
                <span className="w-2.5 shrink-0" />
                <div className="flex flex-1 items-center justify-between gap-2 rounded-2xl border border-dashed border-emerald-400/25 bg-emerald-400/[0.04] px-3 py-2">
                  <span className="text-xs text-emerald-300/90">
                    <span className="font-medium">Frei</span> · {formatDuration(dur)}
                  </span>
                  {future && dur >= minSlot && (
                    <button type="button" onClick={onPlan} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-emerald-300/80 hover:bg-emerald-400/10">
                      <Sparkles size={12} /> Planen
                    </button>
                  )}
                </div>
              </li>
            );
          }

          const b = entry.block;
          const Icon = BLOCK_ICON[b.kind];
          const past = isToday && b.end <= nowMin;
          const current = isToday && b.start <= nowMin && nowMin < b.end;
          const task = b.kind === 'task' ? tasks.find((t) => t.id === b.sourceId) : undefined;
          const subtle = b.kind === 'travel' || b.kind === 'break';

          if (subtle) {
            return (
              <li key={b.id + i} className={cn('flex items-center gap-3 py-1', past && 'opacity-40')}>
                <span className="w-11 shrink-0 text-right text-[11px] text-ink-faint tabular">{toHHMM(b.start)}</span>
                <span className="w-2.5 shrink-0" />
                <span className="flex min-w-0 flex-1 items-center gap-2 px-3 text-xs text-ink-muted">
                  <Icon size={13} className="shrink-0 text-ink-faint" />
                  <span className="truncate">{b.title}</span>
                  <span className="shrink-0 text-ink-faint">· {formatDuration(b.end - b.start)}</span>
                </span>
                {b.kind === 'break' && editable && (
                  <button type="button" onClick={() => toggleSkipSource(date, b.sourceKey)} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-ink-faint hover:bg-white/5 hover:text-ink" title="Pause heute auslassen">
                    <Pause size={12} />
                    <span className="hidden sm:inline">Auslassen</span>
                  </button>
                )}
              </li>
            );
          }

          return (
            <li key={b.id + i} className={cn('flex gap-3 py-1', past && 'opacity-45')}>
              <span className={cn('w-11 shrink-0 pt-3 text-right text-xs tabular', current ? 'font-semibold text-ink' : 'text-ink-muted')}>{toHHMM(b.start)}</span>
              <span className="mt-4 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
              <div
                role={task ? 'button' : undefined}
                onClick={task ? () => onOpenTask(task) : undefined}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors',
                  task && 'cursor-pointer hover:brightness-125',
                  current && 'ring-1 ring-white/25',
                )}
                style={{ background: alpha(b.color, current ? 0.16 : 0.08), borderColor: alpha(b.color, 0.2) }}
              >
                {task ? (
                  <TaskCheckbox done={task.status === 'done'} onToggle={() => toggleTaskDone(task.id)} color={b.color} />
                ) : (
                  <Icon size={16} className="shrink-0" style={{ color: b.color }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-sm font-medium', task?.status === 'done' && 'text-ink-faint line-through')}>{b.title}</div>
                  <div className="text-[11px] text-ink-muted tabular">
                    {toHHMM(b.start)}–{toHHMM(b.end)} · {formatDuration(b.end - b.start)}
                    {!b.blocksFreeTime && ' · flexibel'}
                  </div>
                </div>
                {current && <span className="hidden shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium sm:inline">Läuft</span>}
                {b.skippable && editable && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSkipSource(date, b.sourceKey);
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-ink-faint hover:bg-white/5 hover:text-ink"
                    title="Nur an diesem Tag auslassen"
                  >
                    <Pause size={12} />
                    <span className="hidden sm:inline">Auslassen</span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {paused.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium text-ink-muted">An diesem Tag pausiert</p>
          <div className="flex flex-wrap gap-2">
            {paused.map((p) => (
              <span key={p.sourceKey} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pr-1 pl-3 text-xs text-ink-muted">
                {p.title}
                <span className="text-ink-faint">· {p.reason === 'state' ? schedule.dayState.definition.name : 'ausgelassen'}</span>
                {p.reason === 'skipped' && editable ? (
                  <button type="button" onClick={() => toggleSkipSource(date, p.sourceKey)} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-violet-300 hover:bg-violet-500/10" title="Wieder aktivieren">
                    <Undo2 size={12} />
                  </button>
                ) : (
                  <span className="w-1.5" />
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {entries.length <= 2 && (
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white/[0.03] px-3 py-3 text-xs text-ink-muted">
          <Play size={14} />
          Noch keine Routinen – lege unter „Routinen“ deinen Wochenplan an.
        </div>
      )}
    </Card>
  );
}
