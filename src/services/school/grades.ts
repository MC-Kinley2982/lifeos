import type { Exam, Grade, GradeType, ID, SchoolSettings, Subject } from '../../domain/types';

/**
 * Noten (deutsche Skala 1–6) – reine Logik: Schnitt pro Fach, Gesamtschnitt und
 * "Was brauche ich in der nächsten Arbeit?". Gewichte und Plus/Minus kommen aus den Schul-Einstellungen.
 */

type GradeSettings = Pick<SchoolSettings, 'gradeTypes' | 'gradeAverageMode' | 'gradeTendencyStep'>;
/** Eine (auch gedachte) Note – für den Rechner reicht Wert, Art und Gewicht. */
type GradeLike = Pick<Grade, 'value' | 'typeId' | 'weight'>;

export const BEST_GRADE = 1;
export const WORST_GRADE = 6;
const EPS = 1e-9;

export function gradeTypeOf(settings: GradeSettings, typeId: ID): GradeType | undefined {
  return settings.gradeTypes.find((t) => t.id === typeId);
}

/** Gewicht einer Note im Modus "weighted": eigenes Gewicht, sonst das der Notenart, sonst 1. */
export function gradeWeight(grade: GradeLike, settings: GradeSettings): number {
  return Math.max(0, grade.weight ?? gradeTypeOf(settings, grade.typeId)?.weight ?? 1);
}

/** Schnitt eines Fachs (null ohne Noten). */
export function subjectAverage(grades: GradeLike[], settings: GradeSettings): number | null {
  if (grades.length === 0) return null;
  if (settings.gradeAverageMode === 'byType') {
    // Erst Durchschnitt je Notenart (eigenes Gewicht wirkt innerhalb der Art), dann Arten nach Anteil.
    const byType = new Map<ID, GradeLike[]>();
    for (const g of grades) byType.set(g.typeId, [...(byType.get(g.typeId) ?? []), g]);
    let sum = 0;
    let shares = 0;
    for (const [typeId, list] of byType) {
      const avg = weightedMean(list.map((g) => [g.value, Math.max(0, g.weight ?? 1)]));
      if (avg === null) continue;
      const share = Math.max(0, gradeTypeOf(settings, typeId)?.weight ?? 1);
      sum += avg * share;
      shares += share;
    }
    return shares > 0 ? sum / shares : null;
  }
  return weightedMean(grades.map((g) => [g.value, gradeWeight(g, settings)]));
}

function weightedMean(pairs: Array<[number, number]>): number | null {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  return pairs.reduce((s, [v, w]) => s + v * w, 0) / total;
}

export interface SubjectGrades {
  subject: Subject;
  grades: Grade[];
  average: number | null;
}

/** Noten nach Fach (neueste zuerst) mit Schnitt; Fächer ohne Noten kommen ans Ende. */
export function gradesBySubject(subjects: Subject[], grades: Grade[], settings: GradeSettings): SubjectGrades[] {
  return subjects
    .map((subject) => {
      const list = grades.filter((g) => g.subjectId === subject.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      return { subject, grades: list, average: subjectAverage(list, settings) };
    })
    .sort((a, b) => Number(a.average === null) - Number(b.average === null));
}

/** Gesamtschnitt = Mittel der Fachschnitte (jedes Fach zählt gleich). */
export function overallAverage(bySubject: SubjectGrades[]): number | null {
  const avgs = bySubject.map((s) => s.average).filter((a): a is number => a !== null);
  return avgs.length ? avgs.reduce((s, a) => s + a, 0) / avgs.length : null;
}

// ─── Plus/Minus ──────────────────────────────────────────────

export interface GradeOption {
  value: number;
  label: string;
}

/** Alle wählbaren Noten: 1+ 1 1- 2+ … 5- 6+ 6 (Abstand laut Einstellung, z. B. 0,3). */
export function gradeOptions(step: number): GradeOption[] {
  const s = Math.min(0.5, Math.max(0, step));
  const out: GradeOption[] = [];
  for (let base = BEST_GRADE; base <= WORST_GRADE; base++) {
    if (s > 0) out.push({ value: round2(base - s), label: `${base}+` });
    out.push({ value: base, label: String(base) });
    if (s > 0 && base < WORST_GRADE) out.push({ value: round2(base + s), label: `${base}-` });
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 2,3 → "2-" (bei Schritt 0,3), sonst die Zahl mit Komma. */
export function gradeLabel(value: number, step: number): string {
  const match = gradeOptions(step).find((o) => Math.abs(o.value - value) < 0.005);
  return match ? match.label : formatGrade(value);
}

/** 2.345 → "2,35" (Schnitte), 2 → "2,0". */
export function formatGrade(value: number, digits = 2): string {
  const fixed = value.toFixed(digits);
  return (digits > 1 ? fixed.replace(/0$/, '') : fixed).replace('.', ',');
}

/** Farbe je nach Note (grün = gut, rot = schlecht). */
export function gradeColor(value: number): string {
  if (value < 1.75) return '#34d399';
  if (value < 2.75) return '#a3e635';
  if (value < 3.75) return '#fbbf24';
  if (value < 4.75) return '#fb923c';
  return '#f87171';
}

// ─── Rechner: Was brauche ich? ───────────────────────────────

export type NeededGrade =
  /** Mit dieser Note oder besser wird das Ziel erreicht. */
  | { status: 'reachable'; max: number; option: GradeOption; current: number | null }
  /** Selbst mit einer 6 bleibt der Schnitt im Ziel. */
  | { status: 'always'; current: number | null }
  /** Selbst mit der besten Note nicht erreichbar – `best` ist der dann mögliche Schnitt. */
  | { status: 'impossible'; best: number; current: number | null };

/**
 * Welche Note brauche ich in der nächsten Arbeit (Art + optional eigenes Gewicht),
 * damit der Fachschnitt höchstens `target` ist? Der Schnitt hängt linear von der neuen Note ab,
 * daher genügt es, ihn für zwei Werte auszurechnen.
 */
export function neededGrade(grades: GradeLike[], settings: GradeSettings, next: { typeId: ID; weight?: number }, target: number): NeededGrade {
  const current = subjectAverage(grades, settings);
  const avgWith = (x: number) => subjectAverage([...grades, { value: x, typeId: next.typeId, weight: next.weight }], settings) ?? x;
  const options = gradeOptions(settings.gradeTendencyStep);
  const bestValue = options[0].value;
  if (avgWith(WORST_GRADE) <= target + EPS) return { status: 'always', current };
  const a = avgWith(0);
  const slope = avgWith(1) - a;
  if (slope <= EPS) return { status: 'impossible', best: avgWith(bestValue), current };
  const max = (target - a) / slope;
  const option = [...options].reverse().find((o) => o.value <= max + EPS);
  if (!option) return { status: 'impossible', best: avgWith(bestValue), current };
  return { status: 'reachable', max, option, current };
}

/** Vergangene Tests (ab `fromDate`), für die noch keine Note eingetragen ist – neueste zuerst. */
export function examsWithoutGrade(exams: Exam[], grades: Grade[], today: string, fromDate: string): Exam[] {
  const graded = new Set(grades.map((g) => g.examId).filter(Boolean));
  return exams.filter((e) => e.date < today && e.date >= fromDate && !graded.has(e.id)).sort((a, b) => b.date.localeCompare(a.date));
}
