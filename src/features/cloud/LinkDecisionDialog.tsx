import { useState } from 'react';
import { CloudDownload, Smartphone } from 'lucide-react';
import type { DataSummary } from '../../services/sync/records';
import { cloud, useCloud } from '../../store/cloud';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';

function SummaryList({ s }: { s: DataSummary }) {
  const rows: Array<[string, number]> = [
    ['Routinen', s.routines],
    ['Termine', s.events],
    ['Aufgaben', s.tasks],
    ['To-dos', s.todos],
    ['Ziele', s.goals],
    ['Fächer', s.subjects],
    ['Hausaufgaben', s.homework],
    ['Tests', s.exams],
  ];
  return (
    <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
      {rows.map(([label, n]) => (
        <li key={label} className="flex justify-between gap-3 tabular">
          <span>{label}</span>
          <span className="text-ink">{n}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Erster Login auf einem Gerät mit eigenen Daten, während das Konto ebenfalls Daten hat.
 * Nichts wird ungefragt überschrieben – der Nutzer wählt eine Seite.
 */
export function LinkDecisionDialog() {
  const decision = useCloud((s) => s.linkDecision);
  const email = useCloud((s) => s.session?.email);
  const [busy, setBusy] = useState(false);
  if (!decision) return null;

  const choose = async (choice: 'local' | 'cloud') => {
    setBusy(true);
    try {
      await cloud.resolveLink(choice);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={() => void cloud.signOut()}
      title="Lokale Daten gefunden"
      subtitle={`Auf diesem Gerät und in deinem Konto${email ? ` (${email})` : ''} gibt es bereits LifeOS-Daten. Welche sollen gelten?`}
      footer={
        <Button variant="ghost" block onClick={() => void cloud.signOut()} disabled={busy}>
          Abbrechen und abmelden
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone size={16} className="text-violet-300" /> Dieses Gerät
          </div>
          <SummaryList s={decision.local} />
          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">Die Cloud-Daten werden durch die Daten dieses Geräts ersetzt.</p>
          <Button variant="primary" className="mt-3" disabled={busy} onClick={() => void choose('local')}>
            Lokale Daten in mein Konto übernehmen
          </Button>
        </div>
        <div className="flex flex-col rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CloudDownload size={16} className="text-sky-300" /> Cloud-Konto
          </div>
          <SummaryList s={decision.remote} />
          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
            Die Daten auf diesem Gerät werden ersetzt – vorher wird automatisch eine Sicherung gespeichert (unter „Konto & Integrationen“ herunterladbar).
          </p>
          <Button variant="secondary" className="mt-3" disabled={busy} onClick={() => void choose('cloud')}>
            Cloud-Daten verwenden
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
