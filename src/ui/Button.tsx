import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  block?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-900/30 hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-3 text-ink hover:bg-white/10 border border-line',
  outline: 'border border-line-strong text-ink hover:bg-white/5',
  ghost: 'text-ink-muted hover:text-ink hover:bg-white/5',
  danger: 'bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/20',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2.5 rounded-2xl',
};

export function Button({ variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, block, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium whitespace-nowrap transition-all duration-150 disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} className="shrink-0" />}
      {children}
      {IconRight && <IconRight size={size === 'sm' ? 14 : 16} className="shrink-0" />}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'secondary';
}

export function IconButton({ icon: Icon, label, size = 'md', variant = 'ghost', className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        variant === 'ghost' ? 'text-ink-muted hover:bg-white/5 hover:text-ink' : 'border border-line bg-surface-3 text-ink hover:bg-white/10',
        className,
      )}
    >
      <Icon size={size === 'sm' ? 15 : 18} />
    </button>
  );
}
