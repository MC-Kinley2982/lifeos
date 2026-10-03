import { useState } from 'react';
import { ArrowRight, CircleCheck, Coffee, TriangleAlert } from 'lucide-react';
import { formatDuration, relativeDayLabel, toDateKey } from '../../domain/time';
import type { DateKey } from '../../domain/types';
import { makeFreeTime, type FreeTimeOutcome } from '../../store/schoolAutomation';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { NumberInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';

const PRESETS = [60, 120, 180];

/** "Ich brauche heute mehr Freizeit" – verlegt Geplantes auf andere Tage. */
export function MoreFreeTimeSheet({ date, freeNow, onClose }: { date: DateKey; freeNow: number; onClose: () => void }) {
  const [custom, setCustom] = useState(45);
  const [outcome, setOutcome] = useState<FreeTimeOutcome | null>(null);
  const today = toDateKey(new Date());
  const dayLabel = relativeDayLabel(date, today);

  if (outcome) {
    const gained = outcome.after - outcome.before;
    const reached = outcome.after >= outcome.target;
    const nothingPlanned = outcome.result.moved.length === 0 && outcome.result.stuck.length === 0;
    return (
      <Sheet open onClose={onClose} title="Mehr Freizeit" subtitle={dayLabel} footer={<Button variant="primary" block onClick={onClose}>Fertig</Button>}>
        <div className={cn('flex items-start gap-3 rounded-2xl p-4', reached ? 'bg-emerald-400/[0.08]' : 'bg-amber-500/[0.08]')}>
          {reached ? <CircleCheck size={20} className="mt-0.5 shrink-0 text-emerald-400" /> : <TriangleAlert size={20} className="mt-0.5 shrink-0 text-amber-300" />}
          <div className="text-sm">
            <p className="font-medium">
              Jetzt {formatDuration(outcome.after)} frei {gained > 0 && <span className="text-emerald-300">(+{formatDuration(gained)})</span>}
            </p>
            <p className="mt-0.5 text-ink-muted">
              {reached
                ? `Dein Wunsch ist erfüllt – LifeOS hält an diesem Tag mindestens ${formatDuration(outcome.target)} frei.`
                : nothingPlanned
                  ? 'An diesem Tag ist nichts geplant, was sich verschieben lässt – die restliche Zeit ist schon frei. LifeOS plant hier nichts Neues mehr ein.'
                  : `Ziel: ${formatDuration(outcome.target)}. Mehr ließ sich nicht verschieben – der Rest hat eine Deadline oder findet sonst keinen Platz.`}
            </p>
          </div>
        </div>
        {outcome.result.moved.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">Verschoben</h3>
            <div className="space-y-1.5">
              {outcome.result.moved.map((m, i) => (
                <div key={`${m.title}-${i}`} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{m.title}</span>
                  <ArrowRight size={14} className="shrink-0 text-ink-faint" />
                  <span className="shrink-0 text-xs text-ink-muted tabular">{m.to ? `${relativeDayLabel(m.to.date, today)} ${m.to.start}` : 'später'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {outcome.result.stuck.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">Bleibt an diesem Tag</h3>
            {outcome.result.stuck.map((s, i) => (
              <p key={`${s.title}-${i}`} className="text-xs text-ink-muted">
                {s.title} – {s.reason}
              </p>
            ))}
          </div>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title="Mehr Freizeit" subtitle={`${dayLabel} · gerade ${formatDuration(freeNow)} frei`}>
      <p className="mb-4 text-sm text-ink-muted">
        Wie viel mehr freie Zeit brauchst du? Geplante Aufgaben, Hausaufgaben und Lernzeiten werden – soweit vor ihrer Deadline möglich – auf andere Tage verlegt.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setOutcome(makeFreeTime(date, m))}
            className="flex h-16 flex-col items-center justify-center rounded-2xl border border-line bg-surface transition-colors hover:border-violet-400/50 hover:bg-violet-500/10"
          >
            <span className="text-lg font-semibold">+{m / 60} h</span>
            <span className="text-[11px] text-ink-faint">→ {formatDuration(freeNow + m)} frei</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Eigene Zeit</span>
          <NumberInput value={custom} min={5} step={5} suffix="min" onChange={(v) => setCustom(v)} />
        </div>
        <Button variant="primary" icon={Coffee} disabled={custom < 5} onClick={() => setOutcome(makeFreeTime(date, custom))}>
          +{formatDuration(custom)}
        </Button>
      </div>
    </Sheet>
  );
}
