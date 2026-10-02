import { useState } from 'react';
import { Plus } from 'lucide-react';
import { createId } from '../../../domain/ids';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../ui/Button';
import { ColorPicker, DeleteButton } from '../../../ui/controls';
import { Select, TextInput } from '../../../ui/fields';
import { DynamicIcon, ICON_KEYS } from '../../../ui/icons';
import { SettingsGroup } from '../SettingsLayout';

export function CategoriesSection() {
  const categories = useAppStore((s) => s.settings.categories);
  const { addCategory, updateCategory, removeCategory } = useAppStore.getState();
  const [colorFor, setColorFor] = useState<string | null>(null);

  return (
    <SettingsGroup
      title="Kategorien"
      description="Kategorien färben Routinen, Termine und Aufgaben und werden von Zustands-, Pausen- und Energie-Regeln genutzt. Beim Löschen werden Einträge der ersten anderen Kategorie zugeordnet."
      action={
        <Button size="sm" icon={Plus} onClick={() => addCategory({ id: createId('cat'), name: 'Neue Kategorie', color: '#22d3ee', icon: 'circle' })}>
          Kategorie
        </Button>
      }
    >
      <div className="divide-y divide-white/[0.04]">
        {categories.map((c) => (
          <div key={c.id} className="py-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Farbe ändern"
                onClick={() => setColorFor(colorFor === c.id ? null : c.id)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: c.color }}
              >
                <DynamicIcon name={c.icon} size={16} className="text-black/70" />
              </button>
              <TextInput value={c.name} onChange={(e) => updateCategory(c.id, { name: e.target.value })} />
              <Select className="hidden w-36 sm:block" value={c.icon} onChange={(e) => updateCategory(c.id, { icon: e.target.value })}>
                {ICON_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
              {categories.length > 1 && <DeleteButton label="" onConfirm={() => removeCategory(c.id)} />}
            </div>
            {colorFor === c.id && (
              <div className="mt-2 pl-12">
                <ColorPicker value={c.color} onChange={(color) => updateCategory(c.id, { color })} />
              </div>
            )}
          </div>
        ))}
      </div>
    </SettingsGroup>
  );
}
