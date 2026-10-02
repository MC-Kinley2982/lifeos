import { useMemo } from 'react';
import { BatteryMedium, Check, Clock, Coffee, Gamepad2, Hourglass, Moon, Play, Sparkles, Target } from 'lucide-react';
import { ENERGY_LABEL } from '../../domain/labels';
import { formatDuration, minutesSinceMidnight, roundUpTo, toDateKey, toHHMM } from '../../domain/time';
import type { EnergyLevel } from '../../domain/types';
import { getPlanner } from '../../services/planner';
import type { SuggestionItem } from '../../services/planner';
import { useNow, usePlannerData } from '../../store/hooks';
import { replanSchool } from '../../store/schoolAutomation';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { ENERGY_COLORS } from '../shared/energy';

const MODE_ICON = { tasks: Sparkles, free: Gamepad2, rest: Coffee, night: Moon, short: Hourglass } as const;

export function WhatNowSheet({ onClose }: { onClose: () => void }) {
  const data = usePlannerData();
  const now = useNow(30_000);
  const today = toDateKey(now);
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const s = useMemo(() => getPlanner().suggestNow(data, now), [data, minuteKey]);
  const startsLater = s.fromMinute > minutesSinceMidnight(now) + 1;
  const { setTaskSchedule, updateTask, toggleTaskDone, applyPlan, setEnergy, addSchoolBlock, updateHomework, toggleHomeworkDone } = useAppStore.getState();
  const manualEnergy = data.dailyStates[today]?.energy;
  const ModeIcon = MODE_ICON[s.mode];

  const start = (item: SuggestionItem, offset: number) => {
    const startMin = roundUpTo(s.fromMinute, 5) + offset;
    if (item.homework || item.exam) {
      // Jetzt anfangen = manueller Block ab jetzt; die übrige automatische Planung passt sich an.
      const owner = item.homework ? ({ kind: 'homework', id: item.homework.id } as const) : ({ kind: 'exam', id: item.exam!.id } as const);
      addSchoolBlock(owner, { date: today, start: toHHMM(startMin), durationMin: item.minutes, source: 'manual', done: false });
      if (item.homework?.status === 'todo') updateHomework(item.homework.id, { status: 'in_progress' });
      replanSchool(owner.kind === 'homework' ? { homeworkIds: [owner.id], reset: true } : { examIds: [owner.id], reset: true });
      toast(`${item.title} ab ${toHHMM(startMin)} eingeplant`);
    } else if (item.task) {
      setTaskSchedule(item.task.id, { date: today, start: toHHMM(startMin) });
      if (item.task.status === 'todo') updateTask(item.task.id, { status: 'in_progress' });
      toast(`${item.title} ab ${toHHMM(startMin)} eingeplant`);
    } else if (item.goal) {
      applyPlan([
        {
          id: `now:${item.goal.id}`,
          kind: 'goal',
          goalId: item.goal.id,
          title: item.goal.title,
          date: today,
          start: startMin,
          end: startMin + item.minutes,
          energy: item.goal.energy,
          estimatedEnergy: s.energy.level,
          reasons: [],
        },
      ]);
      toast(`${item.title} ab ${toHHMM(startMin)} eingeplant`);
    }
  };

  let offset = 0;

  return (
    <Sheet open onClose={onClose} title="Was soll ich jetzt machen?">
      <div className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-indigo-500/5 p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
          <ModeIcon size={20} />
        </div>
        <p className="text-lg leading-snug font-semibold">{s.headline}</p>
        <ul className="mt-3 space-y-1.5">
          {s.lines.map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm text-ink-muted">
              {line.startsWith('Deine Energie') ? <BatteryMedium size={15} className="mt-0.5 shrink-0" /> : <Clock size={15} className="mt-0.5 shrink-0" />}
              {line}
            </li>
          ))}
        </ul>
      </div>

      {s.items.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {s.items.map((item, i) => {
            const itemOffset = offset;
            offset += item.minutes;
            return (
              <div key={item.key} className="animate-slide-up rounded-2xl border border-line bg-surface p-4" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sm font-semibold text-violet-200">
                    {item.goal ? <Target size={15} /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-sm text-ink-muted tabular">
                        {item.partial ? 'ca. ' : ''}
                        {formatDuration(item.minutes)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.reasons.map((r) => (
                        <span key={r} className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-ink-muted">
                          {r}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.mode !== 'night' && !item.blockId && !(item.task?.schedule?.start && item.task.schedule.date === today && s.currentBlock?.sourceId === item.task.id) && (
                        <Button size="sm" variant="secondary" icon={Play} onClick={() => start(item, itemOffset)}>
                          {startsLater || itemOffset > 0 ? `Ab ${toHHMM(roundUpTo(s.fromMinute, 5) + itemOffset)} einplanen` : 'Jetzt starten'}
                        </Button>
                      )}
                      {item.task && (
                        <Button size="sm" variant="ghost" icon={Check} onClick={() => { toggleTaskDone(item.task!.id); toast('Erledigt – stark!'); }}>
                          Erledigt
                        </Button>
                      )}
                      {item.homework && (
                        <Button size="sm" variant="ghost" icon={Check} onClick={() => { toggleHomeworkDone(item.homework!.id); toast('Hausaufgabe erledigt – stark!'); }}>
                          Erledigt
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {s.laterForEnergy.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">Später, wenn du fitter bist</h3>
          <div className="space-y-1.5">
            {s.laterForEnergy.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                <span className="truncate text-ink-muted">{item.title}</span>
                <span className="shrink-0 text-[11px] text-ink-faint">{item.reasons[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Stimmt deine Energie?</span>
          <span className="text-xs text-ink-faint">{manualEnergy ? 'manuell' : `geschätzt: ${s.energy.reason}`}</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {([1, 2, 3, 4, 5] as EnergyLevel[]).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setEnergy(today, lvl)}
              title={ENERGY_LABEL[lvl]}
              className={cn(
                'h-10 rounded-xl border text-sm font-semibold transition-all',
                s.energy.level === lvl ? 'border-transparent text-black' : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
              )}
              style={s.energy.level === lvl ? { background: ENERGY_COLORS[lvl] } : undefined}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
