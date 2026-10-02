import { formatHoursClock } from '../../domain/time';
import type { Goal } from '../../domain/types';
import type { GoalProgress } from '../../services/planner';
import { ProgressBar } from '../../ui/controls';

export function GoalProgressRow({ goal, progress }: { goal: Goal; progress?: GoalProgress }) {
  const target = goal.target.minutes;
  const done = progress?.doneMin ?? 0;
  const planned = progress?.plannedMin ?? 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium">{goal.title}</span>
        <span className="shrink-0 text-xs text-ink-muted tabular">
          <span className="font-semibold text-ink">{formatHoursClock(done)}</span> / {formatHoursClock(target)} h
        </span>
      </div>
      <ProgressBar value={target ? (done / target) * 100 : 0} planned={target ? (planned / target) * 100 : 0} color={goal.color} />
      {planned > 0 && <div className="mt-1 text-[11px] text-ink-faint">+ {formatHoursClock(planned)} h eingeplant</div>}
    </div>
  );
}
