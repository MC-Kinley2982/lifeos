import { useState } from 'react';
import { Copy, ExternalLink, Smartphone, TriangleAlert } from 'lucide-react';
import { buildTodoLink } from '../../../services/todos/links';
import { useCloud } from '../../../store/cloud';
import { Button } from '../../../ui/Button';
import { Field, Select, TextInput } from '../../../ui/fields';
import { toast } from '../../../ui/toast';
import { SettingsGroup } from '../SettingsLayout';

/** Adresse dieser App (funktioniert lokal und auf der veröffentlichten Seite). */
function appUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

const PARAMS: Array<{ name: string; text: string }> = [
  { name: 'add', text: 'Titel des To-dos (Pflicht). Mehrere Zeilen ergeben mehrere To-dos.' },
  { name: 'when', text: 'today · tomorrow · week · later oder ein Datum (2026-10-24). Ohne Angabe: heute.' },
  { name: 'time', text: 'Uhrzeit, z. B. 07:30 (optional)' },
  { name: 'note', text: 'Notiz (optional)' },
  { name: 'important', text: '1 = als wichtig markieren (optional)' },
];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Kopiert');
  } catch {
    toast('Kopieren nicht möglich – bitte manuell markieren', 'info');
  }
}

/** Kurzbefehle & Siri: To-dos per Link bzw. Sprachbefehl anlegen. */
export function ShortcutsSection() {
  const cloudOn = useCloud((s) => s.mode !== 'off');
  const signedIn = useCloud((s) => !!s.session);
  const [text, setText] = useState('Sporttasche packen');
  const [when, setWhen] = useState('today');
  const template = `${appUrl()}#/todos?add=TEXT&when=today`;

  return (
    <div className="space-y-4">
      <SettingsGroup
        title="Siri: „To-do hinzufügen“"
        description="Mit einem iOS-Kurzbefehl legst du per Sprache ein To-do an – „Hey Siri, To-do hinzufügen“, Siri fragt nach dem Text, fertig."
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
          <li>
            App <span className="text-ink">Kurzbefehle</span> öffnen → <span className="text-ink">+</span> (neuer Kurzbefehl).
          </li>
          <li>
            Aktion <span className="text-ink">„Nach Eingabe fragen“</span> hinzufügen (Typ Text), Frage z. B. „Was soll auf die Liste?“.
          </li>
          <li>
            Aktion <span className="text-ink">„URL codieren“</span> (engl. „URL Encode“) hinzufügen – Eingabe: <span className="text-ink">Bereitgestellte Eingabe</span>.
            Der Name kann je nach iOS-Version leicht abweichen: in der Aktionssuche „codieren“ eingeben.
          </li>
          <li>
            Aktion <span className="text-ink">„URL“</span> hinzufügen, die Link-Vorlage unten einfügen und <code className="text-ink">TEXT</code> durch die Variable{' '}
            <span className="text-ink">„URL-codierter Text“</span> ersetzen.
          </li>
          <li>
            Aktion <span className="text-ink">„URLs öffnen“</span> hinzufügen.
          </li>
          <li>
            Kurzbefehl <span className="text-ink">„To-do hinzufügen“</span> nennen. Ab jetzt reicht „Hey Siri, To-do hinzufügen“ – oder ein Tipp auf den Kurzbefehl
            (Home-Bildschirm, Widget, Action-Button).
          </li>
        </ol>
      </SettingsGroup>

      <div className="flex gap-3 rounded-3xl border border-amber-400/25 bg-amber-500/[0.07] p-4 text-sm leading-relaxed">
        <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-300" />
        <div className="space-y-1.5 text-amber-100/90">
          <p className="font-medium text-amber-200">Wichtig auf dem iPhone: Safari ≠ Home-Bildschirm-App</p>
          <p>
            „URLs öffnen“ öffnet den Link in <span className="font-medium">Safari</span>, nicht in der LifeOS-App auf dem Home-Bildschirm. iOS gibt beiden getrennte
            Speicher – ohne Konto landet das To-do also nur in Safari.
          </p>
          <p>
            Damit es überall erscheint: in Safari <span className="font-medium">und</span> in der Home-Bildschirm-App mit demselben Konto anmelden (Mein Alltag →
            Konto & Integrationen). Die Cloud-Synchronisierung bringt das To-do dann in die App.
            {!cloudOn && ' In dieser Version ist die Cloud-Synchronisierung noch nicht eingerichtet (siehe README).'}
            {cloudOn && !signedIn && ' Auf diesem Gerät bist du gerade nicht angemeldet.'}
          </p>
        </div>
      </div>

      <SettingsGroup title="Link-Vorlage" description="Funktioniert auch ohne Siri – z. B. als Lesezeichen oder aus anderen Apps.">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <code className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-xs break-all text-ink">{template}</code>
          <Button variant="secondary" size="sm" icon={Copy} onClick={() => copy(template)} aria-label="Link-Vorlage kopieren" className="self-start sm:h-auto sm:self-stretch">
            Kopieren
          </Button>
        </div>
        <dl className="mt-4 space-y-2 text-xs">
          {PARAMS.map((p) => (
            <div key={p.name} className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
              <dt className="font-mono text-violet-200">{p.name}</dt>
              <dd className="text-ink-muted">{p.text}</dd>
            </div>
          ))}
        </dl>
      </SettingsGroup>

      <SettingsGroup title="Ausprobieren" description="Öffnet den Link hier in der App – das To-do erscheint in deiner Liste.">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Field label="Text">
            <TextInput value={text} onChange={(e) => setText(e.target.value)} className="text-base" />
          </Field>
          <Field label="Wann">
            <Select value={when} onChange={(e) => setWhen(e.target.value)}>
              <option value="today">Heute</option>
              <option value="tomorrow">Morgen</option>
              <option value="week">Diese Woche</option>
              <option value="later">Später</option>
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={ExternalLink}
            disabled={!text.trim()}
            onClick={() => {
              window.location.href = buildTodoLink(appUrl(), text.trim(), when);
            }}
          >
            Link öffnen
          </Button>
          <Button variant="ghost" icon={Copy} disabled={!text.trim()} onClick={() => copy(buildTodoLink(appUrl(), text.trim(), when))}>
            Diesen Link kopieren
          </Button>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-ink-faint">
          <Smartphone size={13} className="mt-px shrink-0" />
          Der Link legt das To-do einmal an und entfernt sich danach aus der Adresszeile – Neuladen erzeugt kein Duplikat.
        </p>
      </SettingsGroup>
    </div>
  );
}
