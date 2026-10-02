import type { Weekday } from '../../../domain/types';
import { useAppStore } from '../../../store/useAppStore';
import { Segmented } from '../../../ui/controls';
import { TextInput } from '../../../ui/fields';
import { SettingRow, SettingsGroup } from '../SettingsLayout';

export function ProfileSection() {
  const profile = useAppStore((s) => s.settings.profile);
  const ui = useAppStore((s) => s.settings.ui);
  const { updateProfile, updateUi } = useAppStore.getState();

  return (
    <div className="space-y-4">
      <SettingsGroup title="Profil">
        <SettingRow label="Name" description="Wird für die Begrüßung verwendet.">
          <TextInput value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} placeholder="Dein Name" />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Allgemein">
        <SettingRow label="Woche beginnt am" description="Für Wochenansicht und Wochenziele.">
          <Segmented<Weekday>
            value={ui.weekStartsOn}
            onChange={(v) => updateUi({ weekStartsOn: v })}
            options={[
              { value: 0, label: 'Montag' },
              { value: 6, label: 'Sonntag' },
            ]}
          />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
