import { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, Link2, MapPin, Plus } from 'lucide-react';
import { formatDuration, relativeDayLabel, toDateKey, toMinutes } from '../../domain/time';
import type { CalendarEvent } from '../../domain/types';
import { pastEvents, upcomingEvents } from '../../services/calendar/eventQueries';
import { useNow } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { Card, EmptyState, PageHeader } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { EventForm } from './EventForm';

export function EventsPage() {
  const now = useNow();
  const today = toDateKey(now);
  const events = useAppStore((s) => s.events);
  const categories = useAppStore((s) => s.settings.categories);
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null);
  const [showPast, setShowPast] = useState(false);

  const upcoming = useMemo(() => upcomingEvents(events, today), [events, today]);
  const past = useMemo(() => pastEvents(events, today), [events, today]);
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of upcoming) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return [...map.entries()];
  }, [upcoming]);

  const colorOf = (e: CalendarEvent) => e.color ?? categories.find((c) => c.id === e.categoryId)?.color ?? '#a1a1aa';

  // Termine aus Google Kalender sind hier nur zu sehen – geändert werden sie in Google.
  const row = (e: CalendarEvent) => (
    <button
      key={e.id}
      type="button"
      onClick={() => e.source === 'local' && setEditing(e)}
      title={e.source === 'google' ? 'Aus Google Kalender – dort bearbeiten' : undefined}
      className={cn('flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors', e.source === 'local' ? 'hover:bg-white/[0.03]' : 'cursor-default')}
    >
      <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: colorOf(e) }} />
      <span className="w-24 shrink-0 text-sm text-ink-muted tabular">{e.allDay ? 'Ganztägig' : `${e.start}–${e.end}`}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{e.title}</span>
        <span className="flex flex-wrap gap-x-3 text-[11px] text-ink-faint">
          {!e.allDay && <span>{formatDuration(toMinutes(e.end) - toMinutes(e.start))}</span>}
          {(e.travelBeforeMin > 0 || e.travelAfterMin > 0) && <span>+ Wege {e.travelBeforeMin}/{e.travelAfterMin} min</span>}
          {e.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={10} />
              {e.location}
            </span>
          )}
          {e.source === 'google' && <span className="text-sky-300/80">aus Google Kalender</span>}
        </span>
      </span>
    </button>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Termine"
        subtitle="Einmalige Termine – sie blockieren automatisch deine freie Zeit."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
            Neuer Termin
          </Button>
        }
      />

      <Card>
        {grouped.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Keine anstehenden Termine" text="Zum Beispiel: Fußballspiel am Samstag 14:00–16:00 oder ein Geburtstag." />
        ) : (
          <div className="space-y-5">
            {grouped.map(([date, list]) => (
              <section key={date}>
                <h3 className={cn('mb-1 px-2 text-xs font-semibold tracking-wide uppercase', date === today ? 'text-violet-300' : 'text-ink-muted')}>
                  {relativeDayLabel(date, today)}
                </h3>
                {list.map(row)}
              </section>
            ))}
          </div>
        )}
      </Card>

      {past.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowPast((v) => !v)} className="flex items-center gap-1.5 px-2 text-sm text-ink-muted hover:text-ink">
            <ChevronDown size={15} className={cn('transition-transform', showPast && 'rotate-180')} />
            Vergangene Termine ({past.length})
          </button>
          {showPast && <Card className="mt-2 opacity-70">{past.map(row)}</Card>}
        </div>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-2xl border border-dashed border-line px-4 py-3 text-xs text-ink-faint">
        <Link2 size={14} className="mt-0.5 shrink-0" />
        Später kann hier Google Calendar angebunden werden – importierte Termine erscheinen dann automatisch in Tages- und Wochenansicht.
      </div>

      {editing && <EventForm event={editing === 'new' ? undefined : editing} defaultDate={today} onClose={() => setEditing(null)} />}
    </div>
  );
}
