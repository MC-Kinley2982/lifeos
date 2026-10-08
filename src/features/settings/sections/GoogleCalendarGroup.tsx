import { useEffect, useState } from 'react';
import { CalendarDays, Link2Off, LogIn, RefreshCw } from 'lucide-react';
import type { GoogleReminder, GoogleSyncCategory } from '../../../domain/types';
import { googleCalendar, useGoogle } from '../../../store/googleCalendar';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../ui/Button';
import { cn } from '../../../ui/cn';
import { Toggle } from '../../../ui/controls';
import { Select } from '../../../ui/fields';
import { SettingRow, SettingsGroup } from '../SettingsLayout';

const PUSH_OPTIONS: Array<{ key: GoogleSyncCategory; label: string; description: string }> = [
  { key: 'events', label: 'Termine', description: 'Deine festen LifeOS-Termine – am wichtigsten für Benachrichtigungen aufs Handy.' },
  { key: 'homework', label: 'Geplante Hausaufgaben', description: 'Die Zeitblöcke, die LifeOS für Hausaufgaben eingeplant hat.' },
  { key: 'study', label: 'Geplante Lernzeiten', description: 'Lerneinheiten für Tests.' },
  { key: 'todos', label: 'To-dos mit Kalendertermin', description: 'Nur To-dos, bei denen du einzeln „In Google Kalender eintragen“ einschaltest.' },
  { key: 'routines', label: 'Routinen', description: 'Achtung: erzeugt jede Woche viele Einträge.' },
];

type ReminderChoice = 'default' | 'none' | '10' | '30' | '60';

const toChoice = (r: GoogleReminder): ReminderChoice =>
  r.type === 'calendarDefault' ? 'default' : r.type === 'none' ? 'none' : (String(r.minutes) as ReminderChoice);
const fromChoice = (c: ReminderChoice): GoogleReminder =>
  c === 'default' ? { type: 'calendarDefault' } : c === 'none' ? { type: 'none' } : { type: 'minutes', minutes: Number(c) };

function formatTime(iso?: string): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Google Kalender verbinden, Kalender wählen, trennen – und festlegen, was abgeglichen wird.
 * Es wird nichts vorgetäuscht: ohne Client-ID steht hier nur, was noch eingerichtet werden muss.
 */
