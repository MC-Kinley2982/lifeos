import { useMemo, useState } from 'react';
import { Monitor, Plus, X } from 'lucide-react';
import { knownFocusNames, normalizeName } from '../../services/focus/days';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../ui/cn';
import { TextInput } from '../../ui/fields';

const KIND_LABEL = { group: 'Gruppe', app: 'App', web: 'Website' } as const;

/**
 * Welche Rechnerzeit aus dem Focus Co-Pilot automatisch auf das Ziel zählt:
 * Namen von Gruppen, Apps oder Websites. Vorschläge kommen aus dem, was der Co-Pilot schon geliefert hat.
 */
export function FocusMatchField({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const focusDays = useAppStore((s) => s.focusDays);
  const [text, setText] = useState('');
  const known = useMemo(() => knownFocusNames(focusDays), [focusDays]);
  const chosen = new Set(value.map(normalizeName));

  const add = (name: string) => {
    const clean = name.trim();
    if (!clean || chosen.has(normalizeName(clean))) return;
    onChange([...value, clean]);
    setText('');
  };
  const suggestions = known
    .filter((k) => !chosen.has(normalizeName(k.name)) && (!text.trim() || normalizeName(k.name).includes(normalizeName(text))))
    .slice(0, 8);

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2/70 py-0.5 pl-2.5 pr-1 text-xs">
              <Monitor size={11} className="text-sky-300" />
              {name}
              <button
                type="button"
                aria-label={`${name} entfernen`}
                onClick={() => onChange(value.filter((v) => v !== name))}
                className="rounded-full p-0.5 text-ink-faint hover:bg-white/10 hover:text-ink"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <TextInput
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(text);
            }
          }}
          placeholder="Name aus dem Co-Pilot, z. B. Blender"
        />
        <button
          type="button"
          onClick={() => add(text)}
          disabled={!text.trim()}
          aria-label="Name hinzufügen"
          className={cn('inline-flex shrink-0 items-center justify-center rounded-xl border border-line px-3 text-ink-muted hover:bg-white/5 hover:text-ink', !text.trim() && 'opacity-40')}
        >
          <Plus size={16} />
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Vorschläge aus dem Co-Pilot">
          {suggestions.map((k) => (
            <button
              key={k.name}
              type="button"
              onClick={() => add(k.name)}
              className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-ink-muted hover:border-sky-400/60 hover:text-ink"
            >
              + {k.name} <span className="text-ink-faint">· {KIND_LABEL[k.kind]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
