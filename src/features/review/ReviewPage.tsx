import { useMemo, useState, type ReactNode } from 'react';
import { ChartColumn, CheckCheck, ChevronLeft, ChevronRight, Clock, ListChecks, NotebookPen, Sun, Table2, Target, Trophy } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { hrefFor, navigate, PATHS } from '../../app/router';
import { addDays, formatDateShort, formatDuration, getWeekday, parseDateKey, toDateKey, WEEKDAY_SHORT } from '../../domain/time';
import type { DateKey } from '../../domain/types';
import { formatGrade, gradeColor, gradeLabel } from '../../services/school/grades';
import { isoWeek, weekHistory, weekStartOf, weekStats, type DayStat, type StatsData, type WeekSummary } from '../../services/stats/weekly';
import { useNow, usePlannerData } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Button, IconButton } from '../../ui/Button';
import { Card, CardHeader, PageHeader } from '../../ui/Card';
import { alpha, cn } from '../../ui/cn';
import { GoalProgressRow } from '../goals/GoalProgressRow';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HISTORY_WEEKS = 8;

/** Diagrammfarben – geprüft auf ausreichenden Abstand (auch bei Farbsehschwäche) auf dunklem Hintergrund. */
const SERIES = [
  { key: 'fixedMin', label: 'Fest', hint: 'Routinen, Schule, Termine, Mahlzeiten', color: '#0369a1' },
  { key: 'workMin', label: 'Geplant', hint: 'Aufgaben, Hausaufgaben, Lernzeit', color: '#a855f7' },
  { key: 'freeMin', label: 'Frei', hint: 'freie Zeit', color: '#059669' },
] as const;
const HISTORY_COLOR = '#a855f7';

function useStatsData(): StatsData {
  const planner = usePlannerData();
  const extra = useAppStore(useShallow((s) => ({ todos: s.todos, grades: s.grades })));
  return useMemo(() => ({ ...planner, ...extra }), [planner, extra]);
}

function weekRange(start: DateKey): string {
  const end = addDays(start, 6);
  const s = parseDateKey(start);
  const e = parseDateKey(end);
  const month = (d: Date) => d.toLocaleDateString('de-DE', { month: 'short' });
  return s.getMonth() === e.getMonth() ? `${s.getDate()}.–${e.getDate()}. ${month(e)}` : `${s.getDate()}. ${month(s)} – ${e.getDate()}. ${month(e)}`;
}

