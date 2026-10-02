import { ChevronRight } from 'lucide-react';
import { hrefFor } from '../../app/router';
import { NAV_ITEMS } from '../../app/navigation';
import { PageHeader } from '../../ui/Card';
import { cn } from '../../ui/cn';

/** Mobile "Mehr"-Seite für Bereiche, die nicht in der Bottom-Navigation sind. */
export function MorePage() {
  const items = NAV_ITEMS.filter((i) => ['events', 'routines', 'settings'].includes(i.route));
  return (
    <div className="animate-fade-in">
      <PageHeader title="Mehr" />
      <div className="overflow-hidden rounded-3xl border border-line bg-surface/80">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <a key={item.route} href={hrefFor(item.path)} className={cn('flex items-center gap-3 px-4 py-4 hover:bg-white/[0.03]', i > 0 && 'border-t border-line')}>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3 text-violet-200">
                <Icon size={17} />
              </span>
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              <ChevronRight size={16} className="text-ink-faint" />
            </a>
          );
        })}
      </div>
      <p className="mt-6 px-2 text-xs leading-relaxed text-ink-faint">
        LifeOS V1 · Alle Daten werden lokal auf diesem Gerät gespeichert. Tipp: In Safari über „Teilen → Zum Home-Bildschirm“ als App installieren.
      </p>
    </div>
  );
}
