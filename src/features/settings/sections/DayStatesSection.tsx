import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { createId } from '../../../domain/ids';
import { ENERGY_LABEL } from '../../../domain/labels';
import { mealSource, routineSource, SLEEP_SOURCE } from '../../../domain/sources';
import type { DayStateDefinition, EnergyLevel } from '../../../domain/types';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../ui/Button';
import { alpha, cn } from '../../../ui/cn';
import { ColorDot, ColorPicker, DeleteButton, Toggle, TriState } from '../../../ui/controls';
import { Field, Select, TextArea, TextInput } from '../../../ui/fields';
import { DynamicIcon, ICON_KEYS } from '../../../ui/icons';
import { SettingsGroup } from '../SettingsLayout';

export function DayStatesSection() {
  const states = useAppStore((s) => s.settings.dayStates);
  const addDayState = useAppStore((s) => s.addDayState);
  const [openId, setOpenId] = useState<string | null>(states.find((s) => !s.builtIn)?.id ?? null);

  const add = () => {
    const id = createId('state');
    addDayState({ id, name: 'Neuer Zustand', icon: 'star', color: '#22d3ee', builtIn: false, defaultActive: true, categoryRules: {}, sourceRules: {} });
    setOpenId(id);
  };

  return (
    <div className="space-y-4">
      <SettingsGroup
        title="Tageszustände"
        description="Ein Zustand bestimmt, welche Routinen, Mahlzeiten und der Schlaf an einem Tag gelten. Reihenfolge der Regeln: Regel für einzelne Routine → Regel für Kategorie → Standard des Zustands. Nichts wird gelöscht – nur pausiert."
        action={<Button size="sm" icon={Plus} onClick={add}>Zustand</Button>}
      >
        <div className="space-y-2">
          {states.map((state) => (
            <StateEditor key={state.id} state={state} open={openId === state.id} onToggle={() => setOpenId(openId === state.id ? null : state.id)} />
          ))}
        </div>
      </SettingsGroup>
    </div>
  );
}

function StateEditor({ state, open, onToggle }: { state: DayStateDefinition; open: boolean; onToggle: () => void }) {
  const categories = useAppStore((s) => s.settings.categories);
  const routines = useAppStore((s) => s.routines);
  const meals = useAppStore((s) => s.settings.meals);
  const sleepEnabled = useAppStore((s) => s.settings.sleep.enabled);
  const { updateDayState, removeDayState, setStateCategoryRule, setStateSourceRule } = useAppStore.getState();
  const update = (patch: Partial<DayStateDefinition>) => updateDayState(state.id, patch);

  const pausedCount =
    routines.filter((r) => !(state.sourceRules[routineSource(r.id)] ?? state.categoryRules[r.categoryId] ?? state.defaultActive)).length +
    meals.filter((m) => !(state.sourceRules[mealSource(m.id)] ?? state.defaultActive)).length;

  const sources = [
    ...(sleepEnabled ? [{ key: SLEEP_SOURCE, label: 'Schlaf', color: '#818cf8', categoryId: undefined as string | undefined }] : []),
    ...meals.map((m) => ({ key: mealSource(m.id), label: m.name, color: m.color, categoryId: undefined as string | undefined })),
    ...routines.map((r) => ({ key: routineSource(r.id), label: r.name, color: r.color, categoryId: r.categoryId as string | undefined })),
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface-2/60">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/[0.02]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: alpha(state.color, 0.16) }}>
          <DynamicIcon name={state.icon} size={17} color={state.color} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {state.name}
            {state.builtIn && <span className="ml-2 text-[11px] text-ink-faint">Standard</span>}
          </span>
          <span className="block text-xs text-ink-muted">{pausedCount === 0 ? 'Alles bleibt aktiv' : `${pausedCount} Einträge pausiert`}</span>
        </span>
        <ChevronDown size={16} className={cn('text-ink-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-line p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <TextInput value={state.name} onChange={(e) => update({ name: e.target.value })} />
            </Field>
            <Field label="Energie begrenzen auf" hint="Geschätzte Energie wird höchstens so hoch (manuelle Werte gelten trotzdem).">
              <Select value={state.energyCap ?? ''} onChange={(e) => update({ energyCap: e.target.value ? (Number(e.target.value) as EnergyLevel) : undefined })}>
                <option value="">Keine Begrenzung</option>
                {([1, 2, 3, 4] as EnergyLevel[]).map((l) => (
                  <option key={l} value={l}>
                    max. {l} · {ENERGY_LABEL[l]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Farbe">
            <ColorPicker value={state.color} onChange={(c) => update({ color: c })} />
          </Field>
          <Field label="Symbol">
            <div className="flex flex-wrap gap-1.5">
              {ICON_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  onClick={() => update({ icon: key })}
                  className={cn('flex h-9 w-9 items-center justify-center rounded-xl border transition-colors', state.icon === key ? 'border-transparent' : 'border-line hover:bg-white/5')}
                  style={state.icon === key ? { background: alpha(state.color, 0.2) } : undefined}
                >
                  <DynamicIcon name={key} size={16} color={state.icon === key ? state.color : undefined} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Hinweis in der Tagesansicht (optional)">
            <TextArea value={state.message ?? ''} onChange={(e) => update({ message: e.target.value || undefined })} placeholder="z. B. Gute Besserung!" />
          </Field>

          <div className="rounded-2xl border border-line bg-surface px-4 py-2">
            <Toggle
              checked={state.defaultActive}
              onChange={(v) => update({ defaultActive: v })}
              label="Standard: alles bleibt aktiv"
              description={state.defaultActive ? 'Nur was unten pausiert ist, fällt weg.' : 'Alles ist pausiert – außer was unten aktiv gesetzt ist.'}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">Nach Kategorie</p>
            <div className="divide-y divide-white/[0.04] rounded-2xl border border-line bg-surface px-3">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <ColorDot color={c.color} />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <TriState
                    value={c.id in state.categoryRules ? state.categoryRules[c.id] : null}
                    inherited={state.defaultActive}
                    onChange={(v) => setStateCategoryRule(state.id, c.id, v)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">Einzelne Einträge (überschreiben die Kategorie)</p>
            <div className="divide-y divide-white/[0.04] rounded-2xl border border-line bg-surface px-3">
              {sources.length === 0 && <p className="py-3 text-sm text-ink-faint">Noch keine Routinen oder Mahlzeiten.</p>}
              {sources.map((s) => {
                const inheritedValue = (s.categoryId ? state.categoryRules[s.categoryId] : undefined) ?? state.defaultActive;
                return (
                  <div key={s.key} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <ColorDot color={s.color} />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <TriState
                      value={s.key in state.sourceRules ? state.sourceRules[s.key] : null}
                      inherited={inheritedValue}
                      onChange={(v) => setStateSourceRule(state.id, s.key, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {!state.builtIn && (
            <div className="flex justify-end">
              <DeleteButton label="Zustand löschen" onConfirm={() => removeDayState(state.id)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
