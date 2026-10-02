import { Check, Settings } from 'lucide-react';
import { PATHS, navigate } from '../../app/router';
import { mealSource, routineSource } from '../../domain/sources';
import { formatDateShort, getWeekday, isDateInRange } from '../../domain/time';
import type { DateKey, DayStateDefinition } from '../../domain/types';
import { isSourceActive, resolveDayState } from '../../services/planner';
import { usePlannerData } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { alpha, cn } from '../../ui/cn';
import { DynamicIcon } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';

/** Tageszustand wählen (Normal, Krank, Urlaub …) – mit Vorschau, was pausiert wird. */
export function DayStateSheet({ date, onClose }: { date: DateKey; onClose: () => void }) {
  const data = usePlannerData();
  const setDayState = useAppStore((s) => s.setDayState);
  const manualId = data.dailyStates[date]?.stateId;
  const automatic = resolveDayState({ ...data, dailyStates: { ...data.dailyStates, [date]: { date, skippedSources: [] } } }, date);
  const weekday = getWeekday(date);

  const pausedFor = (state: DayStateDefinition): string[] => {
    const names: string[] = [];
    for (const r of data.routines) {
      if (!r.enabled || !r.weekdays.includes(weekday) || !isDateInRange(date, r.validFrom, r.validUntil)) continue;
      if (!isSourceActive(state, routineSource(r.id), r.categoryId)) names.push(r.name);
    }
    for (const m of data.settings.meals) {
      if (m.enabled && m.weekdays.includes(weekday) && !isSourceActive(state, mealSource(m.id))) names.push(m.name);
    }
    if (data.settings.sleep.enabled && !isSourceActive(state, 'sleep')) names.push('Schlaf');
    return names;
  };

  const choose = (id: string | null) => {
    setDayState(date, id);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="Wie ist der Tag?" subtitle={`Zustand für ${formatDateShort(date)} – beeinflusst, welche Routinen gelten.`}>
      <div className="space-y-2">
        <Option
          active={!manualId}
          onClick={() => choose(null)}
          color={automatic.definition.color}
          icon={automatic.definition.icon}
          title={`Automatisch · ${automatic.definition.name}`}
          sub={automatic.label ? `aus „${automatic.label}“` : 'Standard, Urlaub oder besonderer Tag'}
        />
        {data.settings.dayStates.map((state) => {
          const paused = pausedFor(state);
          return (
            <Option
              key={state.id}
              active={manualId === state.id}
              onClick={() => choose(state.id)}
              color={state.color}
              icon={state.icon}
              title={state.name}
              sub={paused.length ? `Pausiert: ${paused.join(', ')}` : 'Alles wie geplant'}
            />
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={Settings}
        className="mt-4"
        onClick={() => {
          onClose();
          navigate(PATHS.settings('zustaende'));
        }}
      >
        Zustände & Regeln bearbeiten
      </Button>
    </Sheet>
  );
}

function Option({ active, onClick, color, icon, title, sub }: { active: boolean; onClick: () => void; color: string; icon: string; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors', active ? 'border-transparent' : 'border-line bg-surface hover:border-line-strong')}
      style={active ? { background: alpha(color, 0.14), borderColor: alpha(color, 0.35) } : undefined}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: alpha(color, 0.16) }}>
        <DynamicIcon name={icon} size={17} color={color} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-ink-muted">{sub}</span>
      </span>
      {active && <Check size={17} style={{ color }} />}
    </button>
  );
}