/** Wochenrückblick: Erledigtes, Ziele, Zeitverteilung pro Tag und die letzten Wochen im Vergleich. */
export function ReviewPage({ weekParam }: { weekParam?: string }) {
  const now = useNow(60_000);
  const today = toDateKey(now);
  const weekStartsOn = useAppStore((s) => s.settings.ui.weekStartsOn);
  const currentStart = weekStartOf(today, weekStartsOn);
  const weekStart = weekParam && DATE_RE.test(weekParam) ? weekStartOf(weekParam, weekStartsOn) : currentStart;
  const isCurrent = weekStart === currentStart;
  const data = useStatsData();
  const minuteKey = Math.floor(now.getTime() / 60_000);

  const stats = useMemo(() => weekStats(data, weekStart, now), [data, weekStart, minuteKey]);
  const history = useMemo(() => weekHistory(data, weekStart, HISTORY_WEEKS, now), [data, weekStart, minuteKey]);
  const previous = history.length > 1 ? history[history.length - 2] : undefined;
  const go = (start: DateKey) => navigate(start === currentStart ? PATHS.review() : PATHS.review(start));
  const label = isCurrent ? 'Diese Woche' : weekStart === addDays(currentStart, -7) ? 'Letzte Woche' : `KW ${isoWeek(weekStart)}`;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Rückblick"
        subtitle={`${label} · KW ${isoWeek(weekStart)} · ${weekRange(weekStart)}`}
        actions={
          <>
            {!isCurrent && (
              <Button variant="secondary" size="sm" onClick={() => go(currentStart)}>
                Diese Woche
              </Button>
            )}
            <IconButton icon={ChevronLeft} label="Vorherige Woche" variant="secondary" onClick={() => go(addDays(weekStart, -7))} />
            <IconButton icon={ChevronRight} label="Nächste Woche" variant="secondary" disabled={isCurrent} onClick={() => go(addDays(weekStart, 7))} />
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={CheckCheck}
          label={isCurrent ? 'Erledigt (bisher)' : 'Erledigt'}
          value={String(stats.doneCount)}
          delta={previous ? deltaText(stats.doneCount - previous.doneCount, (n) => String(n)) : undefined}
          detail={`${plural(stats.tasks.length, 'Aufgabe', 'Aufgaben')} · ${plural(stats.todos.length, 'To-do', 'To-dos')} · ${plural(stats.homework.length, 'Hausaufgabe', 'Hausaufgaben')}`}
        />
        <StatTile
          icon={Clock}
          label="Geschaffte Zeit"
          value={formatDuration(stats.focusMin)}
          delta={previous ? deltaText(stats.focusMin - previous.focusMin, formatDuration) : undefined}
          detail={stats.studySessions.count ? `inkl. ${stats.studySessions.count} Lerneinheiten` : 'Aufgaben, Hausaufgaben, Ziele'}
        />
        <StatTile icon={Sun} label="Freie Zeit" value={formatDuration(stats.totals.freeMin)} detail={`Ø ${formatDuration(Math.round(stats.totals.freeMin / 7))} pro Tag`} />
        <StatTile
          icon={Target}
          label="Ziele"
          value={stats.goalPercent !== null ? `${stats.goalPercent} %` : '–'}
          detail={stats.goals.length ? `Ø Fortschritt von ${stats.goals.length} ${stats.goals.length === 1 ? 'Ziel' : 'Zielen'}` : 'Keine aktiven Ziele'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:items-start">
        <div className="space-y-5">
          <DayChart days={stats.days} today={today} isCurrent={isCurrent} />
          <HistoryChart history={history} selected={weekStart} onSelect={go} />
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Ziele"
              icon={Target}
              action={
                <a href={hrefFor(PATHS.goals)} className="text-xs text-violet-300 hover:underline">
                  Alle
                </a>
              }
            />
            {stats.goals.length === 0 ? (
              <p className="text-sm text-ink-muted">Keine aktiven Ziele.</p>
            ) : (
              <div className="space-y-4">
                {stats.goals.map(({ goal, progress }) => (
                  <GoalProgressRow key={goal.id} goal={goal} progress={progress} />
                ))}
              </div>
            )}
          </Card>
          <DoneCard stats={stats} />
          {stats.grades.length > 0 && <GradesCard grades={stats.grades} />}
        </div>
      </div>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function deltaText(diff: number, format: (n: number) => string): string {
  if (diff === 0) return 'wie Vorwoche';
  return `${diff > 0 ? '↑' : '↓'} ${format(Math.abs(diff))} vs. Vorwoche`;
}

function StatTile({ icon: Icon, label, value, detail, delta }: { icon: typeof Sun; label: string; value: string; detail?: string; delta?: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface/80 p-4">
      <div className="flex items-center gap-1.5 text-xs text-ink-muted">
        <Icon size={13} /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
      {delta && <div className="mt-0.5 text-[11px] text-ink-muted">{delta}</div>}
      {detail && <div className="mt-0.5 text-[11px] leading-snug text-ink-faint">{detail}</div>}
    </div>
  );
}

// ─── Zeit pro Tag (gestapelte Balken) ────────────────────────

function DayChart({ days, today, isCurrent }: { days: DayStat[]; today: DateKey; isCurrent: boolean }) {
  const [active, setActive] = useState<DateKey | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...days.map((d) => d.awakeMin));
  const shown = days.find((d) => d.date === active) ?? days.find((d) => d.date === today) ?? days[0];

  return (
    <Card>
      <CardHeader
        title="Zeit pro Tag"
        icon={ChartColumn}
        subtitle={isCurrent ? 'Wachzeit – kommende Tage laut Plan' : 'Wachzeit, berechnet mit deinen aktuellen Routinen'}
        action={
          <button
            type="button"
            onClick={() => setTable((v) => !v)}
            aria-pressed={table}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-muted hover:bg-white/5 hover:text-ink"
          >
            <Table2 size={13} /> {table ? 'Diagramm' : 'Tabelle'}
          </button>
        }
      />
      <Legend />
      {table ? (
        <table className="mt-3 w-full text-sm tabular">
          <thead>
            <tr className="text-left text-[11px] text-ink-faint">
              <th className="py-1 font-medium">Tag</th>
              {SERIES.map((s) => (
                <th key={s.key} className="py-1 text-right font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-t border-line">
                <td className="py-1.5 text-ink-muted">
                  {WEEKDAY_SHORT[getWeekday(d.date)]} {formatDateShort(d.date)}
                </td>
                {SERIES.map((s) => (
                  <td key={s.key} className="py-1.5 text-right">
                    {formatDuration(d[s.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="mt-3 space-y-1" onMouseLeave={() => setActive(null)}>
            {days.map((d) => (
              <div
                key={d.date}
                tabIndex={0}
                role="img"
                aria-label={dayText(d)}
                onMouseEnter={() => setActive(d.date)}
                onFocus={() => setActive(d.date)}
                onClick={() => setActive(d.date)}
                className={cn('flex cursor-default items-center gap-3 rounded-xl px-1 py-1.5 outline-none transition-colors', shown?.date === d.date ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]')}
              >
                <span className={cn('w-12 shrink-0 text-xs tabular', d.date === today ? 'font-semibold text-ink' : 'text-ink-muted')}>
                  {WEEKDAY_SHORT[getWeekday(d.date)]} {parseDateKey(d.date).getDate()}.
                </span>
                <div className="flex h-5 min-w-0 flex-1 items-stretch">
                  <div className="flex gap-[2px] overflow-hidden rounded-r-[4px]" style={{ width: `${(d.awakeMin / max) * 100}%` }}>
                    {SERIES.map((s) =>
                      d[s.key] > 0 ? <span key={s.key} className="h-full" style={{ flexGrow: d[s.key], flexBasis: 0, background: s.color }} /> : null,
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {shown && (
            <p className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-ink-muted" aria-live="polite">
              <span className="font-medium text-ink">
                {WEEKDAY_SHORT[getWeekday(shown.date)]}, {formatDateShort(shown.date)}:
              </span>{' '}
              {SERIES.map((s, i) => (
                <span key={s.key}>
                  {i > 0 && ' · '}
                  <span className="font-semibold text-ink tabular">{formatDuration(shown[s.key])}</span> {s.label.toLowerCase()}
                </span>
              ))}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function dayText(d: DayStat): string {
  return `${WEEKDAY_SHORT[getWeekday(d.date)]} ${formatDateShort(d.date)}: ${SERIES.map((s) => `${formatDuration(d[s.key])} ${s.label.toLowerCase()}`).join(', ')}`;
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-ink-muted" title={s.hint}>
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.label}
          <span className="hidden text-ink-faint sm:inline">({s.hint})</span>
        </span>
      ))}
    </div>
  );
}

// ─── Letzte Wochen (Säulen) ──────────────────────────────────

function HistoryChart({ history, selected, onSelect }: { history: WeekSummary[]; selected: DateKey; onSelect: (start: DateKey) => void }) {
  const [active, setActive] = useState<DateKey | null>(null);
  const max = Math.max(1, ...history.map((h) => h.focusMin));
  const shown = history.find((h) => h.weekStart === (active ?? selected)) ?? history[history.length - 1];
  const sel = history.find((h) => h.weekStart === selected);

  return (
    <Card>
      <CardHeader title="Letzte Wochen" icon={ChartColumn} subtitle="Geschaffte Zeit pro Woche – antippen zum Öffnen" />
      <div className="relative" onMouseLeave={() => setActive(null)}>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 text-[10px] text-ink-faint">
          <span className="tabular">{formatDuration(max)}</span>
          <span className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <div className="flex h-40 items-end gap-1 border-b border-white/[0.08] pt-5">
          {history.map((h) => {
            const isSel = h.weekStart === selected;
            const height = (h.focusMin / max) * 100;
            return (
              <button
                key={h.weekStart}
                type="button"
                onClick={() => onSelect(h.weekStart)}
                onMouseEnter={() => setActive(h.weekStart)}
                onFocus={() => setActive(h.weekStart)}
                aria-label={`KW ${h.week}: ${formatDuration(h.focusMin)} geschafft, ${h.doneCount} erledigt`}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
              >
                {isSel && h.focusMin > 0 && <span className="mb-1 text-[10px] font-semibold whitespace-nowrap text-ink tabular">{formatDuration(h.focusMin)}</span>}
                <span
                  className="w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-100"
                  style={{ height: `${height}%`, minHeight: h.focusMin > 0 ? 3 : 0, background: isSel ? HISTORY_COLOR : alpha(HISTORY_COLOR, 0.45) }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex gap-1">
          {history.map((h) => (
            <span key={h.weekStart} className={cn('flex-1 text-center text-[10px] tabular', h.weekStart === selected ? 'font-semibold text-ink' : 'text-ink-faint')}>
              {h.week}
            </span>
          ))}
        </div>
      </div>
      {shown && (
        <p className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-ink-muted" aria-live="polite">
          <span className="font-medium text-ink">KW {shown.week}:</span> <span className="font-semibold text-ink tabular">{formatDuration(shown.focusMin)}</span> geschafft ·{' '}
          <span className="font-semibold text-ink tabular">{shown.doneCount}</span> erledigt
          {shown.goalPercent !== null && (
            <>
              {' '}
              · Ziele <span className="font-semibold text-ink tabular">{shown.goalPercent} %</span>
            </>
          )}
          {sel && shown.weekStart !== sel.weekStart && ' – antippen zum Öffnen'}
        </p>
      )}
    </Card>
  );
}

// ─── Erledigt & Noten ────────────────────────────────────────

function DoneCard({ stats }: { stats: ReturnType<typeof weekStats> }) {
  const subjects = useAppStore((s) => s.subjects);
  const groups: Array<{ key: string; title: string; icon: typeof Sun; items: Array<{ id: string; text: ReactNode }> }> = [
    { key: 'tasks', title: 'Aufgaben', icon: ListChecks, items: stats.tasks.map((t) => ({ id: t.id, text: t.title })) },
    { key: 'todos', title: 'To-dos', icon: CheckCheck, items: stats.todos.map((t) => ({ id: t.id, text: t.title })) },
    {
      key: 'homework',
      title: 'Hausaufgaben',
      icon: NotebookPen,
      items: stats.homework.map((h) => ({
        id: h.id,
        text: (
          <>
            <span className="text-ink-muted">{subjects.find((s) => s.id === h.subjectId)?.name ?? 'Fach'}:</span> {h.title || 'Hausaufgabe'}
            {h.actualMinutes ? <span className="text-ink-faint"> · {formatDuration(h.actualMinutes)}</span> : null}
          </>
        ),
      })),
    },
  ];

  return (
    <Card>
      <CardHeader title="Erledigt" icon={CheckCheck} subtitle={stats.doneCount ? `${stats.doneCount} Einträge – stark!` : 'In dieser Woche noch nichts abgehakt.'} />
      <div className="space-y-4">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.key}>
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                <g.icon size={13} /> {g.title} <span className="font-normal text-ink-faint">({g.items.length})</span>
              </h3>
              <ul className="space-y-0.5 text-sm">
                {g.items.slice(0, 6).map((i) => (
                  <li key={i.id} className="truncate">
                    {i.text}
                  </li>
                ))}
                {g.items.length > 6 && <li className="text-xs text-ink-faint">+ {g.items.length - 6} weitere</li>}
              </ul>
            </div>
          ))}
      </div>
    </Card>
  );
}

function GradesCard({ grades }: { grades: ReturnType<typeof weekStats>['grades'] }) {
  const subjects = useAppStore((s) => s.subjects);
  const step = useAppStore((s) => s.settings.school.gradeTendencyStep);
  const avg = grades.reduce((s, g) => s + g.value, 0) / grades.length;
  return (
    <Card>
      <CardHeader
        title="Noten dieser Woche"
        icon={Trophy}
        subtitle={`Ø ${formatGrade(avg)} (ungewichtet)`}
        action={
          <a href={hrefFor(PATHS.school('noten'))} className="text-xs text-violet-300 hover:underline">
            Alle
          </a>
        }
      />
      <div className="space-y-1">
        {grades.map((g) => (
          <div key={g.id} className="flex items-center gap-3 text-sm">
            <span className="w-12 shrink-0 text-xs text-ink-muted tabular">{formatDateShort(g.date)}</span>
            <span className="min-w-0 flex-1 truncate">
              {subjects.find((s) => s.id === g.subjectId)?.name ?? 'Fach'}
              {g.title && <span className="text-ink-faint"> · {g.title}</span>}
            </span>
            <span className="rounded-lg px-2 py-0.5 text-sm font-semibold tabular" style={{ background: alpha(gradeColor(g.value), 0.15), color: gradeColor(g.value) }}>
              {gradeLabel(g.value, step)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
