import { useState } from 'react';
import { Plus } from 'lucide-react';
import { taskDraft, type TaskInput } from '../../domain/factories';
import { useAppStore } from '../../store/useAppStore';

/** Schnelles Hinzufügen: Titel tippen, Enter. Details später im Formular. */
export function QuickAddTask({ placeholder, defaults }: { placeholder: string; defaults?: Partial<TaskInput> }) {
  const [title, setTitle] = useState('');
  const settings = useAppStore((s) => s.settings);
  const addTask = useAppStore((s) => s.addTask);

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    addTask(taskDraft(settings, { ...defaults, title: t }));
    setTitle('');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-2 rounded-2xl border border-dashed border-line-strong px-3 transition-colors focus-within:border-violet-400/50 focus-within:bg-white/[0.02]"
    >
      <Plus size={16} className="shrink-0 text-ink-faint" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        className="h-11 min-w-0 flex-1 bg-transparent text-sm placeholder:text-ink-faint focus:outline-none"
        aria-label={placeholder}
      />
      {title.trim() && (
        <button type="submit" className="rounded-lg bg-violet-500 px-2.5 py-1 text-xs font-medium text-white">
          Hinzufügen
        </button>
      )}
    </form>
  );
}
