import { useMemo, useState } from 'react';
import { CalendarCheck, ShieldCheck, Target, TriangleAlert } from 'lucide-react';
import { formatDuration, relativeDayLabel, toDateKey, toHHMM } from '../../domain/time';
import type { DateKey } from '../../domain/types';
import { getPlanner } from '../../services/planner';
import type { PlanItem } from '../../services/planner';
import { useNow, usePlannerData } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { Badge, Toggle } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { TaskCheckbox } from '../tasks/TaskItem';

interface AutoPlanSheetProps {
  dates: DateKey[];
  title: string;
  defaultIncludeGoals: boolean;
  onClose: () => void;
}

/**
 * Zeigt den Vorschlag der Auto-Planung. Nichts wird ungefragt übernommen –
 * einzelne Vorschläge lassen sich abwählen.
 */
export function AutoPlanSheet({ dates, title, defaultIncludeGoals, onClose }: AutoPlanSheetProps) {
  const data = usePlannerData();
  const now = useNow(60_000);
  const applyPlan = useAppStore((s) => s.applyPlan);
  const [includeGoals, setIncludeGoals] = useState(defaultIncludeGoals);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const today = toDateKey(now);
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const dateKey = dates.join(',');

  const result = useMemo(
    () => getPlanner().plan(data, { dates, now, includeGoals }),
    [data, dateKey, includeGoals, minuteKey],
  );

  const selected = result.items.filter((i) => !excluded.has(i.id));
  const selectedMin = selected.reduce((sum, i) => sum + (i.end - i.start), 0);
  const freeMin = result.days.reduce((sum, d) => sum + d.freeMin, 0);
  const budgetMin = result.days.reduce((sum, d) => sum + d.budgetMin, 0);
  const openTasks = data.tasks.filter((t) => t.status !== 'done').length;

  const byDate = useMemo(() => {
    const map = new Map<DateKey, PlanItem[]>();
    for (const item of result.items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return [...map.entries()];
  }, [result.items]);

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = () => {
    applyPlan(selected);
    toast(`${selected.length} ${selected.length === 1 ? 'Block' : 'Blöcke'} eingeplant`);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      subtitle="Regelbasierter Vorschlag – du entscheidest, was übernommen wird."
      size="lg"
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck size={15} className="text-emerald-400" />
            Danach bleiben {formatDuration(Math.max(0, freeMin - selectedMin))} Freizeit
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button variant="primary" icon={CalendarCheck} onClick={apply} disabled={selected.length === 0}>
              Übernehmen ({selected.length})
            </Button>
          </div>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Frei" value={formatDuration(freeMin)} />
        <Stat label="Max. verplanbar" value={formatDuration(budgetMin)} hint="Freizeit-Schutz" />
        <Stat label="Vorschlag" value={formatDuration(selectedMin)} accent />
      </div>

      {data.goals.some((g) => g.active) && (
        <div className="mb-4 rounded-2xl border border-line bg-surface px-3 py-1">
          <Toggle checked={includeGoals} onChange={setIncludeGoals} label="Wochenziele mit einplanen" description="Füllt offene Ziel-Zeit mit Einheiten auf." />
        </div>
      )}

      {result.items.length === 0 && result.unplanned.length === 0 && (
        <EmptyState
          icon={CalendarCheck}
          title={openTasks === 0 ? 'Keine offenen Aufgaben' : 'Nichts zu planen'}
          text={openTasks === 0 ? 'Lege Aufgaben an – dann kann ich sie in deine freie Zeit verteilen.' : 'Alle offenen Aufgaben haben bereits einen festen Platz oder gehören zu anderen Tagen.'}
        />
      )}

      <div className="space-y-5">
        {byDate.map(([date, items]) => (
          <section key={date}>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">{relativeDayLabel(date, today)}</h3>
            <div className="space-y-2">
              {items.map((item) => {
                const off = excluded.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={cn('flex gap-3 rounded-2xl border border-line bg-surface p-3 transition-opacity', off && 'opacity-45')}
                  >
                    <div className="pt-0.5">
                      <TaskCheckbox done={!off} onToggle={() => toggle(item.id)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-violet-200 tabular">
                          {toHHMM(item.start)}–{toHHMM(item.end)}
                        </span>
                        <span className="text-sm font-medium">{item.title}</span>
                        {item.kind === 'goal' && <Badge color="#f472b6" icon={<Target size={11} />}>Ziel-Einheit</Badge>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {item.reasons.map((r) => (
                          <span key={r} className={cn('rounded-md px-1.5 py-0.5 text-[11px]', r.startsWith('Energie evtl.') ? 'bg-amber-500/10 text-amber-300' : 'bg-white/5 text-ink-muted')}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {result.unplanned.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">Nicht eingeplant</h3>
            <div className="space-y-1.5">
              {result.unplanned.map((u) => (
                <div key={(u.taskId ?? u.goalId) + u.title} className="flex gap-2.5 rounded-xl bg-amber-500/[0.06] px-3 py-2 text-sm">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-300" />
                  <div>
                    <span className="font-medium">{u.title}</span>
                    <span className="block text-xs text-ink-muted">{u.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Sheet>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-2xl border px-3 py-2.5', accent ? 'border-violet-400/30 bg-violet-500/10' : 'border-line bg-surface')}>
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular">{value}</div>
      {hint && <div className="text-[10px] text-ink-faint">{hint}</div>}
    </div>
  );
}
