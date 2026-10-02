import { RotateCcw, Settings } from 'lucide-react';
import { PATHS, navigate } from '../../app/router';
import { ENERGY_LABEL } from '../../domain/labels';
import type { DateKey, EnergyLevel, EnergyState } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { alpha, cn } from '../../ui/cn';
import { Sheet } from '../../ui/Sheet';
import { ENERGY_COLORS, EnergyBars } from '../shared/energy';

export function EnergySheet({ date, energy, onClose }: { date: DateKey; energy: EnergyState; onClose: () => void }) {
  const setEnergy = useAppStore((s) => s.setEnergy);
  const manual = useAppStore((s) => s.dailyStates[date]?.energy);

  const choose = (level: EnergyLevel | null) => {
    setEnergy(date, level);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="Wie viel Energie hast du?" subtitle="Ein manueller Wert gilt für den ganzen Tag und überschreibt die Schätzung.">
      <div className="space-y-2">
        {([5, 4, 3, 2, 1] as EnergyLevel[]).map((lvl) => {
          const active = manual === lvl;
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => choose(lvl)}
              className={cn('flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition-colors', active ? 'border-transparent' : 'border-line bg-surface hover:border-line-strong')}
              style={active ? { background: alpha(ENERGY_COLORS[lvl], 0.14), borderColor: alpha(ENERGY_COLORS[lvl], 0.4) } : undefined}
            >
              <EnergyBars level={lvl} />
              <span className="flex-1 text-sm font-medium">{ENERGY_LABEL[lvl]}</span>
              <span className="text-sm text-ink-muted tabular">{lvl}/5</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl bg-white/[0.03] p-3 text-sm text-ink-muted">
        {manual ? (
          <>Manuell eingestellt. Ohne manuellen Wert schätzt die App deine Energie aus Tageszeit, Aktivitäten und Pausen.</>
        ) : (
          <>
            Aktuell geschätzt: <span className="font-medium text-ink">{energy.level}/5</span> · {energy.reason}
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {manual && (
          <Button variant="secondary" size="sm" icon={RotateCcw} onClick={() => choose(null)}>
            Wieder automatisch schätzen
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={Settings}
          onClick={() => {
            onClose();
            navigate(PATHS.settings('energie'));
          }}
        >
          Energie-Regeln bearbeiten
        </Button>
      </div>
    </Sheet>
  );
}
