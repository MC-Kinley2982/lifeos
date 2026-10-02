import { ChevronRight } from 'lucide-react';
import { PATHS, navigate } from '../../app/router';
import { formatDateShort, formatDuration, toHHMM, WEEKDAY_LONG } from '../../domain/time';
import type { DateKey, DaySchedule } from '../../domain/types';
import { alpha, cn } from '../../ui/cn';
import { Badge } from '../../ui/controls';
import { DynamicIcon } from '../../ui/icons';

/** Mobile Wochenansicht: eine kompakte Karte pro Tag mit Tagesbalken. */
export function WeekList({ schedules, today }: { schedules: DaySchedule[]; today: DateKey }) {
  return (
    <div className="space-y-3">
      {schedules.map((s) => {
        const isToday = s.date === today;
        const state = s.dayState.definition;
        const span = Math.max(1, s.awake.end - s.awake.start);
        const pos = (m: number) => `${((Math.max(s.awake.start, Math.min(s.awake.end, m)) - s.awake.start) / span) * 100}%`;
        const main = s.blocks.filter((b) => b.kind === 'routine' || b.kind === 'event' || b.kind === 'task');
        return (
          <button
            key={s.date}
            type="button"
            onClick={() => navigate(isToday ? PATHS.today : PATHS.day(s.date))}
            className={cn(
              'block w-full rounded-3xl border p-4 text-left transition-colors active:scale-[0.99]',
              isToday ? 'border-violet-400/30 bg-violet-500/[0.07]' : 'border-line bg-surface/80',
              s.date < today && 'opacity-60',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn('font-semibold', isToday && 'text-violet-200')}>{WEEKDAY_LONG[s.weekday]}</span>
                <span className="text-xs text-ink-muted tabular">{formatDateShort(s.date)}</span>
                {!state.builtIn && (
                  <Badge color={state.color} icon={<DynamicIcon name={state.icon} size={11} />}>
                    {state.name}
                  </Badge>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1 text-xs text-emerald-300/90">
                {formatDuration(s.totalFreeMin)} frei
                <ChevronRight size={15} className="text-ink-faint" />
              </div>
            </div>

            <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-emerald-400/25">
              {s.blocks
                .filter((b) => b.kind !== 'sleep' && b.blocksFreeTime)
                .map((b) => (
                  <span key={b.id} className="absolute inset-y-0" style={{ left: pos(b.start), width: `calc(${pos(b.end)} - ${pos(b.start)})`, background: b.color }} />
                ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-ink-faint tabular">
              <span>{toHHMM(s.awake.start)}</span>
              <span>{toHHMM(s.awake.end)}</span>
            </div>

            {main.length > 0 && (
              <div className="mt-2 space-y-1">
                {main.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 text-xs">
                    <span className="w-10 shrink-0 text-ink-muted tabular">{toHHMM(b.start)}</span>
                    <span className="h-3 w-1 shrink-0 rounded-full" style={{ background: b.color }} />
                    <span className="truncate" style={{ color: b.kind === 'task' ? alpha(b.color, 1) : undefined }}>
                      {b.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
