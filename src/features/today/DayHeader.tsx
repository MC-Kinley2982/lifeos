import type { CSSProperties, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Hourglass } from 'lucide-react';
import { PATHS, navigate } from '../../app/router';
import { addDays, formatDateLong, formatDuration, formatHoursClock, getWeekday, WEEKDAY_LONG } from '../../domain/time';
import type { DateKey, DaySchedule, EnergyState } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { alpha, cn } from '../../ui/cn';
import { IconButton } from '../../ui/Button';
import { DynamicIcon } from '../../ui/icons';
import { EnergyBars } from '../shared/energy';

function greeting(hour: number): string {
  if (hour < 5) return 'Gute Nacht';
  if (hour < 11) return 'Guten Morgen';
  if (hour < 17) return 'Hallo';
  if (hour < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

interface DayHeaderProps {
  date: DateKey;
  today: DateKey;
  now: Date;
  schedule: DaySchedule;
  energy: EnergyState;
  freeMin: number;
  onOpenState: () => void;
  onOpenEnergy: () => void;
}

export function DayHeader({ date, today, now, schedule, energy, freeMin, onOpenState, onOpenEnergy }: DayHeaderProps) {
  const name = useAppStore((s) => s.settings.profile.name);
  const isToday = date === today;
  const state = schedule.dayState.definition;
  const goTo = (d: DateKey) => navigate(d === today ? PATHS.today : PATHS.day(d));

  return (
    <header className="mb-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">
            {isToday ? `${greeting(now.getHours())}${name ? `, ${name}` : ''}` : date < today ? 'Rückblick' : 'Vorschau'}
          </p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight sm:text-4xl">{WEEKDAY_LONG[getWeekday(date)]}</h1>
          <p className="mt-0.5 text-sm text-ink-muted tabular">{formatDateLong(date)}</p>
        </div>
        <div className="flex items-center gap-1 pt-1">
          <IconButton icon={ChevronLeft} label="Vorheriger Tag" variant="secondary" size="sm" onClick={() => goTo(addDays(date, -1))} />
          {!isToday && (
            <button type="button" onClick={() => goTo(today)} className="h-8 rounded-xl border border-line bg-surface-3 px-3 text-xs font-medium hover:bg-white/10">
              Heute
            </button>
          )}
          <IconButton icon={ChevronRight} label="Nächster Tag" variant="secondary" size="sm" onClick={() => goTo(addDays(date, 1))} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile
          onClick={onOpenState}
          label="Zustand"
          style={{ borderColor: alpha(state.color, 0.25), background: alpha(state.color, 0.08) }}
          value={
            <span className="flex items-center gap-1.5 truncate">
              <DynamicIcon name={state.icon} size={15} color={state.color} />
              <span className="truncate">{state.name}</span>
            </span>
          }
          sub={schedule.dayState.origin === 'manual' ? 'manuell' : schedule.dayState.label ?? 'automatisch'}
        />
        <StatTile
          onClick={onOpenEnergy}
          label="Energie"
          value={
            <span className="flex items-center gap-2">
              <EnergyBars level={energy.level} size="sm" />
              <span className="tabular">{energy.level}/5</span>
            </span>
          }
          sub={energy.source === 'manual' ? 'manuell' : 'geschätzt'}
        />
        <StatTile
          label="Frei"
          value={
            <span className="flex items-center gap-1.5 tabular">
              <Hourglass size={14} className="text-emerald-400" />
              <span className="truncate sm:hidden">{formatHoursClock(freeMin)} h</span>
              <span className="hidden truncate sm:inline">{formatDuration(freeMin)}</span>
            </span>
          }
          sub={isToday ? 'noch heute' : 'an diesem Tag'}
        />
      </div>
    </header>
  );
}

function StatTile({ label, value, sub, onClick, style }: { label: string; value: ReactNode; sub?: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={style}
      className={cn(
        'min-w-0 rounded-2xl border border-line bg-surface px-3 py-2.5 text-left sm:px-4 sm:py-3',
        onClick && 'transition-colors hover:border-line-strong active:scale-[0.98]',
      )}
    >
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className="mt-1 text-sm font-semibold sm:text-[15px]">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[10px] text-ink-faint sm:text-[11px]">{sub}</div>}
    </Comp>
  );
}
