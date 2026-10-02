import { useState } from 'react';
import { Pencil, Plus, Sparkles, Target, X } from 'lucide-react';
import { formatDateShort, formatDuration, formatHoursClock, toDateKey, weekDays } from '../../domain/time';
import type { Goal } from '../../domain/types';
import { useGoalProgress, useNow } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Button, IconButton } from '../../ui/Button';
import { Card, EmptyState, PageHeader } from '../../ui/Card';
import { alpha, cn } from '../../ui/cn';
import { ProgressBar } from '../../ui/controls';
import { toast } from '../../ui/toast';
import { AutoPlanSheet } from '../planning/AutoPlanSheet';
import { GoalForm } from './GoalForm';

export function GoalsPage() {
  const now = useNow();
  const today = toDateKey(now);
  const goals = useAppStore((s) => s.goals);
  const tasks = useAppStore((s) => s.tasks);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const progress = useGoalProgress(today, now);
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [planning, setPlanning] = useState(false);
  const week = weekDays(today, weekStartsOn);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Ziele"
        subtitle={`Woche ${formatDateShort(week[0])} – ${formatDateShort(week[6])}`}
        actions={
          <>
            <Button variant="secondary" icon={Sparkles} onClick={() => setPlanning(true)} disabled={!goals.some((g) => g.active)}>
              In die Woche einplanen
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              Neues Ziel
            </Button>
          </>
        }
      />

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Noch keine Ziele"
            text="Zum Beispiel: „Blender verbessern – 3 Stunden pro Woche“. Die App zeigt deinen Fortschritt und findet freie Zeit dafür."
            action={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Ziel anlegen</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const p = progress[goal.id];
            const linked = tasks.filter((t) => t.goalId === goal.id && t.status !== 'done').length;
            return (
              <GoalCard key={goal.id} goal={goal} done={p?.doneMin ?? 0} planned={p?.plannedMin ?? 0} openTasks={linked} today={today} week={week} onEdit={() => setEditing(goal)} />
            );
          })}
        </div>
      )}

      {editing && <GoalForm goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {planning && <AutoPlanSheet dates={week.filter((d) => d >= today)} title="Ziele in die Woche einplanen" defaultIncludeGoals onClose={() => setPlanning(false)} />}
    </div>
  );
}

interface GoalCardProps {
  goal: Goal;
  done: number;
  planned: number;
  openTasks: number;
  today: string;
  week: string[];
  onEdit: () => void;
}

function GoalCard({ goal, done, planned, openTasks, today, week, onEdit }: GoalCardProps) {
  const { logGoalTime, removeGoalLog } = useAppStore.getState();
  const target = goal.target.minutes;
  const pct = target ? Math.round((done / target) * 100) : 0;
  const weekLog = goal.log.filter((l) => l.date >= week[0] && l.date <= week[6]);

  return (
    <Card className={cn(!goal.active && 'opacity-50')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: alpha(goal.color, 0.15), color: goal.color }}>
            <Target size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{goal.title}</h3>
            <p className="text-xs text-ink-muted">
              {formatDuration(target)} pro Woche · Einheiten à {formatDuration(goal.sessionMin)}
              {!goal.active && ' · inaktiv'}
            </p>
          </div>
        </div>
        <IconButton icon={Pencil} label="Ziel bearbeiten" size="sm" onClick={onEdit} />
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <span className="text-2xl font-semibold tabular">
          {formatHoursClock(done)} <span className="text-base font-normal text-ink-muted">/ {formatHoursClock(target)} h</span>
        </span>
        <span className="text-sm font-medium tabular" style={{ color: goal.color }}>{pct} %</span>
      </div>
      <ProgressBar className="mt-2 h-2.5" value={target ? (done / target) * 100 : 0} planned={target ? (planned / target) * 100 : 0} color={goal.color} />
      <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-muted">
        {planned > 0 && <span>+ {formatHoursClock(planned)} h eingeplant</span>}
        <span>noch {formatHoursClock(Math.max(0, target - done - planned))} h offen</span>
        {openTasks > 0 && <span>{openTasks} offene Aufgabe{openTasks > 1 ? 'n' : ''}</span>}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <p className="mb-2 text-xs text-ink-muted">Zeit eintragen (heute)</p>
        <div className="flex flex-wrap gap-2">
          {[15, 30, 60].map((m) => (
            <Button key={m} size="sm" variant="secondary" onClick={() => { logGoalTime(goal.id, m, today); toast(`+${formatDuration(m)} für ${goal.title}`); }}>
              +{formatDuration(m)}
            </Button>
          ))}
        </div>
        {weekLog.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {weekLog.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1 rounded-full bg-white/5 py-0.5 pr-1 pl-2.5 text-[11px] text-ink-muted">
                {formatDateShort(l.date)} · {formatDuration(l.minutes)}
                <button type="button" aria-label="Eintrag entfernen" onClick={() => removeGoalLog(goal.id, l.id)} className="rounded-full p-0.5 hover:bg-white/10">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
