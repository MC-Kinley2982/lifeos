import { useState } from 'react';
import { create } from 'zustand';
import { Timer } from 'lucide-react';
import { formatDuration } from '../../domain/time';
import type { ID } from '../../domain/types';
import { learnedHomeworkMinutes } from '../../services/school/homework';
import { subjectLabel } from '../../services/school/timetable';
import { usePlannerData } from '../../store/hooks';
import { replanSchool } from '../../store/schoolAutomation';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { NumberInput } from '../../ui/fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';

/** Welche erledigte Hausaufgabe gerade nach ihrer tatsächlichen Dauer gefragt wird (reiner UI-Zustand). */
const useAsk = create<{ id: ID | null }>(() => ({ id: null }));

const PRESETS = [10, 15, 20, 30, 45, 60, 90, 120];

/** Nach dem Erledigen fragen, wie lange es gedauert hat (wenn in den Schul-Einstellungen aktiv). */
export function askHomeworkTime(id: ID): void {
  const { school } = useAppStore.getState().settings;
  if (school.askActualHomeworkTime) useAsk.setState({ id });
}

/** Hausaufgabe abhaken bzw. wieder öffnen – beim Erledigen kommt die Frage nach der Dauer. */
export function toggleHomeworkWithTime(id: ID): void {
  const state = useAppStore.getState();
  const wasDone = state.homework.find((h) => h.id === id)?.status === 'done';
  state.toggleHomeworkDone(id);
  if (wasDone) replanSchool({ homeworkIds: [id] });
  else askHomeworkTime(id);
}

/** "Erledigt! Wie lange hat's gedauert?" – daraus lernt LifeOS die Ø-Zeit pro Fach. */
export function HomeworkTimePrompt() {
  const id = useAsk((s) => s.id);
  if (!id) return null;
  return <TimeSheet key={id} id={id} onClose={() => useAsk.setState({ id: null })} />;
}

function TimeSheet({ id, onClose }: { id: ID; onClose: () => void }) {
  const data = usePlannerData();
  const hw = data.homework.find((h) => h.id === id);
  const setActual = useAppStore((s) => s.setHomeworkActualMinutes);
  const [minutes, setMinutes] = useState<number | null>(hw?.actualMinutes ?? null);
  if (!hw) return null;
  const subject = subjectLabel(data.subjects.find((s) => s.id === hw.subjectId));
  const learned = learnedHomeworkMinutes(data, hw.subjectId);
  const presets = [...new Set([...PRESETS, hw.estimatedMinutes])].sort((a, b) => a - b);

  const save = () => {
    if (!minutes || minutes <= 0) return;
    setActual(id, minutes);
    const next = learnedHomeworkMinutes({ ...data, homework: useAppStore.getState().homework }, hw.subjectId);
    toast(next ? `Gespeichert – Ø ${subject.name}: ${formatDuration(next.minutes)}` : 'Gespeichert');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Erledigt! Wie lange hat's gedauert?"
      subtitle={`${subject.name}: ${hw.title || 'Hausaufgabe'} · geschätzt ${formatDuration(hw.estimatedMinutes)}`}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            Überspringen
          </Button>
          <Button variant="primary" className="ml-auto" icon={Timer} onClick={save} disabled={!minutes || minutes <= 0}>
            Speichern
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              aria-pressed={minutes === m}
              className={cn(
                'h-9 rounded-full px-3.5 text-[13px] font-medium tabular transition-colors',
                minutes === m ? 'bg-violet-500/90 text-white' : 'border border-line bg-surface text-ink-muted hover:text-ink',
              )}
            >
              {formatDuration(m)}
            </button>
          ))}
        </div>
        <NumberInput value={minutes ?? 0} min={1} step={5} suffix="min" onChange={(v) => setMinutes(v > 0 ? v : null)} aria-label="Minuten" />
        <p className="text-xs leading-relaxed text-ink-muted">
          Daraus lernt LifeOS, wie lange Hausaufgaben in {subject.name} wirklich dauern
          {learned ? ` (bisher Ø ${formatDuration(learned.minutes)} aus ${learned.samples})` : ''} – neue Hausaufgaben bekommen dann diese Zeit als Standard.
        </p>
      </div>
    </Sheet>
  );
}
