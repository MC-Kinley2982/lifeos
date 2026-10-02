import { PATHS, navigate } from '../../app/router';
import { formatDuration, parseDateKey, toHHMM, WEEKDAY_SHORT } from '../../domain/time';
import type { DateKey, DaySchedule } from '../../domain/types';
import { alpha, cn } from '../../ui/cn';
import { DynamicIcon } from '../../ui/icons';
import { layoutBlocks } from './layout';

const PX_PER_MIN = 0.8;

interface WeekGridProps {
  schedules: DaySchedule[];
  today: DateKey;
  nowMin: number;
}

/** Desktop: klassisches Wochenraster mit Zeitachse. Freie Zeit ist grün schraffiert. */
export function WeekGrid({ schedules, today, nowMin }: WeekGridProps) {
  const axisStart = Math.floor(Math.min(...schedules.map((s) => s.awake.start)) / 60) * 60;
  const axisEnd = Math.ceil(Math.max(...schedules.map((s) => s.awake.end)) / 60) * 60;
  const height = (axisEnd - axisStart) * PX_PER_MIN;
  const hours = Array.from({ length: (axisEnd - axisStart) / 60 + 1 }, (_, i) => axisStart + i * 60);
  const y = (m: number) => (Math.max(axisStart, Math.min(axisEnd, m)) - axisStart) * PX_PER_MIN;

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface/80">
      {/* Kopfzeile */}
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-line">
        <div />
        {schedules.map((s) => {
          const isToday = s.date === today;
          const state = s.dayState.definition;
          return (
            <button
              key={s.date}
              type="button"
              onClick={() => navigate(s.date === today ? PATHS.today : PATHS.day(s.date))}
              className={cn('border-l border-line px-2 py-3 text-left transition-colors hover:bg-white/[0.03]', isToday && 'bg-violet-500/[0.07]')}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={cn('text-xs font-medium', isToday ? 'text-violet-300' : 'text-ink-muted')}>{WEEKDAY_SHORT[s.weekday]}</span>
                {!state.builtIn && <DynamicIcon name={state.icon} size={13} color={state.color} />}
              </div>
              <div className={cn('text-xl font-semibold tabular', isToday && 'text-violet-200')}>{parseDateKey(s.date).getDate()}</div>
              <div className="mt-0.5 truncate text-[11px] text-emerald-300/80">{formatDuration(s.totalFreeMin)} frei</div>
            </button>
          );
        })}
      </div>

      {/* Raster */}
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
        <div className="relative" style={{ height }}>
          {hours.map((h) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-ink-faint tabular" style={{ top: y(h) }}>
              {h < axisEnd ? toHHMM(h) : ''}
            </span>
          ))}
        </div>
        {schedules.map((s) => {
          const isToday = s.date === today;
          const visible = s.blocks.filter((b) => b.end > axisStart && b.start < axisEnd);
          return (
            <div key={s.date} className={cn('relative border-l border-line', isToday && 'bg-violet-500/[0.04]')} style={{ height }}>
              {hours.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-white/[0.04]" style={{ top: y(h) }} />
              ))}
              {s.freeSlots.map((f) => (
                <div
                  key={`f${f.start}`}
                  className="free-hatch absolute inset-x-1 rounded-md"
                  style={{ top: y(f.start), height: Math.max(2, y(f.end) - y(f.start)) }}
                  title={`Frei ${toHHMM(f.start)}–${toHHMM(f.end)} (${formatDuration(f.end - f.start)})`}
                />
              ))}
              {layoutBlocks(visible).map(({ block: b, lane, lanes }) => {
                const top = y(b.start);
                const h = Math.max(12, y(b.end) - top - 1);
                const subtle = b.kind === 'travel' || b.kind === 'break' || b.kind === 'sleep';
                const width = 100 / lanes;
                return (
                  <div
                    key={b.id}
                    title={`${b.title} · ${toHHMM(b.start)}–${toHHMM(b.end)}`}
                    className={cn('absolute overflow-hidden rounded-md px-1.5 text-[10px] leading-tight', subtle ? 'text-ink-faint' : 'text-ink')}
                    style={{
                      top,
                      height: h,
                      left: `calc(${lane * width}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                      background: b.kind === 'sleep' ? 'rgba(129,140,248,0.06)' : alpha(b.color, subtle ? 0.1 : 0.22),
                      borderLeft: `2px solid ${alpha(b.color, subtle ? 0.35 : 0.9)}`,
                    }}
                  >
                    {h >= 16 && <div className="truncate pt-0.5 font-medium">{b.title}</div>}
                    {h >= 30 && !subtle && <div className="truncate text-ink-muted tabular">{toHHMM(b.start)}–{toHHMM(b.end)}</div>}
                  </div>
                );
              })}
              {isToday && nowMin > axisStart && nowMin < axisEnd && (
                <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: y(nowMin) }}>
                  <span className="-ml-1 h-2 w-2 rounded-full bg-violet-400" />
                  <span className="h-px flex-1 bg-violet-400" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
