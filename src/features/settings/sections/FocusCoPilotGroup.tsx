import { Copy, Monitor } from 'lucide-react';
import { formatDateShort } from '../../../domain/time';
import { SUPABASE_KEY, SUPABASE_URL } from '../../../services/cloud/config';
import { useCloud } from '../../../store/cloud';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../ui/Button';
import { toast } from '../../../ui/toast';
import { SettingRow, SettingsGroup } from '../SettingsLayout';

/** Anbindung an den Focus Co-Pilot (Rechnerzeit): Status der empfangenen Tage und Verbindungsdaten für den Co-Pilot. */
export function FocusCoPilotGroup() {
  const mode = useCloud((s) => s.mode);
  const signedIn = useCloud((s) => !!s.session);
  const focusDays = useAppStore((s) => s.focusDays);
  if (mode === 'off') return null;

  const latest = focusDays.reduce<string | undefined>((max, d) => (!max || d.date > max ? d.date : max), undefined);
  const canCopy = mode === 'supabase' && !!SUPABASE_URL && !!SUPABASE_KEY;

  const copy = async () => {
    // URL und Publishable Key stehen ohnehin in der öffentlichen Web-App – es sind keine Geheimnisse (das Passwort nie).
    const text = JSON.stringify({ url: SUPABASE_URL, key: SUPABASE_KEY });
    try {
      await navigator.clipboard.writeText(text);
      toast('Verbindungsdaten kopiert – jetzt im Focus Co-Pilot einfügen');
    } catch {
      toast('Kopieren hat nicht geklappt – bitte Zugriff auf die Zwischenablage erlauben.', 'info');
    }
  };

  return (
    <SettingsGroup
      title="Focus Co-Pilot (Rechnerzeit)"
      description="Der Focus Co-Pilot meldet, wie lange du am Rechner z. B. in Blender oder beim Schach warst. Das zählt automatisch auf deine Ziele und erscheint im Rückblick – ohne dass du etwas einträgst."
    >
      <SettingRow label="Empfangen" description={latest ? 'Zuletzt erfasster Tag' : 'Noch nichts angekommen'}>
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted tabular">
          <Monitor size={14} className="text-sky-300" />
          {focusDays.length ? `${focusDays.length} ${focusDays.length === 1 ? 'Tag' : 'Tage'} · bis ${formatDateShort(latest!)}` : '–'}
        </span>
      </SettingRow>
      {!focusDays.length && (
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-ink-muted">
          <li>Hier „Verbindungsdaten kopieren“ wählen.</li>
          <li>Im Focus Co-Pilot unter Einstellungen → LifeOS einfügen und mit deinem LifeOS-Konto (E-Mail + Passwort) verbinden.</li>
          <li>Bei einem Ziel unter „Automatisch vom Rechner zählen“ eintragen, welche Gruppe oder App für das Ziel zählt.</li>
        </ol>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button icon={Copy} disabled={!canCopy || !signedIn} onClick={() => void copy()}>
          Verbindungsdaten kopieren
        </Button>
      </div>
      {!signedIn && <p className="mt-2 text-[11px] text-ink-faint">Melde dich zuerst an – der Co-Pilot braucht dasselbe Konto wie LifeOS.</p>}
      <p className="mt-3 text-[11px] text-ink-faint">
        Übertragen werden nur Minuten pro Gruppe bzw. App/Website und Tag – keine Fenstertitel, Adressen oder Verlauf. Dein Passwort bleibt auf dem Rechner (der Co-Pilot speichert nur ein verschlüsseltes Anmelde-Token).
      </p>
    </SettingsGroup>
  );
}
