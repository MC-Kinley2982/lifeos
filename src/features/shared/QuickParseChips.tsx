import { useMemo, useState } from 'react';
import { CalendarDays, Clock, Flag, Repeat, RotateCcw, Sun, Timer, X, type LucideIcon } from 'lucide-react';
import type { DateKey } from '../../domain/types';
import { parseQuickAdd, type QuickParse, type QuickTokenKind } from '../../services/nlp/quickAdd';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../ui/cn';

const ICON: Record<QuickTokenKind, LucideIcon> = {
  date: CalendarDays,
  time: Clock,
  duration: Timer,
  priority: Flag,
  repeat: Repeat,
  timeOfDay: Sun,
};

const KIND_LABEL: Record<QuickTokenKind, string> = {
  date: 'Datum',
  time: 'Uhrzeit',
  duration: 'Dauer',
  priority: 'Wichtigkeit',
  repeat: 'Wiederholung',
  timeOfDay: 'Tageszeit',
};

const ALL_KINDS: QuickTokenKind[] = ['date', 'time', 'duration', 'priority', 'repeat', 'timeOfDay'];

/**
 * Texterkennung für ein Eingabefeld: liefert das Ergebnis und merkt sich, welche Erkennungen
 * der Nutzer abgewählt hat (dann bleibt der Text im Titel). `kinds` begrenzt, was erkannt wird.
 */
export function useQuickParse(text: string, today: DateKey, kinds: QuickTokenKind[] = ALL_KINDS) {
  const smart = useAppStore((s) => s.settings.ui.smartQuickAdd);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const [ignored, setIgnored] = useState<QuickTokenKind[]>([]);
  const kindsKey = kinds.join();

  const parse = useMemo<QuickParse | null>(() => {
    if (!smart || !text.trim()) return null;
    const ignore = [...ignored, ...ALL_KINDS.filter((k) => !kinds.includes(k))];
    const result = parseQuickAdd(text, { today, weekStartsOn, ignore });
    return result.chips.length ? result : null;
    // kinds über kindsKey – ein neues Array pro Render soll nicht neu rechnen.
  }, [smart, text, today, weekStartsOn, ignored, kindsKey]);

  return {
    parse,
    ignored,
    toggle: (kind: QuickTokenKind) => setIgnored((list) => (list.includes(kind) ? list.filter((k) => k !== kind) : [...list, kind])),
    reset: () => setIgnored([]),
  };
}

/** Vorschau unter dem Eingabefeld: "Erkannt: Morgen · 17:00 · 45 min" – antippen = nicht erkennen. */
export function QuickParseChips({ parse, ignored, onToggle, className }: { parse: QuickParse | null; ignored: QuickTokenKind[]; onToggle: (kind: QuickTokenKind) => void; className?: string }) {
  if (!parse && ignored.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} aria-live="polite">
      {parse && <span className="text-[11px] text-ink-faint">Erkannt:</span>}
      {parse?.chips.map((chip) => {
        const Icon = ICON[chip.kind];
        return (
          <button
            key={chip.kind}
            type="button"
            onClick={() => onToggle(chip.kind)}
            title={`${KIND_LABEL[chip.kind]} nicht erkennen – Text bleibt im Titel`}
            aria-label={`${KIND_LABEL[chip.kind]} „${chip.label}“ nicht erkennen`}
            className="group inline-flex h-7 items-center gap-1 rounded-full bg-violet-500/15 pr-1.5 pl-2.5 text-xs font-medium text-violet-100 transition-colors hover:bg-violet-500/25"
          >
            <Icon size={12} className="text-violet-300" />
            {chip.label}
            <X size={12} className="text-violet-300/60 group-hover:text-violet-100" />
          </button>
        );
      })}
      {ignored.map((kind) => (
        <button
          key={kind}
          type="button"
          onClick={() => onToggle(kind)}
          aria-label={`${KIND_LABEL[kind]} wieder erkennen`}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-line px-2.5 text-xs text-ink-faint line-through decoration-ink-faint/60 hover:text-ink-muted"
        >
          <RotateCcw size={11} />
          {KIND_LABEL[kind]}
        </button>
      ))}
    </div>
  );
}
