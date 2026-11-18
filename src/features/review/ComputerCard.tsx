import { Monitor } from 'lucide-react';
import { formatDuration } from '../../domain/time';
import type { FocusWeek } from '../../services/focus/days';
import { Card, CardHeader } from '../../ui/Card';
import { alpha } from '../../ui/cn';

/** Diagrammfarben für die Einstufung des Co-Pilots (auf dunklem Grund unterscheidbar). */
const CATEGORY = [
  { key: 'productive', label: 'Produktiv', color: '#10b981' },
  { key: 'neutral', label: 'Neutral', color: '#94a3b8' },
  { key: 'unproductive', label: 'Unproduktiv', color: '#f43f5e' },
] as const;
const BAR_COLOR = '#38bdf8';
const MAX_ROWS = 6;

/** Rückblick: Was der Focus Co-Pilot in dieser Woche am Rechner erfasst hat – ohne dass etwas eingetragen werden muss. */
export function ComputerCard({ week }: { week: FocusWeek }) {
  if (week.daysTracked === 0) return null;
  const max = Math.max(1, ...week.groups.map((g) => g.minutes), ...week.activities.map((a) => a.minutes));
  const categoryTotal = Math.max(1, week.byCategory.productive + week.byCategory.neutral + week.byCategory.unproductive);

  return (
    <Card>
      <CardHeader
        title="Am Rechner"
        icon={Monitor}
        subtitle={`Focus Co-Pilot · ${week.daysTracked} ${week.daysTracked === 1 ? 'Tag' : 'Tage'} erfasst · ${formatDuration(week.totalMin)} aktiv`}
      />
      <div className="mb-4">
        <div className="flex h-2 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={CATEGORY.map((c) => `${formatDuration(week.byCategory[c.key])} ${c.label.toLowerCase()}`).join(', ')}>
          {CATEGORY.map((c) =>
            week.byCategory[c.key] > 0 ? <span key={c.key} style={{ flexGrow: week.byCategory[c.key] / categoryTotal, flexBasis: 0, background: c.color }} /> : null,
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
          {CATEGORY.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
              <span className="h-2 w-2 rounded-[3px]" style={{ background: c.color }} />
              {c.label} <span className="font-medium text-ink tabular">{formatDuration(week.byCategory[c.key])}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Rows title="Gruppen" rows={week.groups} max={max} />
        <Rows title="Meistgenutzt" rows={week.activities} max={max} />
      </div>
    </Card>
  );
}

function Rows({ title, rows, max }: { title: string; rows: FocusWeek['groups']; max: number }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold text-ink-muted">{title}</h3>
      <ul className="space-y-1.5">
        {rows.slice(0, MAX_ROWS).map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{r.name}</span>
              <span className="shrink-0 text-xs font-semibold text-ink tabular">{formatDuration(r.minutes)}</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full" style={{ background: alpha(BAR_COLOR, 0.12) }}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.minutes / max) * 100)}%`, background: BAR_COLOR }} />
            </div>
          </li>
        ))}
        {rows.length > MAX_ROWS && <li className="text-xs text-ink-faint">+ {rows.length - MAX_ROWS} weitere</li>}
      </ul>
    </div>
  );
}
