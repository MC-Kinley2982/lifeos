import { BatteryFull, BatteryLow, BatteryMedium } from 'lucide-react';
import type { EnergyLevel, TaskEnergy } from '../../domain/types';
import { TASK_ENERGY_SHORT } from '../../domain/labels';
import { cn } from '../../ui/cn';

export const ENERGY_COLORS: Record<EnergyLevel, string> = {
  1: '#f87171',
  2: '#fb923c',
  3: '#fbbf24',
  4: '#a3e635',
  5: '#34d399',
};

export function EnergyBars({ level, className, size = 'md' }: { level: EnergyLevel; className?: string; size?: 'sm' | 'md' }) {
  const heights = size === 'sm' ? [5, 7, 9, 11, 13] : [6, 9, 12, 15, 18];
  return (
    <span className={cn('inline-flex items-end gap-[3px]', className)} aria-label={`Energie ${level} von 5`}>
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[4px] rounded-full transition-colors"
          style={{ height: h, background: i < level ? ENERGY_COLORS[level] : 'rgba(255,255,255,0.12)' }}
        />
      ))}
    </span>
  );
}

const TASK_ENERGY_ICON = { low: BatteryLow, medium: BatteryMedium, high: BatteryFull } as const;
const TASK_ENERGY_COLOR: Record<TaskEnergy, string> = { low: '#34d399', medium: '#fbbf24', high: '#f472b6' };

export function TaskEnergyTag({ energy }: { energy: TaskEnergy }) {
  const Icon = TASK_ENERGY_ICON[energy];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted" title={`Energie: ${TASK_ENERGY_SHORT[energy]}`}>
      <Icon size={13} style={{ color: TASK_ENERGY_COLOR[energy] }} />
      {TASK_ENERGY_SHORT[energy]}
    </span>
  );
}
