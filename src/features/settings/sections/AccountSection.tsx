import { useState } from 'react';
import { Download, LogOut, RefreshCw } from 'lucide-react';
import { cloud, useCloud } from '../../../store/cloud';
import { Button } from '../../../ui/Button';
import { toast } from '../../../ui/toast';
import { AuthForm } from '../../cloud/AuthForm';
import { SyncIndicator } from '../../cloud/SyncIndicator';
import { SettingRow, SettingsGroup } from '../SettingsLayout';
import { GoogleCalendarGroup } from './GoogleCalendarGroup';

function formatTime(iso?: string): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Konto & Integrationen: Cloud-Konto (Geräte synchronisieren) und Google Kalender. */
export function AccountSection() {
  return (
    <div className="space-y-4">
      <CloudAccount />
      <GoogleCalendarGroup />
    </div>
  );
}

function CloudAccount() {
  const state = useCloud();
  const [busy, setBusy] = useState(false);

  if (state.mode === 'off') {
    return (
      <SettingsGroup
        title="Cloud-Synchronisierung ist nicht eingerichtet"
        description="LifeOS läuft rein lokal. Für dieselben Daten auf PC und iPhone wird ein (kostenloses) Supabase-Projekt benötigt."
      >
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-muted">
          <li>Supabase-Projekt anlegen und die SQL-Migration aus <code className="text-ink">supabase/migrations</code> ausführen.</li>
          <li>Projekt-URL und Publishable Key als Umgebungsvariablen eintragen (siehe README).</li>
          <li>App neu bauen bzw. neu veröffentlichen – danach erscheint hier die Anmeldung.</li>
        </ol>
      </SettingsGroup>
    );
  }

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      if (done) toast(done);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'info');
    } finally {
      setBusy(false);
    }
  };

  const downloadBackup = () => {
    const json = cloud.backupJson();
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifeos-sicherung-vor-cloud.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {state.mode === 'mock' && (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.07] px-4 py-3 text-xs text-amber-200">
          Entwicklungsmodus: Die Cloud wird lokal simuliert (keine echten Konten, Daten nur bis zum Neustart des Dev-Servers).
        </p>
      )}

      {!state.session ? (
        <SettingsGroup title="Anmelden" description="Mit einem Konto hast du auf PC und iPhone dieselben Daten. Offline funktioniert LifeOS weiter – Änderungen werden später synchronisiert.">
          <AuthForm />
        </SettingsGroup>
      ) : (
        <SettingsGroup title="Dein Konto" action={<SyncIndicator />}>
          <SettingRow label="Angemeldet als">
            <span className="text-sm">{state.session.email}</span>
          </SettingRow>
          <SettingRow label="Zuletzt synchronisiert">
            <span className="text-sm text-ink-muted tabular">{formatTime(state.lastSyncedAt)}</span>
          </SettingRow>
          <SettingRow label="Wartende Änderungen" description="Werden hochgeladen, sobald eine Verbindung besteht.">
            <span className="text-sm text-ink-muted tabular">{state.pending}</span>
          </SettingRow>
          {state.error && <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">{state.error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button icon={RefreshCw} disabled={busy} onClick={() => void run(() => cloud.syncNow(), 'Synchronisiert')}>
              Jetzt synchronisieren
            </Button>
            <Button variant="ghost" icon={LogOut} disabled={busy} onClick={() => void run(() => cloud.signOut(), 'Abgemeldet')}>
              Abmelden
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-ink-faint">
            Abmelden lässt deine Daten auf diesem Gerät. Bei Konflikten gilt pro Eintrag die zuletzt gemachte Änderung.
          </p>
        </SettingsGroup>
      )}

      {cloud.hasBackup() && (
        <SettingsGroup title="Sicherung vor Cloud-Übernahme" description="Bevor Cloud-Daten die Daten dieses Geräts ersetzt haben, wurde eine Sicherung gespeichert.">
          <Button icon={Download} onClick={downloadBackup}>Sicherung herunterladen</Button>
        </SettingsGroup>
      )}
    </div>
  );
}
