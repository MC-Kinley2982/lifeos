import { Plus } from 'lucide-react';
import { specialDayDraft, vacationDraft } from '../../../domain/factories';
import { diffDays, todayKey } from '../../../domain/time';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../ui/Button';
import { Badge, DeleteButton } from '../../../ui/controls';
import { DateInput, Field, TextInput } from '../../../ui/fields';
import { DayStateSelect } from '../../shared/selects';
import { ItemBox, SettingsGroup } from '../SettingsLayout';

export function VacationSection() {
  const settings = useAppStore((s) => s.settings);
  const vacations = useAppStore((s) => s.vacations);
  const specialDays = useAppStore((s) => s.specialDays);
  const { addVacation, updateVacation, removeVacation, addSpecialDay, updateSpecialDay, removeSpecialDay } = useAppStore.getState();
  const today = todayKey();

  return (
    <div className="space-y-4">
      <SettingsGroup
        title="Urlaub & Ferien"
        description="Für einen Zeitraum gilt automatisch der gewählte Zustand. Welche Routinen dann weiterlaufen (z. B. Schlaf und Frühstück ja, Schule nein), legst du unter „Tageszustände“ fest."
        action={<Button size="sm" icon={Plus} onClick={() => addVacation(vacationDraft(settings, today))}>Zeitraum</Button>}
      >
        <div className="space-y-3">
          {vacations.length === 0 && <p className="text-sm text-ink-muted">Kein Urlaub eingetragen.</p>}
          {vacations.map((v) => {
            const active = v.startDate <= today && today <= v.endDate;
            const invalid = v.endDate < v.startDate;
            return (
              <ItemBox key={v.id}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bezeichnung">
                    <TextInput value={v.name} onChange={(e) => updateVacation(v.id, { name: e.target.value })} />
                  </Field>
                  <Field label="Zustand in diesem Zeitraum">
                    <DayStateSelect value={v.stateId} onChange={(id) => updateVacation(v.id, { stateId: id })} />
                  </Field>
                  <Field label="Von">
                    <DateInput value={v.startDate} onChange={(d) => d && updateVacation(v.id, { startDate: d, endDate: v.endDate < d ? d : v.endDate })} />
                  </Field>
                  <Field label="Bis">
                    <DateInput value={v.endDate} onChange={(d) => d && updateVacation(v.id, { endDate: d })} />
                  </Field>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    {active && <Badge color="#2dd4bf">Läuft gerade</Badge>}
                    {invalid ? <Badge color="#f87171">Ende liegt vor Beginn</Badge> : <Badge>{diffDays(v.startDate, v.endDate) + 1} Tage</Badge>}
                  </div>
                  <DeleteButton onConfirm={() => removeVacation(v.id)} />
                </div>
              </ItemBox>
            );
          })}
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Besondere Tage"
        description="Einzelne Tage mit eigenem Zustand – z. B. Ausflug, Klassenfahrt-Tag oder Geburtstag."
        action={<Button size="sm" icon={Plus} onClick={() => addSpecialDay(specialDayDraft(settings, today))}>Tag</Button>}
      >
        <div className="space-y-3">
          {specialDays.length === 0 && <p className="text-sm text-ink-muted">Keine besonderen Tage.</p>}
          {specialDays.map((d) => (
            <ItemBox key={d.id}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Bezeichnung">
                  <TextInput value={d.name} onChange={(e) => updateSpecialDay(d.id, { name: e.target.value })} placeholder="z. B. Wandertag" />
                </Field>
                <Field label="Datum">
                  <DateInput value={d.date} onChange={(v) => v && updateSpecialDay(d.id, { date: v })} />
                </Field>
                <Field label="Zustand">
                  <DayStateSelect value={d.stateId} onChange={(id) => updateSpecialDay(d.id, { stateId: id })} />
                </Field>
              </div>
              <div className="mt-2 flex justify-end">
                <DeleteButton onConfirm={() => removeSpecialDay(d.id)} />
              </div>
            </ItemBox>
          ))}
        </div>
      </SettingsGroup>

      <p className="px-1 text-xs text-ink-faint">
        Vorrang: Ein auf der Heute-Seite manuell gewählter Zustand gilt vor besonderen Tagen, diese gelten vor Urlaubszeiträumen.
      </p>
    </div>
  );
}
