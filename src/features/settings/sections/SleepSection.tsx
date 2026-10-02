import { formatDuration, orderedWeekdays, toMinutes, WEEKDAY_LONG } from '../../../domain/time';
import type { SleepTimes } from '../../../domain/types';
import { useAppStore } from '../../../store/useAppStore';
import { Toggle } from '../../../ui/controls';
import { Field, TimeInput } from '../../../ui/fields';
import { SettingsGroup } from '../SettingsLayout';

function sleepDuration(t: SleepTimes, nextWake: string): string {
  const bed = toMinutes(t.bedtime);
  const bedAbs = bed < 12 * 60 ? bed + 24 * 60 : bed;
  return formatDuration(24 * 60 + toMinutes(nextWake) - bedAbs);
}

export function SleepSection() {
  const sleep = useAppStore((s) => s.settings.sleep);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const { updateSleep, setSleepOverride } = useAppStore.getState();

  return (
    <div className="space-y-4">
      <SettingsGroup title="Schlafenszeiten" description="Schlaf wird als blockierte Zeit behandelt. Eine Schlafenszeit vor 12:00 bedeutet „nach Mitternacht“.">
        <Toggle checked={sleep.enabled} onChange={(v) => updateSleep({ enabled: v })} label="Schlaf berücksichtigen" />
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Field label="Aufstehen (Standard)">
            <TimeInput value={sleep.default.wakeTime} onChange={(v) => updateSleep({ default: { ...sleep.default, wakeTime: v } })} />
          </Field>
          <Field label="Schlafenszeit (Standard)">
            <TimeInput value={sleep.default.bedtime} onChange={(v) => updateSleep({ default: { ...sleep.default, bedtime: v } })} />
          </Field>
        </div>
        <p className="mt-2 text-xs text-ink-faint">≈ {sleepDuration(sleep.default, sleep.default.wakeTime)} Schlaf pro Nacht</p>
      </SettingsGroup>

      <SettingsGroup title="Abweichungen pro Wochentag" description="Z. B. am Wochenende später aufstehen oder freitags länger wach bleiben.">
        <div className="divide-y divide-white/[0.04]">
          {orderedWeekdays(weekStartsOn).map((d) => {
            const override = sleep.perWeekday[d];
            return (
              <div key={d} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{WEEKDAY_LONG[d]}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-faint">{override ? 'eigene Zeiten' : `${sleep.default.wakeTime} – ${sleep.default.bedtime}`}</span>
                    <Toggle checked={!!override} onChange={(v) => setSleepOverride(d, v ? { ...sleep.default } : null)} />
                  </div>
                </div>
                {override && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <Field label="Aufstehen">
                      <TimeInput value={override.wakeTime} onChange={(v) => setSleepOverride(d, { ...override, wakeTime: v })} />
                    </Field>
                    <Field label="Schlafenszeit">
                      <TimeInput value={override.bedtime} onChange={(v) => setSleepOverride(d, { ...override, bedtime: v })} />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingsGroup>
    </div>
  );
}
