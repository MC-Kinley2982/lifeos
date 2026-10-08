import { Plus, ShieldCheck } from 'lucide-react';
import { morningRoutinePeriod } from '../../../domain/defaults';
import { createId } from '../../../domain/ids';
import { ENERGY_LABEL, TASK_ENERGY_LABEL } from '../../../domain/labels';
import { ALL_WEEKDAYS, WORKDAYS } from '../../../domain/time';
import type { EnergyLevel, ProtectedPeriod, TaskEnergy, Weekday } from '../../../domain/types';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../ui/Button';
import { DeleteButton, Segmented, Toggle, WeekdayPicker } from '../../../ui/controls';
import { Field, NumberInput, Select, TextInput, TimeInput } from '../../../ui/fields';
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
        <SettingRow label="Immer frei lassen" description="Mindest-Freizeit pro Tag – wird garantiert: wird ein Tag zu voll, verschiebt LifeOS automatisch Geplantes auf andere Tage.">

          <NumberInput value={p.minFreeTimeMin} min={0} step={15} onChange={(v) => updatePlanning({ minFreeTimeMin: v })} suffix="min" />
        </SettingRow>
      </SettingsGroup>

      <ProtectedPeriodsGroup periods={p.protectedPeriods} weekStartsOn={weekStartsOn} />


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

type StartMode = ProtectedPeriod['from']['at'];
type EndMode = ProtectedPeriod['until']['at'];

/**
 * Geschützte Zeiträume: z. B. Morgenroutine (ab dem Aufstehen bis 07:45), Familienzeit, Mittagspause.
 * Hier wird nie automatisch etwas eingeplant – kleine Lücken zwischen Routine-Punkten bleiben in Ruhe.
 */
function ProtectedPeriodsGroup({ periods, weekStartsOn }: { periods: ProtectedPeriod[]; weekStartsOn: Weekday }) {
  const { upsertProtectedPeriod, removeProtectedPeriod } = useAppStore.getState();
  const save = (p: ProtectedPeriod, patch: Partial<ProtectedPeriod>) => upsertProtectedPeriod({ ...p, ...patch });
  const hasMorning = periods.some((p) => p.from.at === 'wake');

  return (
    <SettingsGroup
      title="Geschützte Zeiten"
      description="In diesen Zeiträumen plant LifeOS nie automatisch Aufgaben, Hausaufgaben, Lernzeit, Ziele oder To-dos ein – auch nicht in kleine Lücken dazwischen. Feste Termine und Routinen bleiben sichtbar."
      action={
        <Button
          size="sm"
          icon={Plus}
          onClick={() =>
            upsertProtectedPeriod(
              hasMorning
                ? { id: createId('pp'), name: '', enabled: true, weekdays: [...ALL_WEEKDAYS], from: { at: 'time', time: '18:00' }, until: { at: 'duration', minutes: 60 } }
                : morningRoutinePeriod(),
            )
          }
        >
          {hasMorning ? 'Zeitraum' : 'Morgenroutine'}
        </Button>
      }
    >
      {periods.length === 0 && <p className="text-sm text-ink-muted">Keine geschützten Zeiten – LifeOS darf jede freie Lücke (ab der Mindestlänge) nutzen.</p>}
      <div className="space-y-3">
        {periods.map((p) => (
          <ItemBox key={p.id} muted={!p.enabled}>
            <div className="flex items-center gap-3">
              <ShieldCheck size={16} className="shrink-0 text-emerald-400" />
              <TextInput
                value={p.name}
                placeholder="z. B. Familienzeit"
                onChange={(e) => save(p, { name: e.target.value })}
                className="flex-1"
                aria-label="Name"
              />
              <Toggle checked={p.enabled} onChange={(v) => save(p, { enabled: v })} />
            </div>
            <div className="mt-3">
              <WeekdayPicker value={p.weekdays} onChange={(v) => save(p, { weekdays: v })} weekStartsOn={weekStartsOn} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Beginn">
                <Segmented<StartMode>
                  size="sm"
                  value={p.from.at}
                  onChange={(v) => save(p, { from: v === 'wake' ? { at: 'wake' } : { at: 'time', time: p.from.at === 'time' ? p.from.time : '07:00' } })}
                  options={[
                    { value: 'wake', label: 'Aufstehen' },
                    { value: 'time', label: 'Uhrzeit' },
                  ]}
                />
                {p.from.at === 'time' && <TimeInput className="mt-2" value={p.from.time} onChange={(v) => save(p, { from: { at: 'time', time: v } })} />}
              </Field>
              <Field label="Ende">
                <Segmented<EndMode>
                  size="sm"
                  value={p.until.at}
                  onChange={(v) =>
                    save(p, {
                      until: v === 'time' ? { at: 'time', time: '08:00' } : v === 'duration' ? { at: 'duration', minutes: 45 } : { at: 'bedtime' },
                    })
                  }
                  options={[
                    { value: 'time', label: 'Uhrzeit' },
                    { value: 'duration', label: 'Dauer' },
                    { value: 'bedtime', label: 'Schlafen' },
                  ]}
                />
                {p.until.at === 'time' && <TimeInput className="mt-2" value={p.until.time} onChange={(v) => save(p, { until: { at: 'time', time: v } })} />}
                {p.until.at === 'duration' && (
                  <NumberInput className="mt-2" value={p.until.minutes} min={5} step={5} suffix="min" onChange={(v) => save(p, { until: { at: 'duration', minutes: Math.max(5, v) } })} />
                )}
              </Field>
            </div>
            <div className="mt-2 flex justify-end">
              <DeleteButton label="Entfernen" onConfirm={() => removeProtectedPeriod(p.id)} />
            </div>
          </ItemBox>
        ))}
      </div>
    </SettingsGroup>
  );
}
