import { useMemo, useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { hrefFor, PATHS } from '../../app/router';
import { getWeekday, todayKey, WEEKDAY_LONG, WEEKDAY_SHORT } from '../../domain/time';
import type { TimetableEntry, Weekday } from '../../domain/types';
import { subjectLabel } from '../../services/school/timetable';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { Card, EmptyState } from '../../ui/Card';
import { alpha, cn } from '../../ui/cn';
import { Segmented } from '../../ui/controls';
import { LessonForm } from './LessonForm';

export function TimetableEditor() {
  const timetable = useAppStore((s) => s.timetable);
  const subjects = useAppStore((s) => s.subjects);
  const [editing, setEditing] = useState<{ lesson?: TimetableEntry; weekday?: Weekday } | null>(null);
  const todayWd = getWeekday(todayKey());
  const [mobileDay, setMobileDay] = useState<Weekday>(todayWd > 4 ? 0 : todayWd);

  const hasWeekend = timetable.some((e) => e.weekday >= 5);
  const days: Weekday[] = hasWeekend ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const byDay = useMemo(() => {
    const map = new Map<Weekday, TimetableEntry[]>();
    for (const d of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) map.set(d, timetable.filter((e) => e.weekday === d).sort((a, b) => a.start.localeCompare(b.start)));
    return map;
  }, [timetable]);

  if (subjects.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={BookOpen}
          title="Zuerst Fächer anlegen"
          text="Lege deine Fächer an (Mathematik, Deutsch, …) – danach trägst du hier deine Stunden ein."
          action={<a href={hrefFor(PATHS.school('faecher'))} className="text-sm text-violet-300 hover:underline">Zu den Fächern</a>}
        />
      </Card>
    );
  }

  const lessonCard = (e: TimetableEntry) => {
    const label = subjectLabel(subjects.find((s) => s.id === e.subjectId));
    return (
      <button
        key={e.id}
        type="button"
        onClick={() => setEditing({ lesson: e })}
        className="block w-full rounded-xl px-2.5 py-2 text-left transition-all hover:brightness-125"
        style={{ background: alpha(label.color, 0.14), borderLeft: `3px solid ${label.color}` }}
      >
        <div className="truncate text-xs font-semibold">{label.name}</div>
        <div className="text-[10px] text-ink-muted tabular">
          {e.start}–{e.end}
          {e.room ? ` · ${e.room}` : ''}
        </div>
      </button>
    );
  };

  return (
    <>
      {/* Desktop: Wochenraster */}
      <Card className="hidden md:block">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => (
            <div key={d} className="min-w-0">
              <div className={cn('mb-2 text-center text-xs font-semibold', d === todayWd ? 'text-violet-300' : 'text-ink-muted')}>{WEEKDAY_LONG[d]}</div>
              <div className="space-y-1.5">
                {byDay.get(d)?.map(lessonCard)}
                <button
                  type="button"
                  onClick={() => setEditing({ weekday: d })}
                  className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-line py-2 text-[11px] text-ink-faint hover:border-line-strong hover:text-ink"
                >
                  <Plus size={12} /> Stunde
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Mobil: ein Tag nach dem anderen */}
      <div className="md:hidden">
        <Segmented<Weekday> className="mb-3" value={mobileDay} onChange={setMobileDay} options={days.map((d) => ({ value: d, label: WEEKDAY_SHORT[d] }))} />
        <Card>
          <div className="space-y-2">
            {byDay.get(mobileDay)?.length === 0 && <p className="py-4 text-center text-sm text-ink-faint">Keine Stunden an diesem Tag.</p>}
            {byDay.get(mobileDay)?.map(lessonCard)}
          </div>
          <Button variant="secondary" icon={Plus} block className="mt-3" onClick={() => setEditing({ weekday: mobileDay })}>
            Stunde hinzufügen
          </Button>
        </Card>
      </div>

      <p className="mt-3 px-1 text-xs text-ink-faint">
        Aus dem Stundenplan erkennt LifeOS deine Schulzeit, die Fächer des Tages und die nächste Stunde jedes Fachs (= Deadline für Hausaufgaben).
      </p>

      {editing && <LessonForm lesson={editing.lesson} weekday={editing.weekday} onClose={() => setEditing(null)} />}
    </>
  );
}
