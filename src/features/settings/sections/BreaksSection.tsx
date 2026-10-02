import { Plus } from 'lucide-react';
import { createId } from '../../../domain/ids';
import { mealSource, routineSource } from '../../../domain/sources';
import type { BreakRule, BreakTrigger } from '../../../domain/types';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../ui/Button';
import { DeleteButton, Toggle } from '../../../ui/controls';
import { Field, NumberInput, Select, TextInput } from '../../../ui/fields';
import { ItemBox, SettingsGroup } from '../SettingsLayout';

export function BreaksSection() {
  const rules = useAppStore((s) => s.settings.breakRules);
  const routines = useAppStore((s) => s.routines);
  const meals = useAppStore((s) => s.settings.meals);
  const categories = useAppStore((s) => s.settings.categories);
  const { addBreakRule, updateBreakRule, removeBreakRule } = useAppStore.getState();

  const sources = [
    ...routines.map((r) => ({ key: routineSource(r.id), label: `Routine: ${r.name}` })),
    ...meals.map((m) => ({ key: mealSource(m.id), label: `Mahlzeit: ${m.name}` })),
  ];

  const changeType = (rule: BreakRule, type: BreakTrigger['type']) => {
    const trigger: BreakTrigger =
      type === 'afterSource'
        ? { type, sourceKey: sources[0]?.key ?? '' }
        : type === 'afterCategory'
          ? { type, categoryId: categories[0]?.id ?? '' }
          : { type, minBlockMin: 120 };
    updateBreakRule(rule.id, { trigger });
  };

  return (
    <SettingsGroup
      title="Pausen-Regeln"
      description="Pausen werden automatisch nach passenden Blöcken eingefügt (nach einem evtl. Rückweg) und blockieren freie Zeit. Treffen mehrere Regeln zusammen, gilt die längste Pause."
      action={
        <Button size="sm" icon={Plus} onClick={() => addBreakRule({ id: createId('br'), name: 'Pause', enabled: true, durationMin: 15, trigger: { type: 'afterLongBlock', minBlockMin: 120 } })}>
          Regel
        </Button>
      }
    >
      <div className="space-y-3">
        {rules.length === 0 && <p className="text-sm text-ink-muted">Keine Pausen-Regeln.</p>}
        {rules.map((rule) => (
          <ItemBox key={rule.id} muted={!rule.enabled}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <TextInput value={rule.name} onChange={(e) => updateBreakRule(rule.id, { name: e.target.value })} />
              </Field>
              <Field label="Dauer">
                <NumberInput value={rule.durationMin} min={5} step={5} onChange={(v) => updateBreakRule(rule.id, { durationMin: v })} suffix="min" />
              </Field>
              <Field label="Wann?">
                <Select value={rule.trigger.type} onChange={(e) => changeType(rule, e.target.value as BreakTrigger['type'])}>
                  <option value="afterSource">Nach einer bestimmten Routine/Mahlzeit</option>
                  <option value="afterCategory">Nach einer Kategorie</option>
                  <option value="afterLongBlock">Nach jedem langen Block</option>
                </Select>
              </Field>
              {rule.trigger.type === 'afterSource' && (
                <Field label="Nach">
                  <Select value={rule.trigger.sourceKey} onChange={(e) => updateBreakRule(rule.id, { trigger: { type: 'afterSource', sourceKey: e.target.value } })}>
                    {sources.length === 0 && <option value="">Keine Routinen vorhanden</option>}
                    {sources.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {rule.trigger.type === 'afterCategory' && (
                <Field label="Kategorie">
                  <Select value={rule.trigger.categoryId} onChange={(e) => updateBreakRule(rule.id, { trigger: { type: 'afterCategory', categoryId: e.target.value } })}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {rule.trigger.type === 'afterLongBlock' && (
                <Field label="Block länger als">
                  <NumberInput value={rule.trigger.minBlockMin} min={15} step={15} onChange={(v) => updateBreakRule(rule.id, { trigger: { type: 'afterLongBlock', minBlockMin: v } })} suffix="min" />
                </Field>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <Toggle checked={rule.enabled} onChange={(v) => updateBreakRule(rule.id, { enabled: v })} />
                {rule.enabled ? 'Aktiv' : 'Deaktiviert'}
              </div>
              <DeleteButton onConfirm={() => removeBreakRule(rule.id)} />
            </div>
          </ItemBox>
        ))}
      </div>
    </SettingsGroup>
  );
}
