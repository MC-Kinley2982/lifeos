import { useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Hourglass, Sparkles, Target } from 'lucide-react';
import { PATHS, navigate } from '../../app/router';
import { addDays, formatDuration, minutesSinceMidnight, parseDateKey, toDateKey, weekDays } from '../../domain/time';
import { freeMinutesFrom } from '../../services/planner';
import { useGoalProgress, useNow, useWeekSchedules } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Button, IconButton } from '../../ui/Button';
import { Card, PageHeader } from '../../ui/Card';
import { GoalProgressRow } from '../goals/GoalProgressRow';
import { AutoPlanSheet } from '../planning/AutoPlanSheet';
import { WeekGrid } from './WeekGrid';
import { WeekList } from './WeekList';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoWeek(key: string): number {
  const d = parseDateKey(key);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

export function WeekPage({ dateParam }: { dateParam?: string }) {
  const now = useNow();
  const today = toDateKey(now);
  const nowMin = minutesSinceMidnight(now);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const anchor = dateParam && DATE_RE.test(dateParam) ? dateParam : today;
  const dates = weekDays(anchor, weekStartsOn);
  const schedules = useWeekSchedules(dates);
  const progress = useGoalProgress(anchor, now);
  const allGoals = useAppStore((s) => s.goals);
  const goals = useMemo(() => allGoals.filter((g) => g.active), [allGoals]);
  const [planning, setPlanning] = useState(false);

  const isCurrentWeek = dates.includes(today);
  const futureDates = dates.filter((d) => d >= today);
  const remainingFree = schedules.reduce((sum, s) => {
    if (s.date < today) return sum;
    return sum + (s.date === today ? freeMinutesFrom(s, nowMin) : s.totalFreeMin);
  }, 0);
  const totalFree = schedules.reduce((sum, s) => sum + s.totalFreeMin, 0);
  const fixedCount = schedules.reduce((sum, s) => sum + s.blocks.filter((b) => b.kind === 'routine' || b.kind === 'event').length, 0);

  const rangeLabel = `${parseDateKey(dates[0]).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${parseDateKey(dates[6]).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Woche"
        subtitle={`KW ${isoWeek(dates[0])} · ${rangeLabel}`}
        actions={
          <>
            <IconButton icon={ChevronLeft} label="Vorherige Woche" variant="secondary" onClick={() => navigate(PATHS.week(addDays(dates[0], -7)))} />
            {!isCurrentWeek && (
              <Button variant="secondary" onClick={() => navigate(PATHS.week())}>
                Diese Woche
              </Button>
            )}
            <IconButton icon={ChevronRight} label="Nächste Woche" variant="secondary" onClick={() => navigate(PATHS.week(addDays(dates[0], 7)))} />
            <Button variant="primary" icon={Sparkles} onClick={() => setPlanning(true)} disabled={futureDates.length === 0}>
              Woche planen
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 !p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
            <Hourglass size={18} />
          </span>
          <div>
            <div className="text-xs text-ink-muted">{isCurrentWeek ? 'Noch frei diese Woche' : 'Frei in dieser Woche'}</div>
            <div className="text-lg font-semibold tabular">{formatDuration(isCurrentWeek ? remainingFree : totalFree)}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 !p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
            <CalendarRange size={18} />
          </span>
          <div>
            <div className="text-xs text-ink-muted">Routinen & Termine</div>
            <div className="text-lg font-semibold tabular">{fixedCount}</div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-ink-muted">
            <Target size={14} /> Ziele
          </div>
          {goals.length === 0 ? (
            <div className="text-sm text-ink-faint">Keine aktiven Ziele</div>
          ) : (
            <div className="space-y-3">
              {goals.slice(0, 2).map((g) => (
                <GoalProgressRow key={g.id} goal={g} progress={progress[g.id]} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="hidden md:block">
        <WeekGrid schedules={schedules} today={today} nowMin={nowMin} />
      </div>
      <div className="md:hidden">
        <WeekList schedules={schedules} today={today} />
      </div>

      {planning && <AutoPlanSheet dates={futureDates} title="Woche planen" defaultIncludeGoals onClose={() => setPlanning(false)} />}
    </div>
  );
}
