import { Plus } from 'lucide-react';
import { mealDraft } from '../../../domain/factories';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../ui/Button';
import { DeleteButton, Toggle, WeekdayPicker } from '../../../ui/controls';
import { Field, NumberInput, TextInput, TimeInput } from '../../../ui/fields';
import { ItemBox, SettingsGroup } from '../SettingsLayout';

export function MealsSection() {
  const meals = useAppStore((s) => s.settings.meals);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const { addMeal, updateMeal, removeMeal } = useAppStore.getState();

  return (
    <SettingsGroup
      title="Mahlzeiten"
      description="Jede aktive Mahlzeit blockiert ihre Zeit im Tagesplan. Ob sie bei Krankheit oder im Urlaub gilt, stellst du unter „Tageszustände“ ein."
      action={<Button size="sm" icon={Plus} onClick={() => addMeal(mealDraft())}>Mahlzeit</Button>}
    >
      <div className="space-y-3">
        {meals.length === 0 && <p className="text-sm text-ink-muted">Keine Mahlzeiten eingetragen.</p>}
        {meals.map((m) => (
          <ItemBox key={m.id} muted={!m.enabled}>
            <div className="grid gap-3 sm:grid-cols-[1fr_130px_120px]">
              <Field label="Name">
                <TextInput value={m.name} onChange={(e) => updateMeal(m.id, { name: e.target.value })} />
              </Field>
              <Field label="Uhrzeit">
                <TimeInput value={m.time} onChange={(v) => updateMeal(m.id, { time: v })} />
              </Field>
              <Field label="Dauer">
                <NumberInput value={m.durationMin} min={5} step={5} onChange={(v) => updateMeal(m.id, { durationMin: v })} suffix="min" />
              </Field>
            </div>
            <div className="mt-3">
              <WeekdayPicker value={m.weekdays} onChange={(v) => updateMeal(m.id, { weekdays: v })} weekStartsOn={weekStartsOn} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <Toggle checked={m.enabled} onChange={(v) => updateMeal(m.id, { enabled: v })} />
                {m.enabled ? 'Aktiv' : 'Deaktiviert'}
              </div>
              <DeleteButton onConfirm={() => removeMeal(m.id)} />
            </div>
          </ItemBox>
        ))}
      </div>
    </SettingsGroup>
  );
}
