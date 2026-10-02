import { useState } from 'react';
import { goalDraft, type GoalInput } from '../../domain/factories';
import type { Goal, TaskEnergy, TimeOfDay } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { ColorPicker, DeleteButton, Segmented, Toggle } from '../../ui/controls';
import { Field, NumberInput, TextArea, TextInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { CategorySelect } from '../shared/selects';

export function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const settings = useAppStore((s) => s.settings);
  const { addGoal, updateGoal, removeGoal } = useAppStore.getState();
  const [draft, setDraft] = useState<GoalInput>(() => (goal ? { ...goal } : goalDraft(settings)));
  const set = <K extends keyof GoalInput>(key: K, value: GoalInput[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const hours = Math.floor(draft.target.minutes / 60);
  const minutes = draft.target.minutes % 60;
  const setTarget = (h: number, m: number) => set('target', { type: 'weeklyMinutes', minutes: Math.max(0, h * 60 + m) });

  const save = () => {
    if (!draft.title.trim()) return;
    const next = { ...draft, title: draft.title.trim(), sessionMin: Math.max(15, draft.sessionMin || 15) };
    if (goal) updateGoal(goal.id, next);
    else addGoal(next);
    toast(goal ? 'Ziel gespeichert' : 'Ziel angelegt');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={goal ? 'Ziel bearbeiten' : 'Neues Ziel'}
      footer={
        <div className="flex items-center gap-2">
          {goal && <DeleteButton onConfirm={() => { removeGoal(goal.id); toast('Ziel gelöscht', 'info'); onClose(); }} />}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button variant="primary" onClick={save} disabled={!draft.title.trim()}>Speichern</Button>
          </div>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Ziel">
          <TextInput autoFocus value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="z. B. Blender verbessern" />
        </Field>
        <Field label="Wochenziel" hint="So viel Zeit möchtest du pro Woche investieren.">
          <div className="flex gap-2">
            <NumberInput value={hours} min={0} onChange={(v) => setTarget(v, minutes)} suffix="Std." />
            <NumberInput value={minutes} min={0} max={59} step={15} onChange={(v) => setTarget(hours, Math.min(59, v))} suffix="Min." />
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Länge einer Einheit" hint="Für die automatische Wochenplanung.">
            <NumberInput value={draft.sessionMin} min={15} step={15} onChange={(v) => set('sessionMin', v)} suffix="min" />
          </Field>
          <Field label="Kategorie">
            <CategorySelect value={draft.categoryId} onChange={(id) => set('categoryId', id)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Benötigte Energie">
            <Segmented<TaskEnergy>
              size="sm"
              value={draft.energy}
              onChange={(v) => set('energy', v)}
              options={[
                { value: 'low', label: 'Leicht' },
                { value: 'medium', label: 'Mittel' },
                { value: 'high', label: 'Hoch' },
              ]}
            />
          </Field>
          <Field label="Bevorzugte Tageszeit">
            <Segmented<TimeOfDay | 'any'>
              size="sm"
              value={draft.preferredTimeOfDay ?? 'any'}
              onChange={(v) => set('preferredTimeOfDay', v === 'any' ? undefined : v)}
              options={[
                { value: 'any', label: 'Egal' },
                { value: 'morning', label: 'Morg.' },
                { value: 'afternoon', label: 'Nachm.' },
                { value: 'evening', label: 'Abends' },
              ]}
            />
          </Field>
        </div>
        <Field label="Farbe">
          <ColorPicker value={draft.color} onChange={(c) => set('color', c)} />
        </Field>
        <Field label="Beschreibung (optional)">
          <TextArea value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Toggle checked={draft.active} onChange={(v) => set('active', v)} label="Aktiv" description="Inaktive Ziele werden nicht angezeigt oder eingeplant." />
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
