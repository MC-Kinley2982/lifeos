import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const INPUT =
  'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20';

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-ink-faint">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...rest} className={cn(INPUT, className)} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...rest} className={cn(INPUT, 'h-auto resize-none py-2.5', className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(INPUT, 'cursor-pointer appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a3a3b5' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
    >
      {children}
    </select>
  );
}

export function TimeInput({ value, onChange, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      step={300}
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      {...rest}
      className={cn(INPUT, 'tabular', className)}
    />
  );
}

export function DateInput({ value, onChange, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void }) {
  return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} {...rest} className={cn(INPUT, 'tabular', className)} />;
}

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}

export function NumberInput({ value, onChange, suffix, className, min, max, ...rest }: NumberInputProps) {
  return (
    <div className={cn('relative', className)}>
      <input
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value === '' || Number.isNaN(n)) return onChange(0);
          onChange(n);
        }}
        {...rest}
        className={cn(INPUT, 'tabular', suffix && 'pr-12')}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-faint">{suffix}</span>}
    </div>
  );
}
