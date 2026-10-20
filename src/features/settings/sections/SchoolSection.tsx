import { Plus, Trash } from 'lucide-react';
import { createId } from '../../../domain/ids';
import { PRIORITY_LABEL } from '../../../domain/labels';
import type { Priority } from '../../../domain/types';
import { replanSchool } from '../../../store/schoolAutomation';
import { useAppStore } from '../../../store/useAppStore';
import { Button, IconButton } from '../../../ui/Button';
import { Segmented, Toggle } from '../../../ui/controls';
import { NumberInput, Select, TextInput } from '../../../ui/fields';
import { SettingRow, SettingsGroup } from '../SettingsLayout';

export function SchoolSection() {
  const school = useAppStore((s) => s.settings.school);
  const routines = useAppStore((s) => s.routines);
  const categories = useAppStore((s) => s.settings.categories);
  const updateSchoolSettings = useAppStore((s) => s.updateSchoolSettings);
  const grades = useAppStore((s) => s.grades);

  return (
    <div className="space-y-4">
      <SettingsGroup title="Schule" description="Stundenplan, Hausaufgaben und Tests. Ausgeschaltet bleiben alle Daten erhalten.">
        <Toggle checked={school.enabled} onChange={(v) => updateSchoolSettings({ enabled: v })} label="Schulfunktionen aktiv" />
      </SettingsGroup>

      <SettingsGroup
        title="Schulzeit"
        description="An Tagen mit Stundenplan übernimmt die Schulzeit die Regeln einer Routine (Schulweg, Pause danach, Krank/Ferien, Energie). Ohne Verknüpfung gelten die Werte unten."
      >
        <SettingRow label="Verknüpfte Routine" description="Ihre Uhrzeiten kommen an Schultagen aus dem Stundenplan.">
          <Select value={school.linkedRoutineId ?? ''} onChange={(e) => updateSchoolSettings({ linkedRoutineId: e.target.value || undefined })}>
            <option value="">Keine</option>
            {routines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </SettingRow>
        {!school.linkedRoutineId && (
          <>
            <SettingRow label="Kategorie der Schulzeit" description="Für Krank-/Ferien-Regeln und Energie.">
              <Select value={school.categoryId} onChange={(e) => updateSchoolSettings({ categoryId: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </SettingRow>
            <SettingRow label="Schulweg hin">
              <NumberInput value={school.travelBeforeMin} min={0} step={5} suffix="min" onChange={(v) => updateSchoolSettings({ travelBeforeMin: v })} />
            </SettingRow>
            <SettingRow label="Schulweg zurück">
              <NumberInput value={school.travelAfterMin} min={0} step={5} suffix="min" onChange={(v) => updateSchoolSettings({ travelAfterMin: v })} />
            </SettingRow>
          </>
        )}
      </SettingsGroup>

      <SettingsGroup title="Hausaufgaben">
        <SettingRow label="Durchschnittliche Hausaufgabenzeit" description="Standard für neue Hausaufgaben – pro Fach überschreibbar.">
          <NumberInput value={school.defaultHomeworkMinutes} min={5} step={5} suffix="min" onChange={(v) => updateSchoolSettings({ defaultHomeworkMinutes: Math.max(5, v) })} />
        </SettingRow>
        <SettingRow label="Standard-Priorität">
          <Segmented<Priority>
            size="sm"
            value={school.defaultHomeworkPriority}
            onChange={(v) => updateSchoolSettings({ defaultHomeworkPriority: v })}
            options={(['low', 'medium', 'high'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
          />
        </SettingRow>
        <Toggle
          checked={school.askForHomework}
          onChange={(v) => updateSchoolSettings({ askForHomework: v })}
          label="Nach der Schule nachfragen"
          description="„Welche Hausaufgaben hast du heute bekommen?“ – höchstens einmal pro Tag."
        />
        <SettingRow label="Frist, wenn keine nächste Stunde gefunden wird">
          <NumberInput value={school.fallbackDeadlineDays} min={1} suffix="Tage" onChange={(v) => updateSchoolSettings({ fallbackDeadlineDays: Math.max(1, v) })} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup
        title="Hausaufgabenzeit lernen"
        description="Trägst du nach dem Erledigen ein, wie lange du gebraucht hast, wird der Durchschnitt pro Fach zum Standard für neue Hausaufgaben. Der Wert im Fach (bzw. oben) gilt nur, bis genug Werte da sind."
      >
        <Toggle checked={school.learnHomeworkTime} onChange={(v) => updateSchoolSettings({ learnHomeworkTime: v })} label="Zeit pro Fach lernen" />
        <Toggle
          checked={school.askActualHomeworkTime}
          onChange={(v) => updateSchoolSettings({ askActualHomeworkTime: v })}
          label="Nach dem Erledigen fragen"
          description="„Wie lange hat's gedauert?“ – überspringen ist jederzeit möglich."
        />
        {school.learnHomeworkTime && (
          <>
            <SettingRow label="Durchschnitt aus den letzten" description="Hausaufgaben des Fachs (gleitender Durchschnitt).">
              <NumberInput value={school.homeworkLearnSamples} min={1} max={50} suffix="Stück" onChange={(v) => updateSchoolSettings({ homeworkLearnSamples: Math.max(1, Math.min(50, v)) })} />
            </SettingRow>
            <SettingRow label="Gelernten Wert nutzen ab" description="So viele eingetragene Zeiten braucht es mindestens.">
              <NumberInput value={school.homeworkLearnMinSamples} min={1} max={20} suffix="Werten" onChange={(v) => updateSchoolSettings({ homeworkLearnMinSamples: Math.max(1, Math.min(20, v)) })} />
            </SettingRow>
          </>
        )}
      </SettingsGroup>

      <SettingsGroup title="Automatische Planung" description="Hausaufgaben und Lernzeit werden vor ihrer Deadline in freie Zeit gelegt. Manuell verschobene Blöcke bleiben, wo du sie hingelegt hast.">
        <Toggle checked={school.autoPlan} onChange={(v) => updateSchoolSettings({ autoPlan: v })} label="Automatisch einplanen" />
        <Toggle
          checked={school.allowSplitHomework}
          onChange={(v) => updateSchoolSettings({ allowSplitHomework: v })}
          label="Hausaufgaben aufteilen erlaubt"
          description="Passt eine Aufgabe nicht am Stück, wird sie auf mehrere Blöcke verteilt."
        />
        <SettingRow label="Kleinster Block">
          <NumberInput value={school.minBlockMin} min={5} step={5} suffix="min" onChange={(v) => updateSchoolSettings({ minBlockMin: Math.max(5, v) })} />
        </SettingRow>
        <SettingRow label="Höchstens für Schule verplanen" description={`${Math.round(school.maxSchoolShare * 100)} % der freien Zeit (Freizeit-Schutz; allgemeiner Anteil siehe „Planung“)`}>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(school.maxSchoolShare * 100)}
            onChange={(e) => updateSchoolSettings({ maxSchoolShare: Number(e.target.value) / 100 })}
            className="w-full accent-violet-500"
          />
        </SettingRow>
        <SettingRow label="Arbeitsblöcke gehören zu Kategorie" description="Farbe & Energie-Regeln für Hausaufgaben/Lernen.">
          <Select value={school.workCategoryId} onChange={(e) => updateSchoolSettings({ workCategoryId: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Tests & Lernzeit">
        <SettingRow label="Standard-Lernzeit pro Test">
          <NumberInput value={school.defaultStudyMinutes} min={0} step={15} suffix="min" onChange={(v) => updateSchoolSettings({ defaultStudyMinutes: v })} />
        </SettingRow>
        <SettingRow label="Mit dem Lernen beginnen" description="So viele Tage vor dem Test (pro Test änderbar).">
          <NumberInput value={school.defaultStudyLeadDays} min={1} suffix="Tage" onChange={(v) => updateSchoolSettings({ defaultStudyLeadDays: Math.max(1, v) })} />
        </SettingRow>
        <SettingRow label="Lerneinheit">
          <NumberInput value={school.defaultStudySessionMin} min={15} step={15} suffix="min" onChange={(v) => updateSchoolSettings({ defaultStudySessionMin: Math.max(15, v) })} />
        </SettingRow>
        <SettingRow label="Höchstens pro Tag und Test">
          <NumberInput value={school.maxStudyMinPerDay} min={15} step={15} suffix="min" onChange={(v) => updateSchoolSettings({ maxStudyMinPerDay: Math.max(15, v) })} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup
        title="Noten"
        description="Wie dein Schnitt berechnet wird. Schulen rechnen unterschiedlich – stell es so ein, wie es bei dir gilt."
        action={
          <Button
            size="sm"
            variant="secondary"
            icon={Plus}
            onClick={() => updateSchoolSettings({ gradeTypes: [...school.gradeTypes, { id: createId('gt'), name: 'Neue Art', weight: 1 }] })}
          >
            Art
          </Button>
        }
      >
        <SettingRow
          label="Berechnung"
          description={
            school.gradeAverageMode === 'weighted'
              ? 'Jede Note zählt mit dem Gewicht ihrer Art (z. B. Klassenarbeit doppelt).'
              : 'Erst Schnitt je Art, dann die Arten nach Anteil (z. B. schriftlich 50 / mündlich 50).'
          }
        >
          <Segmented<'weighted' | 'byType'>
            size="sm"
            value={school.gradeAverageMode}
            onChange={(v) => updateSchoolSettings({ gradeAverageMode: v })}
            options={[
              { value: 'weighted', label: 'Gewichtet' },
              { value: 'byType', label: 'Nach Art' },
            ]}
          />
        </SettingRow>
        <SettingRow label="Plus/Minus" description="So viel ist ein „+“ bzw. „−“ wert (2- = 2 + Wert).">
          <Select value={String(school.gradeTendencyStep)} onChange={(e) => updateSchoolSettings({ gradeTendencyStep: Number(e.target.value) })}>
            {[0.25, 0.3, 0.33, 0.5].map((v) => (
              <option key={v} value={v}>
                {String(v).replace('.', ',')}
              </option>
            ))}
            <option value={0}>Ohne Plus/Minus</option>
          </Select>
        </SettingRow>
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_110px_40px] gap-2 px-1 text-[11px] font-medium text-ink-faint">
            <span>Notenart</span>
            <span>{school.gradeAverageMode === 'weighted' ? 'Gewicht' : 'Anteil'}</span>
          </div>
          {school.gradeTypes.map((t) => (
            <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_110px_40px] items-center gap-2">
              <TextInput
                value={t.name}
                aria-label="Name der Notenart"
                onChange={(e) => updateSchoolSettings({ gradeTypes: school.gradeTypes.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)) })}
              />
              <NumberInput
                value={t.weight}
                min={0}
                step={school.gradeAverageMode === 'weighted' ? 0.5 : 5}
                inputMode="decimal"
                aria-label="Gewicht"
                onChange={(v) => updateSchoolSettings({ gradeTypes: school.gradeTypes.map((x) => (x.id === t.id ? { ...x, weight: Math.max(0, v) } : x)) })}
              />
              <IconButton
                icon={Trash}
                label="Notenart entfernen"
                size="sm"
                disabled={school.gradeTypes.length <= 1 || grades.some((g) => g.typeId === t.id)}
                title={grades.some((g) => g.typeId === t.id) ? 'Wird von Noten verwendet' : 'Notenart entfernen'}
                onClick={() => updateSchoolSettings({ gradeTypes: school.gradeTypes.filter((x) => x.id !== t.id) })}
              />
            </div>
          ))}
        </div>
      </SettingsGroup>

      <button
        type="button"
        onClick={() => replanSchool({ reset: true }, true)}
        className="px-1 text-xs text-violet-300 hover:underline"
      >
        Alle Hausaufgaben und Lernzeiten jetzt neu planen
      </button>
    </div>
  );
}
