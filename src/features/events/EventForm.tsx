import { useState } from 'react';
import { eventDraft, type EventInput } from '../../domain/factories';
import { toMinutes } from '../../domain/time';
import type { CalendarEvent, DateKey } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { DeleteButton, Toggle } from '../../ui/controls';
import { DateInput, Field, NumberInput, TextArea, TextInput, TimeInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { CategorySelect, GoalSelect } from '../shared/selects';

export function EventForm({ event, defaultDate, onClose }: { event?: CalendarEvent; defaultDate: DateKey; onClose: () => void }) {
  const settings = useAppStore((s) => s.settings);
  const { addEvent, updateEvent, removeEvent } = useAppStore.getState();
  const [draft, setDraft] = useState<EventInput>(() => (event ? { ...event } : eventDraft(settings, defaultDate)));
  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const timeError = !draft.allDay && toMinutes(draft.end) <= toMinutes(draft.start);
  const valid = draft.title.trim() && draft.date && !timeError;

  const save = () => {
    if (!valid) return;
    const next = { ...draft, title: draft.title.trim() };
    if (event) updateEvent(event.id, next);
    else addEvent(next);
    toast(event ? 'Termin gespeichert' : 'Termin angelegt');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={event ? 'Termin bearbeiten' : 'Neuer Termin'}
      footer={
        <div className="flex items-center gap-2">
          {event && <DeleteButton onConfirm={() => { removeEvent(event.id); toast('Termin gelöscht', 'info'); onClose(); }} />}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button variant="primary" onClick={save} disabled={!valid}>Speichern</Button>
          </div>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Titel">
          <TextInput autoFocus value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="z. B. Fußballspiel, Geburtstag, Arzt" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Datum">
            <DateInput value={draft.date} onChange={(v) => set('date', v)} />
          </Field>
          <div className="flex items-end pb-1.5">
            <Toggle checked={draft.allDay} onChange={(v) => set('allDay', v)} label="Ganztägig" />
          </div>
        </div>
        {!draft.allDay && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Beginn">
              <TimeInput value={draft.start} onChange={(v) => set('start', v)} />
            </Field>
            <Field label="Ende">
              <TimeInput value={draft.end} onChange={(v) => set('end', v)} />
            </Field>
          </div>
        )}
        {timeError && <p className="-mt-2 text-xs text-red-300">Das Ende muss nach dem Beginn liegen.</p>}
        {!draft.allDay && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Weg davor" hint="Wird als „Hinweg“ blockiert.">
              <NumberInput value={draft.travelBeforeMin} min={0} step={5} onChange={(v) => set('travelBeforeMin', v)} suffix="min" />
            </Field>
            <Field label="Weg danach">
              <NumberInput value={draft.travelAfterMin} min={0} step={5} onChange={(v) => set('travelAfterMin', v)} suffix="min" />
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kategorie">
            <CategorySelect value={draft.categoryId} onChange={(id) => set('categoryId', id)} />
          </Field>
          <Field label="Zählt auf Ziel (optional)">
            <GoalSelect value={draft.goalId} onChange={(id) => set('goalId', id)} />
          </Field>
        </div>
        <Field label="Ort (optional)">
          <TextInput value={draft.location ?? ''} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="Notiz (optional)">
          <TextArea value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>
        {!draft.allDay && (
          <Toggle checked={draft.blocksFreeTime} onChange={(v) => set('blocksFreeTime', v)} label="Blockiert freie Zeit" description="Aus = Termin wird angezeigt, aber nicht von der freien Zeit abgezogen." />
        )}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
