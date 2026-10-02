import { Plus } from 'lucide-react';
import { createId } from '../../../domain/ids';
import { ENERGY_LABEL } from '../../../domain/labels';
import type { EnergyLevel } from '../../../domain/types';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../ui/Button';
import { DeleteButton, Segmented } from '../../../ui/controls';
import { Field, NumberInput, Select, TextInput, TimeInput } from '../../../ui/fields';
import { ItemBox, SettingRow, SettingsGroup } from '../SettingsLayout';

const LEVELS: EnergyLevel[] = [1, 2, 3, 4, 5];

function LevelSelect({ value, onChange, allowNone }: { value?: EnergyLevel; onChange: (v: EnergyLevel | undefined) => void; allowNone?: boolean }) {
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value ? (Number(e.target.value) as EnergyLevel) : undefined)}>
      {allowNone && <option value="">– keine Änderung –</option>}
      {LEVELS.map((l) => (
        <option key={l} value={l}>
          {l} · {ENERGY_LABEL[l]}
        </option>
      ))}
    </Select>
  );
}

export function EnergySection() {
  const energy = useAppStore((s) => s.settings.energy);
  const categories = useAppStore((s) => s.settings.categories);
  const { updateEnergySettings, upsertEnergyWindow, removeEnergyWindow, upsertEnergyRule, removeEnergyRule } = useAppStore.getState();

  return (
    <div className="space-y-4">
      <SettingsGroup
        title="So schätzt die App deine Energie"
        description="Ohne manuellen Wert gilt: Tageszeit-Fenster → überschrieben durch Aktivitäts-Regeln. Ein manueller Wert auf der Heute-Seite überschreibt alles für den ganzen Tag."
      >
        <SettingRow label="Grundwert" description="Gilt, wenn kein Zeitfenster passt.">
          <Segmented<EnergyLevel> size="sm" value={energy.baseline} onChange={(v) => updateEnergySettings({ baseline: v })} options={LEVELS.map((l) => ({ value: l, label: String(l) }))} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup
        title="Tageszeit"
        description="Zum Beispiel: morgens normal, später Abend niedriger."
        action={
          <Button size="sm" icon={Plus} onClick={() => upsertEnergyWindow({ id: createId('ew'), label: 'Zeitfenster', start: '12:00', end: '14:00', level: 3 })}>
            Fenster
          </Button>
        }
      >
        <div className="space-y-3">
          {energy.timeWindows.map((w) => (
            <ItemBox key={w.id}>
              <div className="grid gap-3 sm:grid-cols-[1fr_110px_110px_170px_auto] sm:items-end">
                <Field label="Bezeichnung">
                  <TextInput value={w.label} onChange={(e) => upsertEnergyWindow({ ...w, label: e.target.value })} />
                </Field>
                <Field label="Von">
                  <TimeInput value={w.start} onChange={(v) => upsertEnergyWindow({ ...w, start: v })} />
                </Field>
                <Field label="Bis">
                  <TimeInput value={w.end} onChange={(v) => upsertEnergyWindow({ ...w, end: v })} />
                </Field>
                <Field label="Energie">
                  <LevelSelect value={w.level} onChange={(v) => v && upsertEnergyWindow({ ...w, level: v })} />
                </Field>
                <DeleteButton label="" onConfirm={() => removeEnergyWindow(w.id)} />
              </div>
            </ItemBox>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Aktivitäten"
        description="Energie während und nach Aktivitäten einer Kategorie. „Danach“ gilt für die angegebene Dauer – oder bis eine Pause stattgefunden hat."
        action={
          <Button size="sm" icon={Plus} onClick={() => upsertEnergyRule({ id: createId('er'), categoryId: categories[0]?.id ?? '', afterLevel: 2, afterDurationMin: 45 })}>
            Regel
          </Button>
        }
      >
        <div className="space-y-3">
          {energy.categoryRules.length === 0 && <p className="text-sm text-ink-muted">Keine Regeln.</p>}
          {energy.categoryRules.map((r) => (
            <ItemBox key={r.id}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Kategorie">
                  <Select value={r.categoryId} onChange={(e) => upsertEnergyRule({ ...r, categoryId: e.target.value })}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Während">
                  <LevelSelect allowNone value={r.duringLevel} onChange={(v) => upsertEnergyRule({ ...r, duringLevel: v })} />
                </Field>
                <Field label="Danach">
                  <LevelSelect allowNone value={r.afterLevel} onChange={(v) => upsertEnergyRule({ ...r, afterLevel: v })} />
                </Field>
                <Field label="Für">
                  <NumberInput value={r.afterDurationMin} min={0} step={15} onChange={(v) => upsertEnergyRule({ ...r, afterDurationMin: v })} suffix="min" />
                </Field>
              </div>
              <div className="mt-2 flex justify-end">
                <DeleteButton onConfirm={() => removeEnergyRule(r.id)} />
              </div>
            </ItemBox>
          ))}
        </div>
      </SettingsGroup>
    </div>
  );
}
