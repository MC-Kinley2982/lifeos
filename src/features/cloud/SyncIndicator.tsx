import { hrefFor, PATHS } from '../../app/router';
import { useCloud } from '../../store/cloud';
import { cn } from '../../ui/cn';

const LABEL = {
  synced: { dot: 'bg-emerald-400', text: 'Synchronisiert' },
  syncing: { dot: 'bg-amber-400 animate-pulse', text: 'Synchronisiere …' },
  linking: { dot: 'bg-amber-400 animate-pulse', text: 'Verbinde …' },
  offline: { dot: 'bg-red-400', text: 'Offline' },
  error: { dot: 'bg-red-400', text: 'Sync-Fehler' },
  signedOut: { dot: 'bg-white/30', text: 'Nicht angemeldet' },
  disabled: { dot: 'bg-white/30', text: 'Nur lokal' },
} as const;

/** 🟢 Synchronisiert · 🟡 Synchronisiere … · 🔴 Offline – führt zu "Konto & Sync". */
export function SyncIndicator({ className, compact }: { className?: string; compact?: boolean }) {
  const status = useCloud((s) => s.status);
  const pending = useCloud((s) => s.pending);
  const mode = useCloud((s) => s.mode);
  if (mode === 'off') return null;
  const meta = LABEL[status];
  return (
    <a
      href={hrefFor(PATHS.settings('konto'))}
      title={pending > 0 ? `${pending} Änderung(en) warten auf Upload` : meta.text}
      className={cn('inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink', className)}
    >
      <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
      {!compact && meta.text}
      {pending > 0 && status !== 'syncing' && <span className="text-ink-faint">· {pending}</span>}
    </a>
  );
}
