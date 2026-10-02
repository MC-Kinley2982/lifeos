import { Hourglass, ShieldCheck, Sparkles } from 'lucide-react';
import { formatDuration } from '../../domain/time';
import type { DaySchedule } from '../../domain/types';
import { freeMinutesFrom, planningBudget } from '../../services/planner';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { Card, CardHeader } from '../../ui/Card';

/**
 * Freie Zeit ist ein eigener Zustand: Die Karte zeigt sie, schlägt Planung vor –
 * verlangt aber nicht, sie zu füllen.
 */
export function FreeTimeCard({ schedule, fromMinute, editable, onPlan }: { schedule: DaySchedule; fromMinute: number; editable: boolean; onPlan: () => void }) {
  const planning = useAppStore((s) => s.settings.planning);
  const free = freeMinutesFrom(schedule, fromMinute);
  const budget = planningBudget(schedule, planning, fromMinute);
  const awakeMin = Math.max(1, schedule.awake.end - schedule.awake.start);
  const busyMin = Math.max(0, awakeMin - schedule.totalFreeMin - schedule.scheduledTaskMin);
  const pct = (m: number) => `${Math.max(0, (m / awakeMin) * 100)}%`;

  return (
    <Card>
      <CardHeader title="Freie Zeit" icon={Hourglass} />
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular">{formatDuration(free)}</span>
        <span className="text-sm text-ink-muted">{fromMinute > 0 ? 'noch frei planbar' : 'frei'}</span>
      </div>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/5" aria-hidden>
        <div className="h-full bg-white/20" style={{ width: pct(busyMin) }} title="Feste Termine" />
        <div className="h-full bg-violet-400/80" style={{ width: pct(schedule.scheduledTaskMin) }} title="Geplante Aufgaben" />
        <div className="h-full bg-emerald-400/70" style={{ width: pct(schedule.totalFreeMin) }} title="Frei" />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <Legend color="bg-white/30" label={`Fest ${formatDuration(busyMin)}`} />
        <Legend color="bg-violet-400" label={`Aufgaben ${formatDuration(schedule.scheduledTaskMin)}`} />
        <Legend color="bg-emerald-400" label={`Frei ${formatDuration(schedule.totalFreeMin)}`} />
      </div>

      {editable && (
        <>
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-emerald-400/[0.06] px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
            <span>
              Freizeit bleibt Freizeit. Automatisch verplant wird höchstens{' '}
              <span className="font-medium text-ink">{formatDuration(budget)}</span> – mindestens {formatDuration(planning.minFreeTimeMin)} bleiben immer frei.
            </span>
          </div>
          <Button variant="secondary" icon={Sparkles} block className="mt-3" onClick={onPlan} disabled={free < planning.minSlotMin}>
            Aufgaben automatisch einplanen
          </Button>
        </>
      )}
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
