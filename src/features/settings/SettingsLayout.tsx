import type { ReactNode } from 'react';
import { cn } from '../../ui/cn';

/** Abschnitt innerhalb einer Einstellungsseite. */
export function SettingsGroup({ title, description, children, action, className }: { title: string; description?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-3xl border border-line bg-surface/80 p-4 sm:p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Zeile: Beschriftung links, Steuerelement rechts (mobil untereinander). */
export function SettingRow({ label, description, children }: { label: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {description && <div className="text-xs text-ink-faint">{description}</div>}
      </div>
      <div className="shrink-0 sm:w-56">{children}</div>
    </div>
  );
}

/** Kleiner Kasten für Listeneinträge (Mahlzeit, Regel …). */
export function ItemBox({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <div className={cn('rounded-2xl border border-line bg-surface-2/60 p-3 sm:p-4', muted && 'opacity-55')}>{children}</div>;
}
