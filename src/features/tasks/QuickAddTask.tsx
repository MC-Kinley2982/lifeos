import { useState } from 'react';
import { Plus } from 'lucide-react';
import { taskDraft, type TaskInput } from '../../domain/factories';
import { addDays } from '../../domain/time';
import type { QuickParse, QuickTokenKind } from '../../services/nlp/quickAdd';
import { useToday } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { QuickParseChips, useQuickParse } from '../shared/QuickParseChips';

/** Was die Texterkennung bei Aufgaben auswertet (Wiederholungen gibt es nur bei To-dos). */
const TASK_KINDS: QuickTokenKind[] = ['date', 'time', 'duration', 'priority', 'timeOfDay'];

/** Erkannte Angaben → Aufgabe: Tag (+ Uhrzeit = fester Block) bzw. "bis …" als Deadline, Dauer, Priorität, Tageszeit. */
function taskFields(parse: QuickParse | null): Partial<TaskInput> {
  if (!parse) return {};
  const out: Partial<TaskInput> = { title: parse.title };
  if (parse.horizon === 'day' && parse.date) {
    if (parse.deadline) out.deadline = parse.date;
    else out.schedule = { date: parse.date, ...(parse.time ? { start: parse.time } : {}) };
  } else if (parse.horizon === 'week' && parse.date) {
    out.deadline = addDays(parse.date, 6);
  }
  if (parse.durationMin) out.estimatedMin = parse.durationMin;
  if (parse.priority) out.priority = parse.priority;
  if (parse.timeOfDay) out.preferredTimeOfDay = parse.timeOfDay;
  return out;
}

/** Schnelles Hinzufügen: Titel tippen, Enter. Details später im Formular – "morgen 17 Uhr 45 min" wird erkannt. */
export function QuickAddTask({ placeholder, defaults }: { placeholder: string; defaults?: Partial<TaskInput> }) {
  const [title, setTitle] = useState('');
  const settings = useAppStore((s) => s.settings);
  const addTask = useAppStore((s) => s.addTask);
  const quick = useQuickParse(title, useToday(), TASK_KINDS);

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    addTask(taskDraft(settings, { ...defaults, title: t, ...taskFields(quick.parse) }));
    setTitle('');
    quick.reset();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-line-strong px-3 transition-colors focus-within:border-violet-400/50 focus-within:bg-white/[0.02]">
        <Plus size={16} className="shrink-0 text-ink-faint" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 bg-transparent text-base placeholder:text-ink-faint focus:outline-none sm:text-sm"
          aria-label={placeholder}
          autoComplete="off"
        />
        {title.trim() && (
          <button type="submit" className="rounded-lg bg-violet-500 px-2.5 py-1 text-xs font-medium text-white">
            Hinzufügen
          </button>
        )}
      </div>
      <QuickParseChips className="mt-2 px-1" parse={quick.parse} ignored={quick.ignored} onToggle={quick.toggle} />
    </form>
  );
}