export function GoogleCalendarGroup() {
  const g = useGoogle();
  const settings = useAppStore((s) => s.settings.integrations.googleCalendar);
  const update = useAppStore((s) => s.updateGoogleCalendar);
  const [choosing, setChoosing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    void googleCalendar.preload();
  }, []);

  if (g.status === 'unconfigured') {
    return (
      <SettingsGroup title="Google Kalender" description="Noch nicht eingerichtet – dafür ist einmalig eine Einstellung außerhalb der App nötig.">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-muted">
          <li>In der Google Cloud Console ein Projekt anlegen und die „Google Calendar API“ aktivieren.</li>
          <li>OAuth-Zustimmungsbildschirm einrichten und eine OAuth-Client-ID vom Typ „Webanwendung“ erstellen (Details im README).</li>
          <li>
            Die Client-ID als <code className="text-ink">VITE_GOOGLE_CLIENT_ID</code> eintragen und die App neu veröffentlichen – danach erscheint hier „Mit Google verbinden“.
          </li>
        </ol>
      </SettingsGroup>
    );
  }

  if (!settings.calendarId) {
    return (
      <SettingsGroup
        title="Google Kalender"
        description="Sieh deine Google-Termine in LifeOS und trag – nur wenn du willst – LifeOS-Einträge in Google ein, z. B. damit dein iPhone dich über Google Kalender erinnert."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-white/25" /> Nicht verbunden
          </span>
          <Button variant="primary" icon={CalendarDays} disabled={g.busy} onClick={() => void googleCalendar.connect()}>
            {g.busy ? 'Einen Moment …' : 'Mit Google verbinden'}
          </Button>
        </div>
        {g.error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">{g.error}</p>}
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          LifeOS fragt nur nach dem Lesen deiner Kalenderliste und dem Lesen/Schreiben von Terminen. Es wird nichts übertragen, bevor du es unten einschaltest.
        </p>
      </SettingsGroup>
    );
  }

  const deviceReady = g.status === 'ready';
  const last = g.lastSync;

  return (
    <>
      <SettingsGroup
        title="Google Kalender"
        action={
          <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', g.status === 'error' ? 'text-red-300' : 'text-emerald-300')}>
            <span className={cn('h-2 w-2 rounded-full', g.status === 'error' ? 'bg-red-400' : 'bg-emerald-400')} />
            Verbunden
          </span>
        }
      >
        {settings.accountEmail && (
          <SettingRow label="Konto">
            <span className="text-sm break-all">{settings.accountEmail}</span>
          </SettingRow>
        )}
        <SettingRow label="Kalender">
          <span className="text-sm">„{settings.calendarName ?? settings.calendarId}“</span>
        </SettingRow>
        <SettingRow label="Auf diesem Gerät" description={deviceReady ? undefined : 'Die Google-Anmeldung gilt pro Gerät und läuft nach etwa einer Stunde ab.'}>
          {deviceReady ? (
            <span className="text-sm text-ink-muted">angemeldet</span>
          ) : (
            <Button size="sm" icon={LogIn} disabled={g.busy} onClick={() => void googleCalendar.signIn()}>
              Kurz anmelden
            </Button>
          )}
        </SettingRow>
        <SettingRow label="Zuletzt abgeglichen">
          <span className="text-sm text-ink-muted tabular">
            {formatTime(last?.at)}
            {last && (
              <span className="block text-[11px] text-ink-faint">
                {last.push.created} neu · {last.push.updated} geändert · {last.push.deleted} entfernt · {last.imported} Google-Termine gelesen
              </span>
            )}
          </span>
        </SettingRow>
        {g.error && <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">{g.error}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button icon={RefreshCw} disabled={g.busy} onClick={() => void googleCalendar.syncNow()}>
            {g.busy ? 'Synchronisiere …' : 'Jetzt synchronisieren'}
          </Button>
          <Button
            variant="ghost"
            disabled={g.busy}
            onClick={() => {
              setChoosing((v) => !v);
              if (!choosing) void googleCalendar.loadCalendars();
            }}
          >
            Kalender ändern
          </Button>
          <Button variant="ghost" icon={Link2Off} disabled={g.busy} onClick={() => setConfirmDisconnect((v) => !v)}>
            Trennen
          </Button>
        </div>

        {choosing && (
          <div className="mt-3 space-y-1.5 rounded-2xl border border-line p-2">
            {g.calendars.length === 0 && <p className="px-2 py-1.5 text-sm text-ink-muted">{g.busy ? 'Lade Kalender …' : 'Keine Kalender geladen.'}</p>}
            {g.calendars.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={g.busy}
                onClick={() => {
                  setChoosing(false);
                  if (c.id !== settings.calendarId) void googleCalendar.chooseCalendar(c);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.04]',
                  c.id === settings.calendarId && 'bg-white/[0.06]',
                )}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.backgroundColor ?? '#60a5fa' }} />
                <span className="min-w-0 flex-1 truncate">{c.summary}</span>
                {c.primary && <span className="text-[11px] text-ink-faint">Hauptkalender</span>}
              </button>
            ))}
            <p className="px-2 pt-1 text-[11px] text-ink-faint">Beim Wechsel entfernt LifeOS seine eigenen Einträge aus dem bisherigen Kalender.</p>
          </div>
        )}

        {confirmDisconnect && (
          <div className="mt-3 space-y-2 rounded-2xl border border-line p-3">
            <p className="text-sm">Google Kalender trennen?</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={g.busy}
                onClick={() => {
                  setConfirmDisconnect(false);
                  void googleCalendar.disconnect(false);
                }}
              >
                Trennen (Einträge bleiben in Google)
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={g.busy || !deviceReady}
                onClick={() => {
                  setConfirmDisconnect(false);
                  void googleCalendar.disconnect(true);
                }}
              >
                Trennen und LifeOS-Einträge aus Google entfernen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDisconnect(false)}>
                Abbrechen
              </Button>
            </div>
            <p className="text-[11px] text-ink-faint">Deine eigenen Google-Termine werden in keinem Fall gelöscht.</p>
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup
        title="Was wird abgeglichen?"
        description="Standardmäßig trägt LifeOS nichts in Google ein. Schaltest du etwas wieder aus, entfernt LifeOS die dazugehörigen, von LifeOS angelegten Einträge. Deine eigenen Google-Termine werden nie verändert."
      >
        <Toggle
          checked={settings.importEvents}
          onChange={(v) => update({ importEvents: v })}
          label="Google-Termine in LifeOS anzeigen"
          description="Sie blockieren im Tagesplan Zeit wie feste Termine – LifeOS plant nichts darüber."
        />
        <div className="mt-4 mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">In Google Kalender eintragen</div>
        <div className="divide-y divide-line">
          {PUSH_OPTIONS.map((o) => (
            <div key={o.key} className="py-1.5">
              <Toggle checked={settings.push[o.key]} onChange={(v) => update({ push: { ...settings.push, [o.key]: v } })} label={o.label} description={o.description} />
            </div>
          ))}
        </div>
        <SettingRow label="Erinnerung" description="Für eingetragene Termine. To-dos haben ihre eigene Erinnerung (Standard: keine).">
          <Select value={toChoice(settings.reminder)} onChange={(e) => update({ reminder: fromChoice(e.target.value as ReminderChoice) })}>
            <option value="default">Wie im Google Kalender eingestellt</option>
            <option value="none">Keine</option>
            <option value="10">10 Minuten vorher</option>
            <option value="30">30 Minuten vorher</option>
            <option value="60">1 Stunde vorher</option>
          </Select>
        </SettingRow>
      </SettingsGroup>
    </>
  );
}
