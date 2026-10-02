import type { ReactNode } from 'react';
import { SyncIndicator } from '../features/cloud/SyncIndicator';
import { useCloud } from '../store/cloud';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../ui/cn';
import { isActive, MOBILE_NAV, NAV_ITEMS } from './navigation';
import { hrefFor, type RouteName } from './router';

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx="256" cy="256" r="150" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="56" />
      <path d="M256 106 A150 150 0 1 1 120 320" fill="none" stroke="url(#lg)" strokeWidth="56" strokeLinecap="round" />
      <circle cx="256" cy="256" r="52" fill="url(#lg)" />
    </svg>
  );
}

export function AppShell({ route, children }: { route: RouteName; children: ReactNode }) {
  const name = useAppStore((s) => s.settings.profile.name);
  const cloudOn = useCloud((s) => s.mode !== 'off');

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop-Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/40 px-4 py-6 backdrop-blur lg:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <Logo className="h-8 w-8" />
          <div>
            <div className="text-[15px] font-semibold tracking-tight">LifeOS</div>
            <div className="text-[11px] text-ink-faint">{name ? `Hallo, ${name}` : 'Personal Life Planner'}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, route);
            const Icon = item.icon;
            return (
              <a
                key={item.route}
                href={hrefFor(item.path)}
                className={cn(
                  'group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                  active ? 'bg-white/[0.07] text-ink' : 'text-ink-muted hover:bg-white/[0.04] hover:text-ink',
                )}
              >
                <Icon size={17} className={cn(active ? 'text-violet-300' : 'text-ink-faint group-hover:text-ink-muted')} />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="mt-auto px-2 text-[11px] leading-relaxed text-ink-faint">
          {cloudOn ? <SyncIndicator /> : 'Alle Daten bleiben lokal auf diesem Gerät.'}
        </div>
      </aside>

      {/* Inhalt */}
      <main className="pt-safe min-w-0 flex-1">
        {/* Mobil: schmale Leiste mit Sync-Status (nur wenn die Cloud eingerichtet ist) */}
        {cloudOn && (
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-2 backdrop-blur-xl lg:hidden">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Logo className="h-5 w-5" /> LifeOS
            </span>
            <SyncIndicator />
          </div>
        )}
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">{children}</div>
      </main>

      {/* Mobile Bottom-Navigation */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
          {MOBILE_NAV.map((item) => {
            const active = isActive(item, route);
            const Icon = item.icon;
            return (
              <a
                key={item.route}
                href={hrefFor(item.path)}
                className={cn('flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors', active ? 'text-ink' : 'text-ink-faint')}
              >
                <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-violet-500/20')}>
                  <Icon size={19} className={active ? 'text-violet-200' : ''} />
                </span>
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
