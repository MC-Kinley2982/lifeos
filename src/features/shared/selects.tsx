import { useAppStore } from '../../store/useAppStore';
import { Select } from '../../ui/fields';

export function CategorySelect({ value, onChange }: { value: string; onChange: (id: string, color: string) => void }) {
  const categories = useAppStore((s) => s.settings.categories);
  return (
    <Select
      value={value}
      onChange={(e) => {
        const cat = categories.find((c) => c.id === e.target.value);
        onChange(e.target.value, cat?.color ?? '#a1a1aa');
      }}
    >
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}

export function GoalSelect({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) {
  const goals = useAppStore((s) => s.goals);
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">Kein Ziel</option>
      {goals.map((g) => (
        <option key={g.id} value={g.id}>
          {g.title}
        </option>
      ))}
    </Select>
  );
}

export function DayStateSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const states = useAppStore((s) => s.settings.dayStates);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {states.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
