import { useEffect, useState, type ReactNode } from 'react';
import { Check, Trash } from 'lucide-react';
import { orderedWeekdays, WEEKDAY_SHORT } from '../domain/time';
import type { Weekday } from '../domain/types';
import { alpha, cn } from './cn';

// ─── Schalter ────────────────────────────────────────────────

export function Toggle({ checked, onChange, label, description, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const sw = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-40',
        checked ? 'border-violet-400/40 bg-violet-500' : 'border-line-strong bg-surface-3',
      )}
    >
      <span className={cn('inline-block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-[3px]')} />
    </button>
  );
  if (!label) return sw;
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {description && <div className="text-xs text-ink-faint">{description}</div>}
      </div>
      {sw}
    </div>
  );
}

// ─── Segment-Auswahl ─────────────────────────────────────────

export function Segmented<T extends string | number>({ value, onChange, options, size = 'md', className }: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; title?: string }>;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={cn('flex rounded-xl border border-line bg-surface p-1', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-lg px-2 font-medium whitespace-nowrap transition-colors',
            size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
            o.value === value ? 'bg-surface-3 text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Wochentage ──────────────────────────────────────────────

export function WeekdayPicker({ value, onChange, weekStartsOn = 0 }: { value: Weekday[]; onChange: (v: Weekday[]) => void; weekStartsOn?: Weekday }) {
  const toggle = (d: Weekday) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
  return (
    <div className="flex gap-1.5">
      {orderedWeekdays(weekStartsOn).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => toggle(d)}
          aria-pressed={value.includes(d)}
          className={cn(
            'h-9 flex-1 rounded-xl text-xs font-semibold transition-colors',
            value.includes(d) ? 'bg-violet-500/90 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink',
          )}
        >
          {WEEKDAY_SHORT[d]}
        </button>
      ))}
    </div>
  );
}

// ─── Farben ──────────────────────────────────────────────────

export const COLOR_PRESETS = ['#a78bfa', '#818cf8', '#60a5fa', '#22d3ee', '#2dd4bf', '#34d399', '#a3e635', '#fbbf24', '#fb923c', '#f87171', '#f472b6', '#94a3b8'];

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Farbe ${c}`}
          onClick={() => onChange(c)}
          className={cn('flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-surface-2 transition', value === c && 'ring-2 ring-white/70')}
          style={{ background: c }}
        >
          {value === c && <Check size={14} className="text-black/70" />}
        </button>
      ))}
    </div>
  );
}

// ─── Kleine Anzeigen ─────────────────────────────────────────

export function Badge({ children, color, className, icon }: { children: ReactNode; color?: string; className?: string; icon?: ReactNode }) {
  return (
    <span
      className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap', !color && 'bg-white/6 text-ink-muted', className)}
      style={color ? { background: alpha(color, 0.14), color } : undefined}
    >
      {icon}
      {children}
    </span>
  );
}

export function ProgressBar({ value, planned = 0, color = '#a78bfa', className }: { value: number; planned?: number; color?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const p = Math.max(0, Math.min(100 - v, planned));
  return (
    <div className={cn('flex h-2 w-full overflow-hidden rounded-full bg-white/6', className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: color }} />
      {p > 0 && <div className="h-full transition-[width] duration-500" style={{ width: `${p}%`, background: alpha(color, 0.3) }} />}
    </div>
  );
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ background: color }} />;
}

// ─── Löschen mit Bestätigung ─────────────────────────────────

export function DeleteButton({ onConfirm, label = 'Löschen', className }: { onConfirm: () => void; label?: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors',
        armed ? 'bg-red-500 text-white' : 'text-red-300 hover:bg-red-500/10',
        className,
      )}
    >
      <Trash size={15} />
      {armed ? 'Wirklich löschen?' : label}
    </button>
  );
}

// ─── Drei-Wege-Auswahl (Standard / Aktiv / Pausiert) ─────────

export function TriState({ value, onChange, inherited }: { value: boolean | null; onChange: (v: boolean | null) => void; inherited: boolean }) {
  const opts: Array<{ v: boolean | null; label: string }> = [
    { v: null, label: `Auto (${inherited ? 'an' : 'aus'})` },
    { v: true, label: 'Aktiv' },
    { v: false, label: 'Pausiert' },
  ];
  return (
    <div className="flex shrink-0 rounded-lg border border-line bg-surface p-0.5">
      {opts.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'h-7 rounded-md px-2 text-[11px] font-medium whitespace-nowrap transition-colors',
            value === o.v
              ? o.v === false
                ? 'bg-red-500/20 text-red-200'
                : o.v === true
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-surface-3 text-ink'
              : 'text-ink-faint hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
