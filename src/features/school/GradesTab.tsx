import { useMemo, useState } from 'react';
import { Calculator, ChevronDown, ClipboardCheck, Plus, Trophy } from 'lucide-react';
import type { GradeInput } from '../../domain/factories';
import { addDays, formatDateShort, toDateKey } from '../../domain/time';
import type { Grade, ID } from '../../domain/types';
import {
  examsWithoutGrade,
  formatGrade,
  gradeColor,
  gradeLabel,
  gradesBySubject,
  gradeTypeOf,
  neededGrade,
  overallAverage,
  subjectAverage,
} from '../../services/school/grades';
import { useNow } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { Card, CardHeader, EmptyState } from '../../ui/Card';
import { alpha, cn } from '../../ui/cn';
import { ColorDot } from '../../ui/controls';
import { Field, NumberInput, Select } from '../../ui/fields';
import { GradeForm } from './GradeForm';
import { SubjectSelect } from './SchoolBits';

/** Wie weit zurück vergangene Tests ohne Note angezeigt werden. */
const PENDING_DAYS = 60;

/** Zielschnitt-Vorschläge: höchstens x,5 ergibt meist noch die Zeugnisnote x. */
const TARGETS = [1.5, 2.5, 3.5, 4.5];

/** Noten: Schnitt pro Fach, Gesamtschnitt, Tests ohne Note und "Was brauche ich?". */
export function GradesTab() {
  const subjects = useAppStore((s) => s.subjects);
  const grades = useAppStore((s) => s.grades);
  const exams = useAppStore((s) => s.exams);
  const school = useAppStore((s) => s.settings.school);
  const today = toDateKey(useNow());
  const [form, setForm] = useState<{ grade?: Grade; defaults?: Partial<GradeInput> } | null>(null);
  const [openId, setOpenId] = useState<ID | null>(null);

  const bySubject = useMemo(() => gradesBySubject(subjects, grades, school), [subjects, grades, school]);
  const overall = overallAverage(bySubject);
  const pending = useMemo(() => examsWithoutGrade(exams, grades, today, addDays(today, -PENDING_DAYS)), [exams, grades, today]);
  const examType = school.gradeTypes.find((t) => /klassenarbeit|schulaufgabe|klausur/i.test(t.name)) ?? school.gradeTypes[0];

  if (subjects.length === 0) {
    return (
      <Card>
        <EmptyState icon={Trophy} title="Noch keine Fächer" text="Lege zuerst unter „Fächer“ deine Fächer an – dann kannst du Noten eintragen." />
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <Card className="px-2 sm:px-3">
        <CardHeader
          className="px-2"
          title="Noten"
          icon={Trophy}
          subtitle={grades.length ? `${grades.length} ${grades.length === 1 ? 'Note' : 'Noten'} · Gesamtschnitt aller Fächer` : 'Trag deine erste Note ein.'}
          action={
            <Button size="sm" variant="primary" icon={Plus} onClick={() => setForm({})}>
              Note
            </Button>
          }
        />
        {overall !== null && (
          <div className="mx-2 mb-3 flex items-baseline gap-2 rounded-2xl px-4 py-3" style={{ background: alpha(gradeColor(overall), 0.1) }}>
            <span className="text-xs text-ink-muted">Ø gesamt</span>
            <span className="text-3xl font-semibold tabular" style={{ color: gradeColor(overall) }}>
              {formatGrade(overall)}
            </span>
          </div>
        )}
        <div className="divide-y divide-white/[0.04]">
          {bySubject.map(({ subject, grades: list, average }) => {
            const open = openId === subject.id;
            return (
              <div key={subject.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : subject.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left hover:bg-white/[0.03]"
                >
                  <ColorDot color={subject.color} className="h-3 w-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{subject.name}</span>
                    <span className="flex flex-wrap gap-1 pt-0.5">
                      {list.length === 0 ? (
                        <span className="text-[11px] text-ink-faint">noch keine Noten</span>
                      ) : (
                        list.slice(0, 6).map((g) => (
                          <span key={g.id} className="text-[11px] font-semibold tabular" style={{ color: gradeColor(g.value) }}>
                            {gradeLabel(g.value, school.gradeTendencyStep)}
                          </span>
                        ))
                      )}
                      {list.length > 6 && <span className="text-[11px] text-ink-faint">+{list.length - 6}</span>}
                    </span>
                  </span>
                  <span className="text-lg font-semibold tabular" style={{ color: average !== null ? gradeColor(average) : undefined }}>
                    {average !== null ? formatGrade(average) : '–'}
                  </span>
                  <ChevronDown size={16} className={cn('shrink-0 text-ink-faint transition-transform', open && 'rotate-180')} />
                </button>
                {open && (
                  <div className="space-y-1 px-2 pb-3">
                    {list.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setForm({ grade: g })}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.03]"
                      >
                        <span className="w-12 shrink-0 text-xs text-ink-muted tabular">{formatDateShort(g.date)}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {g.title || gradeTypeOf(school, g.typeId)?.name || 'Note'}
                          {g.title && <span className="text-ink-faint"> · {gradeTypeOf(school, g.typeId)?.name}</span>}
                        </span>
                        <span
                          className="flex h-8 min-w-10 items-center justify-center rounded-lg px-2 text-sm font-semibold tabular"
                          style={{ background: alpha(gradeColor(g.value), 0.15), color: gradeColor(g.value) }}
                        >
                          {gradeLabel(g.value, school.gradeTendencyStep)}
                        </span>
                      </button>
                    ))}
                    <Button size="sm" variant="ghost" icon={Plus} onClick={() => setForm({ defaults: { subjectId: subject.id } })}>
                      Note in {subject.name}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="space-y-5">
        <GradeCalculator />
        {pending.length > 0 && (
          <Card>
            <CardHeader title="Noch ohne Note" icon={ClipboardCheck} subtitle="Vergangene Tests – Note eintragen, sobald du sie hast." />
            <div className="space-y-1.5">
              {pending.slice(0, 6).map((e) => {
                const subject = subjects.find((s) => s.id === e.subjectId);
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                    <ColorDot color={subject?.color ?? '#a1a1aa'} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {subject?.name ?? 'Fach'}: {e.title}
                      <span className="text-ink-faint"> · {formatDateShort(e.date)}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setForm({ defaults: { subjectId: e.subjectId, date: e.date, title: e.title, examId: e.id, typeId: examType?.id } })}
                    >
                      Note
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {form && <GradeForm grade={form.grade} defaults={form.defaults} onClose={() => setForm(null)} />}
    </div>
  );
}

/** "Was brauche ich in der nächsten Arbeit?" */
function GradeCalculator() {
  const subjects = useAppStore((s) => s.subjects);
  const grades = useAppStore((s) => s.grades);
  const school = useAppStore((s) => s.settings.school);
  const firstWithGrades = subjects.find((s) => grades.some((g) => g.subjectId === s.id)) ?? subjects[0];
  const [subjectId, setSubjectId] = useState<ID>(firstWithGrades?.id ?? '');
  const [typeId, setTypeId] = useState<ID>(school.gradeTypes[0]?.id ?? '');
  const [target, setTarget] = useState(2.5);

  const list = grades.filter((g) => g.subjectId === subjectId);
  const current = subjectAverage(list, school);
  const result = neededGrade(list, school, { typeId }, target);
  const step = school.gradeTendencyStep;

  return (
    <Card>
      <CardHeader title="Was brauche ich?" icon={Calculator} subtitle="Welche Note in der nächsten Arbeit reicht für deinen Zielschnitt?" />
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fach">
            <SubjectSelect value={subjectId} onChange={setSubjectId} />
          </Field>
          <Field label="Nächste Note ist">
            <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {school.gradeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Zielschnitt höchstens</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {TARGETS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTarget(t)}
                aria-pressed={target === t}
                className={cn(
                  'h-9 rounded-full px-3 text-[13px] font-medium tabular transition-colors',
                  target === t ? 'bg-violet-500/90 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink',
                )}
              >
                {formatGrade(t, 1)}
              </button>
            ))}
            <NumberInput
              className="w-24"
              value={target}
              min={1}
              max={6}
              step={0.1}
              inputMode="decimal"
              aria-label="Eigener Zielschnitt"
              onChange={(v) => v > 0 && setTarget(Math.min(6, Math.max(0.7, v)))}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface/60 p-3 text-sm leading-relaxed">
          {result.status === 'reachable' && (
            <p>
              Dafür reicht eine{' '}
              <span className="text-lg font-semibold" style={{ color: gradeColor(result.option.value) }}>
                {result.option.label}
              </span>{' '}
              oder besser <span className="text-ink-muted">(genau: bis {formatGrade(result.max)}).</span>
            </p>
          )}
          {result.status === 'always' && <p className="text-emerald-200">Selbst mit einer 6 bleibt dein Schnitt im Ziel. 🎉</p>}
          {result.status === 'impossible' && (
            <p className="text-amber-200">
              Mit einer Note allein nicht mehr erreichbar – selbst mit {gradeLabel(Math.max(0.7, 1 - step), step)} käme dein Schnitt auf {formatGrade(result.best)}.
            </p>
          )}
          <p className="mt-1 text-xs text-ink-faint">
            {current !== null ? `Aktueller Schnitt: ${formatGrade(current)} aus ${list.length} ${list.length === 1 ? 'Note' : 'Noten'}.` : 'Noch keine Noten in diesem Fach.'}{' '}
            Rechnet mit den Gewichten aus Mein Alltag → Schule.
          </p>
        </div>
      </div>
    </Card>
  );
}
