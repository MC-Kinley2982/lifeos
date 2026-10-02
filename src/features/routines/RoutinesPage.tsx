import { useMemo, useState } from 'react';
import { Car, Moon, Plus, Repeat, Utensils } from 'lucide-react';
import { hrefFor, PATHS } from '../../app/router';
import { formatDuration, orderedWeekdays, toMinutes, WEEKDAY_SHORT } from '../../domain/time';
import type { Routine } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { Card, CardHeader, EmptyState, PageHeader } from '../../ui/Card';
import { alpha, cn } from '../../ui/cn';
import { Toggle } from '../../ui/controls';
import { formatWeekdays } from '../shared/format';
import { RoutineForm } from './RoutineForm';

export function RoutinesPage() {
  const routines = useAppStore((s) => s.routines);
  const categories = useAppStore((s) => s.settings.categories);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const updateRoutine = useAppStore((s) => s.updateRoutine);
  const [editing, setEditing] = useState<Routine | 'new' | null>(null);

  const sorted = useMemo(() => [...routines].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name)), [routines]);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Routinen & Wochenplan"
        subtitle="Wiederkehrende Aktivitäten – daraus berechnet die App deine freie Zeit."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
            Neue Routine
          </Button>
        }
      />

      {routines.length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Wochenübersicht" icon={Repeat} />
          <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
            <div className="grid min-w-[680px] grid-cols-7 gap-2">
              {orderedWeekdays(weekStartsOn).map((d) => {
                const list = sorted.filter((r) => r.enabled && r.weekdays.includes(d));
                return (
                  <div key={d} className="min-w-0">
                    <div className="mb-2 text-center text-xs font-semibold text-ink-muted">{WEEKDAY_SHORT[d]}</div>
                    <div className="space-y-1.5">
                      {list.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setEditing(r)}
                          className="block w-full rounded-lg px-2 py-1.5 text-left transition-all hover:brightness-125"
                          style={{ background: alpha(r.color, 0.14), borderLeft: `2px solid ${r.color}` }}
                        >
                          <div className="truncate text-[11px] font-medium">{r.name}</div>
                          <div className="text-[10px] text-ink-muted tabular">{r.start}–{r.end}</div>
                        </button>
                      ))}
                      {list.length === 0 && <div className="rounded-lg border border-dashed border-line py-3 text-center text-[10px] text-ink-faint">frei</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <Card>
        {routines.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Noch keine Routinen"
            text="Lege Schule, Training, AGs oder andere feste Termine an. Beispiel: Fußballtraining · Di, Do · 17:00–19:00."
            action={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Routine anlegen</Button>}
          />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {sorted.map((r) => (
              <div key={r.id} className={cn('flex items-center gap-3 py-3', !r.enabled && 'opacity-50')}>
                <button type="button" onClick={() => setEditing(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="flex flex-wrap gap-x-3 text-xs text-ink-muted">
                      <span>{formatWeekdays(r.weekdays)}</span>
                      <span className="tabular">{r.start}–{r.end} · {formatDuration(toMinutes(r.end) - toMinutes(r.start))}</span>
                      <span>{catName(r.categoryId)}</span>
                      {(r.travelBeforeMin > 0 || r.travelAfterMin > 0) && (
                        <span className="inline-flex items-center gap-1">
                          <Car size={11} /> {r.travelBeforeMin}/{r.travelAfterMin} min
                        </span>
                      )}
                      {!r.blocksFreeTime && <span>flexibel</span>}
                    </span>
                  </span>
                </button>
                <Toggle checked={r.enabled} onChange={(v) => updateRoutine(r.id, { enabled: v })} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <a href={hrefFor(PATHS.settings('schlaf'))} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-ink-muted hover:text-ink">
          <Moon size={13} /> Schlafenszeiten einstellen
        </a>
        <a href={hrefFor(PATHS.settings('mahlzeiten'))} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-ink-muted hover:text-ink">
          <Utensils size={13} /> Mahlzeiten einstellen
        </a>
      </div>

      {editing && <RoutineForm routine={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
