import { Plus } from 'lucide-react';
import { createId } from '../../../domain/ids';
import { ENERGY_LABEL, TASK_ENERGY_LABEL } from '../../../domain/labels';
import { WORKDAYS } from '../../../domain/time';
import type { EnergyLevel, TaskEnergy } from '../../../domain/types';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../ui/Button';
import { DeleteButton, Segmented, Toggle, WeekdayPicker } from '../../../ui/controls';
import { Field, NumberInput, Select, TimeInput } from '../../../ui/fields';
import { ItemBox, SettingRow, SettingsGroup } from '../SettingsLayout';

export function PlanningSection() {
  const p = useAppStore((s) => s.settings.planning);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const { updatePlanning, upsertWorkWindow, removeWorkWindow } = useAppStore.getState();

  return (
    <div className="space-y-4">
      <SettingsGroup title="Freizeit-Schutz" description="Die App verplant nie deine ganze freie Zeit. Freizeit ist ausdrücklich erlaubt.">
        <SettingRow label="Höchstens verplanen" description={`${Math.round(p.maxPlannedShare * 100)} % der freien Zeit eines Tages`}>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(p.maxPlannedShare * 100)}
            onChange={(e) => updatePlanning({ maxPlannedShare: Number(e.target.value) / 100 })}
            className="w-full accent-violet-500"
          />
        </SettingRow>
        <SettingRow label="Immer frei lassen" description="Mindest-Freizeit pro Tag">
          <NumberInput value={p.minFreeTimeMin} min={0} step={15} onChange={(v) => updatePlanning({ minFreeTimeMin: v })} suffix="min" />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Zeitblöcke">
        <SettingRow label="Kürzeste planbare Lücke" description="Kürzere freie Zeit wird ignoriert.">
          <NumberInput value={p.minSlotMin} min={5} step={5} onChange={(v) => updatePlanning({ minSlotMin: v })} suffix="min" />
        </SettingRow>
        <SettingRow label="Raster für Startzeiten">
          <Segmented<number> size="sm" value={p.granularityMin} onChange={(v) => updatePlanning({ granularityMin: v })} options={[5, 10, 15, 30].map((m) => ({ value: m, label: `${m} min` }))} />
        </SettingRow>
        <SettingRow label="Puffer zwischen Aufgaben">
          <NumberInput value={p.bufferBetweenTasksMin} min={0} step={5} onChange={(v) => updatePlanning({ bufferBetweenTasksMin: v })} suffix="min" />
        </SettingRow>
        <SettingRow label="Max. Arbeit am Stück" description="Danach wird eine Pause eingeplant.">
          <NumberInput value={p.maxFocusMin} min={15} step={15} onChange={(v) => updatePlanning({ maxFocusMin: v })} suffix="min" />
        </SettingRow>
        <SettingRow label="Pause danach">
          <NumberInput value={p.breakAfterFocusMin} min={5} step={5} onChange={(v) => updatePlanning({ breakAfterFocusMin: v })} suffix="min" />
        </SettingRow>
        <SettingRow label="Standard-Länge für Ziel-Einheiten">
          <NumberInput value={p.defaultGoalSessionMin} min={15} step={15} onChange={(v) => updatePlanning({ defaultGoalSessionMin: v })} suffix="min" />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Tageszeiten" description="Für „bevorzugte Tageszeit“ bei Aufgaben.">
        <SettingRow label="Nachmittag beginnt">
          <TimeInput value={p.afternoonStarts} onChange={(v) => updatePlanning({ afternoonStarts: v })} />
        </SettingRow>
        <SettingRow label="Abend beginnt">
          <TimeInput value={p.eveningStarts} onChange={(v) => updatePlanning({ eveningStarts: v })} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Energie-Bedarf von Aufgaben" description="Ab welcher Energie gilt eine Aufgabe als passend?">
        {(['low', 'medium', 'high'] as TaskEnergy[]).map((e) => (
          <SettingRow key={e} label={TASK_ENERGY_LABEL[e]}>
            <Select
              value={p.energyRequirement[e]}
              onChange={(ev) => updatePlanning({ energyRequirement: { ...p.energyRequirement, [e]: Number(ev.target.value) as EnergyLevel } })}
            >
              {([1, 2, 3, 4, 5] as EnergyLevel[]).map((l) => (
                <option key={l} value={l}>
                  ab {l} · {ENERGY_LABEL[l]}
                </option>
              ))}
            </Select>
          </SettingRow>
        ))}
      </SettingsGroup>

      <SettingsGroup
        title="Bevorzugte Arbeitszeiten"
        description="Wenn aktiv, plant die App Aufgaben nur innerhalb dieser Fenster."
        action={
          <Button size="sm" icon={Plus} onClick={() => upsertWorkWindow({ id: createId('ww'), weekdays: [...WORKDAYS], start: '15:00', end: '20:00' })}>
            Fenster
          </Button>
        }
      >
        <Toggle checked={p.useWorkWindows} onChange={(v) => updatePlanning({ useWorkWindows: v })} label="Nur in Arbeitszeiten planen" />
        <div className="mt-3 space-y-3">
          {p.workWindows.map((w) => (
            <ItemBox key={w.id} muted={!p.useWorkWindows}>
              <WeekdayPicker value={w.weekdays} onChange={(v) => upsertWorkWindow({ ...w, weekdays: v })} weekStartsOn={weekStartsOn} />
              <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                <Field label="Von">
                  <TimeInput value={w.start} onChange={(v) => upsertWorkWindow({ ...w, start: v })} />
                </Field>
                <Field label="Bis">
                  <TimeInput value={w.end} onChange={(v) => upsertWorkWindow({ ...w, end: v })} />
                </Field>
                <DeleteButton label="" onConfirm={() => removeWorkWindow(w.id)} />
              </div>
            </ItemBox>
          ))}
        </div>
      </SettingsGroup>
    </div>
  );
}
