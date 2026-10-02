import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SUBJECT_SUGGESTIONS } from '../../domain/defaults';
import { subjectDraft, type SubjectInput } from '../../domain/factories';
import type { Subject } from '../../domain/types';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { Card, EmptyState } from '../../ui/Card';
import { ColorDot, ColorPicker, DeleteButton } from '../../ui/controls';
import { Field, NumberInput, TextInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';

export function SubjectsManager() {
  const subjects = useAppStore((s) => s.subjects);
  const timetable = useAppStore((s) => s.timetable);
  const defaultMin = useAppStore((s) => s.settings.school.defaultHomeworkMinutes);
  const addSubject = useAppStore((s) => s.addSubject);
  const [editing, setEditing] = useState<Subject | 'new' | null>(null);

  const suggestions = SUBJECT_SUGGESTIONS.filter((s) => !subjects.some((x) => x.name.toLowerCase() === s.name.toLowerCase()));

  return (
    <div className="space-y-4">
      <Card>
        {subjects.length === 0 ? (
          <EmptyState icon={Plus} title="Noch keine Fächer" text="Tippe unten auf Vorschläge oder lege ein eigenes Fach an." />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {subjects.map((s) => {
              const lessons = timetable.filter((e) => e.subjectId === s.id).length;
              return (
                <button key={s.id} type="button" onClick={() => setEditing(s)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-white/[0.02]">
                  <ColorDot color={s.color} className="h-3 w-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {s.name} {s.shortName && <span className="text-ink-faint">· {s.shortName}</span>}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {lessons} Std./Woche · Ø Hausaufgabe {s.homeworkMinutes ?? defaultMin} min
                      {s.teacher ? ` · ${s.teacher}` : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <Button variant="secondary" icon={Plus} className="mt-3" onClick={() => setEditing('new')}>
          Eigenes Fach
        </Button>
      </Card>

      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-xs font-medium text-ink-muted">Vorschläge – antippen zum Hinzufügen</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => {
                  addSubject({ name: s.name, shortName: s.shortName, color: s.color });
                  toast(`${s.name} hinzugefügt`);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <ColorDot color={s.color} className="h-2 w-2" />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {editing && <SubjectForm subject={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SubjectForm({ subject, onClose }: { subject?: Subject; onClose: () => void }) {
  const { addSubject, updateSubject, removeSubject } = useAppStore.getState();
  const defaultMin = useAppStore((s) => s.settings.school.defaultHomeworkMinutes);
  const [draft, setDraft] = useState<SubjectInput>(() => (subject ? { ...subject } : subjectDraft()));
  const set = <K extends keyof SubjectInput>(key: K, value: SubjectInput[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    if (!draft.name.trim()) return;
    const next = { ...draft, name: draft.name.trim() };
    if (subject) updateSubject(subject.id, next);
    else addSubject(next);
    toast('Fach gespeichert');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={subject ? 'Fach bearbeiten' : 'Neues Fach'}
      footer={
        <div className="flex items-center gap-2">
          {subject && (
            <DeleteButton
              onConfirm={() => {
                removeSubject(subject.id);
                toast('Fach entfernt (inkl. Stundenplan-Einträgen)', 'info');
                onClose();
              }}
            />
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button variant="primary" onClick={save} disabled={!draft.name.trim()}>Speichern</Button>
          </div>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Name">
            <TextInput autoFocus value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. Mathematik" />
          </Field>
          <Field label="Kürzel">
            <TextInput value={draft.shortName ?? ''} onChange={(e) => set('shortName', e.target.value)} placeholder="Ma" maxLength={4} />
          </Field>
        </div>
        <Field label="Farbe">
          <ColorPicker value={draft.color} onChange={(c) => set('color', c)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lehrkraft (optional)">
            <TextInput value={draft.teacher ?? ''} onChange={(e) => set('teacher', e.target.value || undefined)} />
          </Field>
          <Field label="Raum (optional)">
            <TextInput value={draft.room ?? ''} onChange={(e) => set('room', e.target.value || undefined)} />
          </Field>
        </div>
        <Field label="Ø Hausaufgabenzeit (optional)" hint={`Leer = allgemeiner Standard (${defaultMin} min).`}>
          <NumberInput value={draft.homeworkMinutes ?? 0} min={0} step={5} suffix="min" onChange={(v) => set('homeworkMinutes', v > 0 ? v : undefined)} />
        </Field>
        {subject && <p className="text-[11px] text-ink-faint">Beim Löschen werden auch die Stunden dieses Fachs aus dem Stundenplan entfernt. Hausaufgaben und Tests bleiben erhalten.</p>}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
