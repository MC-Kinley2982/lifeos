import { useState } from 'react';
import { routineDraft, type RoutineInput } from '../../domain/factories';
import { PRIORITY_LABEL } from '../../domain/labels';
import { routineSource } from '../../domain/sources';
import { toMinutes } from '../../domain/time';
import type { DayStateDefinition, Priority, Routine } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { alpha } from '../../ui/cn';
import { ColorPicker, DeleteButton, Segmented, Toggle, WeekdayPicker } from '../../ui/controls';
import { DateInput, Field, NumberInput, TextArea, TextInput, TimeInput } from '../../ui/fields';
import { DynamicIcon } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { CategorySelect, GoalSelect } from '../shared/selects';

/** Was gilt für diese Routine, wenn keine eigene Regel existiert? (Kategorie-Regel → Standard) */
function inherited(state: DayStateDefinition, categoryId: string): boolean {
  return state.categoryRules[categoryId] ?? state.defaultActive;
}

export function RoutineForm({ routine, onClose }: { routine?: Routine; onClose: () => void }) {
  const settings = useAppStore((s) => s.settings);
  const { addRoutine, updateRoutine, removeRoutine, setStateSourceRule } = useAppStore.getState();
  const [draft, setDraft] = useState<RoutineInput>(() => (routine ? { ...routine } : routineDraft(settings)));
  const set = <K extends keyof RoutineInput>(key: K, value: RoutineInput[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // Explizite Zustandsregeln dieser Routine (lokal bis zum Speichern).
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() => {
    if (!routine) return {};
    const key = routineSource(routine.id);
    return Object.fromEntries(settings.dayStates.filter((s) => key in s.sourceRules).map((s) => [s.id, s.sourceRules[key]]));
  });

  const timeError = toMinutes(draft.end) <= toMinutes(draft.start);
  const valid = draft.name.trim() && draft.weekdays.length > 0 && !timeError;

  const save = () => {
    if (!valid) return;
    const next = { ...draft, name: draft.name.trim() };
    const id = routine ? routine.id : addRoutine(next);
    if (routine) updateRoutine(routine.id, next);
    const key = routineSource(id);
    for (const state of settings.dayStates) {
      const desired = overrides[state.id];
      const explicit = desired !== undefined && desired !== inherited(state, next.categoryId);
      setStateSourceRule(state.id, key, explicit ? desired : null);
    }
    toast(routine ? 'Routine gespeichert' : 'Routine angelegt');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={routine ? 'Routine bearbeiten' : 'Neue Routine'}
      size="lg"
      footer={
        <div className="flex items-center gap-2">
          {routine && <DeleteButton onConfirm={() => { removeRoutine(routine.id); toast('Routine gelöscht', 'info'); onClose(); }} />}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button variant="primary" onClick={save} disabled={!valid}>Speichern</Button>
          </div>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <TextInput autoFocus value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. Fußballtraining" />
          </Field>
          <Field label="Kategorie">
            <CategorySelect value={draft.categoryId} onChange={(id, color) => setDraft((d) => ({ ...d, categoryId: id, color }))} />
          </Field>
        </div>

        <Field label="Wochentage">
          <WeekdayPicker value={draft.weekdays} onChange={(v) => set('weekdays', v)} weekStartsOn={settings.ui.weekStartsOn} />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Beginn">
            <TimeInput value={draft.start} onChange={(v) => set('start', v)} />
          </Field>
          <Field label="Ende">
            <TimeInput value={draft.end} onChange={(v) => set('end', v)} />
          </Field>
          <Field label="Weg davor">
            <NumberInput value={draft.travelBeforeMin} min={0} step={5} onChange={(v) => set('travelBeforeMin', v)} suffix="min" />
          </Field>
          <Field label="Weg danach">
            <NumberInput value={draft.travelAfterMin} min={0} step={5} onChange={(v) => set('travelAfterMin', v)} suffix="min" />
          </Field>
        </div>
        {timeError && <p className="-mt-2 text-xs text-red-300">Das Ende muss nach dem Beginn liegen (Routinen über Mitternacht bitte aufteilen).</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priorität">
            <Segmented<Priority>
              size="sm"
              value={draft.priority}
              onChange={(v) => set('priority', v)}
              options={(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </Field>
          <Field label="Zählt auf Ziel (optional)">
            <GoalSelect value={draft.goalId} onChange={(id) => set('goalId', id)} />
          </Field>
        </div>

        <Field label="Farbe">
          <ColorPicker value={draft.color} onChange={(c) => set('color', c)} />
        </Field>

        <div className="rounded-2xl border border-line bg-surface px-4 py-2">
          <Toggle checked={draft.blocksFreeTime} onChange={(v) => set('blocksFreeTime', v)} label="Blockiert freie Zeit" description="Aus = wird angezeigt, zählt aber als frei (z. B. optionales Lesen)." />
          <Toggle checked={draft.enabled} onChange={(v) => set('enabled', v)} label="Aktiv" description="Deaktivierte Routinen erscheinen nirgends." />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-ink-muted">Gilt bei Tageszuständen</p>
          <p className="mb-2 text-[11px] text-ink-faint">Standard kommt aus den Kategorie-Regeln des Zustands. Ein Schalter hier überschreibt das nur für diese Routine.</p>
          <div className="divide-y divide-white/[0.04] rounded-2xl border border-line bg-surface px-4">
            {settings.dayStates.map((state) => {
              const base = inherited(state, draft.categoryId);
              const value = overrides[state.id] ?? base;
              const explicit = overrides[state.id] !== undefined && overrides[state.id] !== base;
              return (
                <div key={state.id} className="flex items-center gap-3 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: alpha(state.color, 0.15) }}>
                    <DynamicIcon name={state.icon} size={14} color={state.color} />
                  </span>
                  <span className="flex-1 text-sm">
                    {state.name}
                    <span className="ml-2 text-[11px] text-ink-faint">{explicit ? 'eigene Regel' : 'Standard'}</span>
                  </span>
                  <span className="text-[11px] text-ink-muted">{value ? 'aktiv' : 'pausiert'}</span>
                  <Toggle checked={value} onChange={(v) => setOverrides((o) => ({ ...o, [state.id]: v }))} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gültig ab (optional)">
            <DateInput value={draft.validFrom ?? ''} onChange={(v) => set('validFrom', v || undefined)} />
          </Field>
          <Field label="Gültig bis (optional)" hint="z. B. Ende des Schuljahres">
            <DateInput value={draft.validUntil ?? ''} onChange={(v) => set('validUntil', v || undefined)} />
          </Field>
        </div>

        <Field label="Beschreibung (optional)">
          <TextArea value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
