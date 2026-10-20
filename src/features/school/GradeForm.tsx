import { useState } from 'react';
import type { GradeInput } from '../../domain/factories';
import { todayKey } from '../../domain/time';
import type { Grade } from '../../domain/types';
import { gradeColor, gradeLabel, gradeTypeOf } from '../../services/school/grades';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { alpha, cn } from '../../ui/cn';
import { DeleteButton, Segmented } from '../../ui/controls';
import { DateInput, Field, NumberInput, Select, TextInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { SubjectSelect } from './SchoolBits';

type Tendency = 'plus' | 'none' | 'minus';
const BASES = [1, 2, 3, 4, 5, 6];

function split(value: number, step: number): { base: number; tendency: Tendency } | null {
  if (!(value > 0)) return null;
  for (const base of BASES) {
    if (Math.abs(value - base) < 0.005) return { base, tendency: 'none' };
    if (step > 0 && Math.abs(value - (base - step)) < 0.005) return { base, tendency: 'plus' };
    if (step > 0 && Math.abs(value - (base + step)) < 0.005) return { base, tendency: 'minus' };
  }
  return { base: Math.min(6, Math.max(1, Math.round(value))), tendency: 'none' };
}

/** Note eintragen bzw. bearbeiten: Fach, Note (Zahl + Plus/Minus), Art, Datum, optional Titel und eigenes Gewicht. */
export function GradeForm({ grade, defaults, onClose }: { grade?: Grade; defaults?: Partial<GradeInput>; onClose: () => void }) {
  const { addGrade, updateGrade, removeGrade } = useAppStore.getState();
  const subjects = useAppStore((s) => s.subjects);
  const school = useAppStore((s) => s.settings.school);
  const step = school.gradeTendencyStep;
  const [draft, setDraft] = useState<GradeInput>(() =>
    grade
      ? { ...grade }
      : {
          subjectId: defaults?.subjectId ?? subjects[0]?.id ?? '',
          value: 0,
          typeId: defaults?.typeId ?? school.gradeTypes[0]?.id ?? '',
          date: defaults?.date ?? todayKey(),
          title: defaults?.title,
          examId: defaults?.examId,
        },
  );
  const set = <K extends keyof GradeInput>(key: K, value: GradeInput[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const parts = split(draft.value, step);
  const typeWeight = gradeTypeOf(school, draft.typeId)?.weight ?? 1;

  const pick = (base: number, tendency: Tendency) => {
    const t = base === 6 && tendency === 'minus' ? 'none' : tendency;
    set('value', Math.round((base + (t === 'plus' ? -step : t === 'minus' ? step : 0)) * 100) / 100);
  };

  const valid = !!draft.subjectId && draft.value > 0;
  const save = () => {
    if (!valid) return;
    const next = { ...draft, title: draft.title?.trim() || undefined };
    if (grade) updateGrade(grade.id, next);
    else addGrade(next);
    toast(`Note ${gradeLabel(next.value, step)} gespeichert`);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={grade ? 'Note bearbeiten' : 'Note eintragen'}
      footer={
        <div className="flex items-center gap-2">
          {grade && (
            <DeleteButton
              onConfirm={() => {
                removeGrade(grade.id);
                toast('Note gelöscht', 'info');
                onClose();
              }}
            />
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={save} disabled={!valid}>
              Speichern
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Fach">
          <SubjectSelect value={draft.subjectId} onChange={(id) => set('subjectId', id)} />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Note</span>
          <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Note">
            {BASES.map((base) => {
              const active = parts?.base === base;
              const color = gradeColor(base);
              return (
                <button
                  key={base}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => pick(base, parts?.tendency ?? 'none')}
                  className={cn('h-12 rounded-2xl border text-lg font-semibold tabular transition-colors', !active && 'border-line bg-surface text-ink-muted hover:text-ink')}
                  style={active ? { background: alpha(color, 0.2), borderColor: alpha(color, 0.6), color } : undefined}
                >
                  {base}
                </button>
              );
            })}
          </div>
          {step > 0 && (
            <Segmented<Tendency>
              className="mt-2"
              size="sm"
              value={parts?.tendency ?? 'none'}
              onChange={(t) => parts && pick(parts.base, t)}
              options={[
                { value: 'plus', label: 'Plus (+)' },
                { value: 'none', label: 'glatt' },
                { value: 'minus', label: 'Minus (−)' },
              ]}
            />
          )}
          {parts && (
            <p className="mt-2 text-xs text-ink-muted">
              Gewählt: <span className="font-semibold" style={{ color: gradeColor(draft.value) }}>{gradeLabel(draft.value, step)}</span>
              {` (${String(draft.value).replace('.', ',')})`}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Art">
            <Select value={draft.typeId} onChange={(e) => set('typeId', e.target.value)}>
              {school.gradeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Datum">
            <DateInput value={draft.date} onChange={(v) => v && set('date', v)} />
          </Field>
        </div>

        <Field label="Titel (optional)">
          <TextInput value={draft.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="z. B. 2. Klassenarbeit" />
        </Field>

        <Field
          label="Eigenes Gewicht (optional)"
          hint={`0 = Gewicht der Notenart (${String(typeWeight).replace('.', ',')}${school.gradeAverageMode === 'byType' ? ' – zählt innerhalb der Art' : ''}).`}
        >
          <NumberInput
            className="w-36"
            value={draft.weight ?? 0}
            min={0}
            step={0.5}
            inputMode="decimal"
            onChange={(v) => set('weight', v > 0 ? v : undefined)}
          />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
