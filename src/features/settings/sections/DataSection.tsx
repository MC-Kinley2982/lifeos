import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { todayKey } from '../../../domain/time';
import { isStorageAvailable, STORAGE_KEY } from '../../../services/storage/storage';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../ui/Button';
import { DeleteButton } from '../../../ui/controls';
import { toast } from '../../../ui/toast';
import { SettingRow, SettingsGroup } from '../SettingsLayout';

function storageSize(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '';
    const kb = new Blob([raw]).size / 1024;
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
  } catch {
    return 'unbekannt';
  }
}

export function DataSection() {
  const { exportData, importData, resetAll, completeOnboarding } = useAppStore.getState();
  const name = useAppStore((s) => s.settings.profile.name);
  const counts = useAppStore(useShallow((s) => ({ r: s.routines.length, t: s.tasks.length, e: s.events.length, g: s.goals.length })));
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const available = isStorageAvailable();

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup erstellt');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const result = importData(await file.text());
    if (result.ok) {
      setError(null);
      toast('Daten importiert');
    } else setError(result.error);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <SettingsGroup title="Lokaler Speicher" description="Alle Daten liegen nur in diesem Browser (localStorage). Es gibt kein Konto und keine Cloud.">
        <SettingRow label="Status">
          <span className={available ? 'text-sm text-emerald-300' : 'text-sm text-red-300'}>{available ? `Aktiv · ${storageSize()}` : 'Nicht verfügbar (privater Modus?)'}</span>
        </SettingRow>
        <SettingRow label="Gespeichert">
          <span className="text-sm text-ink-muted">
            {counts.r} Routinen · {counts.e} Termine · {counts.t} Aufgaben · {counts.g} Ziele
          </span>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Backup" description="Sichere deine Daten als Datei – z. B. bevor du Browser-Daten löschst oder das Gerät wechselst.">
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={download}>Backup herunterladen</Button>
          <Button icon={Upload} onClick={() => fileRef.current?.click()}>Backup importieren</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <p className="mt-2 text-xs text-ink-faint">Ein Import ersetzt alle aktuellen Daten.</p>
      </SettingsGroup>

      <SettingsGroup title="Zurücksetzen">
        <SettingRow label="Beispiel-Alltag laden" description="Ersetzt alle Daten durch den Beispiel-Alltag.">
          <DeleteButton label="Beispiel laden" onConfirm={() => { completeOnboarding({ name, withExample: true, today: todayKey() }); toast('Beispiel-Alltag geladen'); }} />
        </SettingRow>
        <SettingRow label="Alle Daten löschen" description="Startet die App komplett neu.">
          <DeleteButton label="Alles löschen" onConfirm={resetAll} />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
