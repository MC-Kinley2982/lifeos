import type { ComponentType } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { hrefFor, PATHS } from '../../app/router';
import { PageHeader } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { CategoriesSection } from './sections/CategoriesSection';
import { DataSection } from './sections/DataSection';
import { DayStatesSection } from './sections/DayStatesSection';
import { BreaksSection } from './sections/BreaksSection';
import { EnergySection } from './sections/EnergySection';
import { MealsSection } from './sections/MealsSection';
import { PlanningSection } from './sections/PlanningSection';
import { ProfileSection } from './sections/ProfileSection';
import { SleepSection } from './sections/SleepSection';
import { VacationSection } from './sections/VacationSection';
import { SETTINGS_SECTIONS } from './sections';

const CONTENT: Record<string, ComponentType> = {
  profil: ProfileSection,
  schlaf: SleepSection,
  mahlzeiten: MealsSection,
  pausen: BreaksSection,
  energie: EnergySection,
  zustaende: DayStatesSection,
  urlaub: VacationSection,
  planung: PlanningSection,
  kategorien: CategoriesSection,
  daten: DataSection,
};

export function SettingsPage({ section }: { section?: string }) {
  const active = SETTINGS_SECTIONS.find((s) => s.id === section);
  const Content = active ? CONTENT[active.id] : undefined;

  return (
    <div className="animate-fade-in">
      {/* Mobil: Übersicht oder einzelner Bereich */}
      <div className="lg:hidden">
        {active && Content ? (
          <>
            <a href={hrefFor(PATHS.settings())} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
              <ChevronLeft size={16} /> Mein Alltag
            </a>
            <PageHeader title={active.label} subtitle={active.description} />
            <Content />
          </>
        ) : (
          <>
            <PageHeader title="Mein Alltag" subtitle="Alles, was die Planung über deinen Alltag wissen muss." />
            <div className="overflow-hidden rounded-3xl border border-line bg-surface/80">
              {SETTINGS_SECTIONS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <a key={s.id} href={hrefFor(PATHS.settings(s.id))} className={cn('flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03]', i > 0 && 'border-t border-line')}>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3 text-ink-muted">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="block truncate text-xs text-ink-faint">{s.description}</span>
                    </span>
                    <ChevronRight size={16} className="text-ink-faint" />
                  </a>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Desktop: Navigation links, Inhalt rechts */}
      <div className="hidden lg:block">
        <PageHeader title="Mein Alltag" subtitle="Alles, was die Planung über deinen Alltag wissen muss – nichts ist fest eingebaut." />
        <div className="grid grid-cols-[230px_minmax(0,1fr)] gap-8">
          <nav className="sticky top-10 flex h-fit flex-col gap-0.5">
            {SETTINGS_SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = (active?.id ?? 'profil') === s.id;
              return (
                <a
                  key={s.id}
                  href={hrefFor(PATHS.settings(s.id))}
                  className={cn('flex h-9 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors', isActive ? 'bg-white/[0.07] text-ink' : 'text-ink-muted hover:bg-white/[0.04] hover:text-ink')}
                >
                  <Icon size={15} className={isActive ? 'text-violet-300' : 'text-ink-faint'} />
                  {s.label}
                </a>
              );
            })}
          </nav>
          <div className="min-w-0">{(() => { const C = CONTENT[active?.id ?? 'profil']; return <C />; })()}</div>
        </div>
      </div>
    </div>
  );
}
