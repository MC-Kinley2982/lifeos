import { useMemo, useState } from 'react';
import { ChevronRight, Sparkles, Target } from 'lucide-react';
import { hrefFor, PATHS } from '../../app/router';
import { formatDateShort, minutesSinceMidnight, toDateKey } from '../../domain/time';
import type { DateKey, Task } from '../../domain/types';
import { useDaySchedule, useEnergy, useGoalProgress, useNow } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Card, CardHeader } from '../../ui/Card';
import { alpha } from '../../ui/cn';
import { DynamicIcon } from '../../ui/icons';
import { GoalProgressRow } from '../goals/GoalProgressRow';
import { AutoPlanSheet } from '../planning/AutoPlanSheet';
import { TaskForm } from '../tasks/TaskForm';
import { DayHeader } from './DayHeader';
import { DayStateSheet } from './DayStateSheet';
import { EnergySheet } from './EnergySheet';
import { FreeTimeCard } from './FreeTimeCard';
import { Timeline } from './Timeline';
import { TodayTasks } from './TodayTasks';
import { WhatNowSheet } from './WhatNowSheet';

type SheetKind = 'now' | 'plan' | 'state' | 'energy' | null;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function TodayPage({ dateParam }: { dateParam?: string }) {
  const now = useNow();
  const today = toDateKey(now);
  const date: DateKey = dateParam && DATE_RE.test(dateParam) ? dateParam : today;
  const isToday = date === today;
  const nowMin = minutesSinceMidnight(now);

  const schedule = useDaySchedule(date);
  const energy = useEnergy(date, now);
  const allGoals = useAppStore((s) => s.goals);
  const goals = useMemo(() => allGoals.filter((g) => g.active), [allGoals]);
  const progress = useGoalProgress(date, now);
  const vacation = useAppStore((s) => s.vacations.find((v) => v.startDate <= date && date <= v.endDate));

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [editing, setEditing] = useState<Task | null>(null);

  const fromMinute = isToday ? nowMin : 0;
  const freeMin = schedule.freeSlots.reduce((sum, s) => sum + Math.max(0, s.end - Math.max(s.start, fromMinute)), 0);
  const state = schedule.dayState;
  const showBanner = state.origin !== 'default' && !state.definition.builtIn;

  return (
    <div className="animate-fade-in">
      <DayHeader
        date={date}
        today={today}
        now={now}
        schedule={schedule}
        energy={energy}
        freeMin={date < today ? 0 : freeMin}
        onOpenState={() => setSheet('state')}
        onOpenEnergy={() => setSheet('energy')}
      />

      {showBanner && (
        <div
          className="mb-5 flex animate-slide-up items-start gap-3 rounded-3xl border p-4"
          style={{ background: alpha(state.definition.color, 0.1), borderColor: alpha(state.definition.color, 0.3) }}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: alpha(state.definition.color, 0.18) }}>
            <DynamicIcon name={state.definition.icon} size={20} color={state.definition.color} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold" style={{ color: state.definition.color }}>
              {state.definition.name}
              {state.label ? ` · ${state.label}` : ''}
              {state.origin === 'vacation' && vacation ? ` (${formatDateShort(vacation.startDate)}–${formatDateShort(vacation.endDate)})` : ''}
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {state.definition.message ?? 'Für diesen Tag gelten besondere Regeln.'}
              {schedule.inactive.length > 0 && ` Pausiert: ${[...new Set(schedule.inactive.map((i) => i.title))].join(', ')}.`}
            </p>
          </div>
        </div>
      )}

      {isToday && (
        <button
          type="button"
          onClick={() => setSheet('now')}
          className="group relative mb-6 flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500 via-violet-600 to-indigo-600 p-4 text-left shadow-xl shadow-violet-950/40 transition-transform active:scale-[0.99] sm:p-5"
        >
          <span className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:h-12 sm:w-12">
            <Sparkles size={22} className="text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-white sm:text-lg">Was soll ich jetzt machen?</span>
            <span className="block text-xs text-white/75 sm:text-sm">Vorschlag aus Zeit, Energie, Deadlines und Prioritäten</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:items-start">
        <div className="order-2 lg:order-none lg:row-span-3">
          <Timeline schedule={schedule} date={date} today={today} nowMin={nowMin} onPlan={() => setSheet('plan')} onOpenTask={setEditing} />
        </div>
        <div className="order-1 lg:order-none">
          <TodayTasks date={date} today={today} onOpenTask={setEditing} />
        </div>
        <div className="order-3 lg:order-none">
          <FreeTimeCard schedule={schedule} fromMinute={fromMinute} editable={date >= today} onPlan={() => setSheet('plan')} />
        </div>
        <div className="order-4 lg:order-none">
          <Card>
            <CardHeader
              title="Ziele diese Woche"
              icon={Target}
              action={
                <a href={hrefFor(PATHS.goals)} className="text-xs text-violet-300 hover:underline">
                  Alle
                </a>
              }
            />
            {goals.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Noch keine Ziele. <a href={hrefFor(PATHS.goals)} className="text-violet-300 hover:underline">Ziel anlegen</a>, z. B. „3 h Blender pro Woche“.
              </p>
            ) : (
              <div className="space-y-4">
                {goals.map((g) => (
                  <GoalProgressRow key={g.id} goal={g} progress={progress[g.id]} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {sheet === 'now' && <WhatNowSheet onClose={() => setSheet(null)} />}
      {sheet === 'plan' && <AutoPlanSheet dates={[date]} title="Tag automatisch planen" defaultIncludeGoals={false} onClose={() => setSheet(null)} />}
      {sheet === 'state' && <DayStateSheet date={date} onClose={() => setSheet(null)} />}
      {sheet === 'energy' && <EnergySheet date={date} energy={energy} onClose={() => setSheet(null)} />}
      {editing && <TaskForm task={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
