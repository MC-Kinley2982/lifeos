import { useMemo, useState } from 'react';
import { BookOpen, CalendarDays, ClipboardList, GraduationCap, NotebookPen, Plus, Settings } from 'lucide-react';
import { hrefFor, navigate, PATHS } from '../../app/router';
import { formatDuration, toDateKey, toHHMM } from '../../domain/time';
import type { Exam, Homework } from '../../domain/types';
import { buildDaySchedule } from '../../services/planner';
import { upcomingExams } from '../../services/school/exams';
import { openHomework } from '../../services/school/homework';
import { useNow, usePlannerData } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../ui/Button';
import { Card, CardHeader, EmptyState, PageHeader } from '../../ui/Card';
import { alpha } from '../../ui/cn';
import { Segmented } from '../../ui/controls';
import { ExamCard } from './ExamCard';
import { ExamForm } from './ExamForm';
import { HomeworkCaptureSheet } from './HomeworkCaptureSheet';
import { HomeworkForm } from './HomeworkForm';
import { HomeworkItem } from './HomeworkItem';
import { SubjectsManager } from './SubjectsManager';
import { TimetableEditor } from './TimetableEditor';

type Tab = 'uebersicht' | 'hausaufgaben' | 'tests' | 'stundenplan' | 'faecher';
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'uebersicht', label: 'Übersicht' },
  { value: 'hausaufgaben', label: 'Hausaufgaben' },
  { value: 'tests', label: 'Tests' },
  { value: 'stundenplan', label: 'Stundenplan' },
  { value: 'faecher', label: 'Fächer' },
];

export function SchoolPage({ tab: tabParam }: { tab?: string }) {
  const tab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : 'uebersicht';
  const enabled = useAppStore((s) => s.settings.school.enabled);
  const [sheet, setSheet] = useState<
    { kind: 'capture' } | { kind: 'homework'; hw?: Homework } | { kind: 'exam'; exam?: Exam } | null
  >(null);

  if (!enabled) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Schule" />
        <Card>
          <EmptyState
            icon={GraduationCap}
            title="Schulfunktionen sind ausgeschaltet"
            text="Stundenplan, Hausaufgaben und Tests kannst du unter „Mein Alltag → Schule“ aktivieren."
            action={<Button variant="primary" icon={Settings} onClick={() => navigate(PATHS.settings('schule'))}>Einstellungen</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Schule"
        subtitle="Stundenplan, Hausaufgaben und Tests – automatisch in deinen Wochenplan eingeplant."
        actions={
          <>
            <Button variant="secondary" icon={ClipboardList} onClick={() => setSheet({ kind: 'exam' })}>
              Test
            </Button>
            <Button variant="primary" icon={NotebookPen} onClick={() => setSheet({ kind: 'capture' })}>
              Hausaufgaben eintragen
            </Button>
          </>
        }
      />

      <div className="scrollbar-none -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented<Tab> className="min-w-[520px] sm:max-w-2xl" value={tab} onChange={(t) => navigate(t === 'uebersicht' ? PATHS.school() : PATHS.school(t))} options={TABS} />
      </div>

      {tab === 'uebersicht' && <Overview onOpenHomework={(hw) => setSheet({ kind: 'homework', hw })} onOpenExam={(exam) => setSheet({ kind: 'exam', exam })} onCapture={() => setSheet({ kind: 'capture' })} />}
      {tab === 'hausaufgaben' && <HomeworkTab onOpen={(hw) => setSheet({ kind: 'homework', hw })} onNew={() => setSheet({ kind: 'homework' })} />}
      {tab === 'tests' && <ExamsTab onOpen={(exam) => setSheet({ kind: 'exam', exam })} onNew={() => setSheet({ kind: 'exam' })} />}
      {tab === 'stundenplan' && <TimetableEditor />}
      {tab === 'faecher' && <SubjectsManager />}

      {sheet?.kind === 'capture' && <HomeworkCaptureSheet mode="manual" onClose={() => setSheet(null)} />}
      {sheet?.kind === 'homework' && <HomeworkForm homework={sheet.hw} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'exam' && <ExamForm exam={sheet.exam} onClose={() => setSheet(null)} />}
    </div>
  );
}

// ─── Übersicht ───────────────────────────────────────────────

function Overview({ onOpenHomework, onOpenExam, onCapture }: { onOpenHomework: (h: Homework) => void; onOpenExam: (e: Exam) => void; onCapture: () => void }) {
  const data = usePlannerData();
  const now = useNow();
  const today = toDateKey(now);
  const schedule = useMemo(() => buildDaySchedule(data, today), [data, today]);
  const open = useMemo(() => openHomework(data), [data]);
  const exams = useMemo(() => upcomingExams(data, today), [data, today]);
  const lessons = schedule.lessons;
  const paused = schedule.inactive.find((i) => i.title === (data.routines.find((r) => r.id === data.settings.school.linkedRoutineId)?.name ?? 'Schule'));

  if (data.subjects.length === 0 || data.timetable.length === 0) {
    return (
      <Card>
        <CardHeader title="Los geht's" icon={GraduationCap} subtitle="Zwei Schritte, dann plant LifeOS deine Schulwoche mit." />
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupStep n={1} done={data.subjects.length > 0} title="Fächer anlegen" text="Mathematik, Deutsch, Englisch …" href={PATHS.school('faecher')} icon={BookOpen} />
          <SetupStep n={2} done={data.timetable.length > 0} title="Stundenplan eintragen" text="Damit erkennt LifeOS Schulzeit und Deadlines." href={PATHS.school('stundenplan')} icon={CalendarDays} />
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader
          title="Heute"
          icon={GraduationCap}
          subtitle={lessons.length ? `${lessons.length} Stunden · Schulschluss ${toHHMM(Math.max(...lessons.map((l) => l.end)))}` : paused ? `Unterricht pausiert (${schedule.dayState.definition.name})` : 'Heute kein Unterricht'}
          action={<Button size="sm" variant="secondary" icon={Plus} onClick={onCapture}>Hausaufgaben</Button>}
        />
        {lessons.length > 0 ? (
          <div className="space-y-1.5">
            {lessons.map((l) => (
              <div key={l.entryId} className="flex items-center gap-3 rounded-xl px-2 py-1.5" style={{ background: alpha(l.color, 0.08) }}>
                <span className="w-24 shrink-0 text-xs text-ink-muted tabular">{toHHMM(l.start)}–{toHHMM(l.end)}</span>
                <span className="h-4 w-1 rounded-full" style={{ background: l.color }} />
                <span className="flex-1 text-sm">{l.title}</span>
                {l.room && <span className="text-[11px] text-ink-faint">{l.room}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Genieß den freien Tag – Hausaufgaben kannst du trotzdem eintragen.</p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Offene Hausaufgaben"
          icon={NotebookPen}
          subtitle={open.length ? `${open.length} offen · ${formatDuration(open.reduce((s, h) => s + h.estimatedMinutes, 0))}` : 'Alles erledigt'}
          action={<a href={hrefFor(PATHS.school('hausaufgaben'))} className="text-xs text-violet-300 hover:underline">Alle</a>}
        />
        {open.length === 0 ? (
          <p className="text-sm text-ink-muted">Keine offenen Hausaufgaben. 🎉</p>
        ) : (
          <div className="-mx-2">
            {open.slice(0, 6).map((h) => (
              <HomeworkItem key={h.id} homework={h} today={today} now={now} onOpen={onOpenHomework} />
            ))}
          </div>
        )}
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title="Nächste Tests & Lernfortschritt"
          icon={ClipboardList}
          action={<a href={hrefFor(PATHS.school('tests'))} className="text-xs text-violet-300 hover:underline">Alle</a>}
        />
        {exams.length === 0 ? (
          <p className="text-sm text-ink-muted">Keine anstehenden Tests.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {exams.slice(0, 4).map((e) => (
              <ExamCard key={e.id} exam={e} today={today} now={now} onOpen={onOpenExam} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SetupStep({ n, done, title, text, href, icon: Icon }: { n: number; done: boolean; title: string; text: string; href: string; icon: typeof BookOpen }) {
  return (
    <a href={hrefFor(href)} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-violet-500/20 text-violet-200'}`}>
        {done ? '✓' : <Icon size={17} />}
      </span>
      <span>
        <span className="block text-sm font-medium">
          {n}. {title}
        </span>
        <span className="block text-xs text-ink-muted">{text}</span>
      </span>
    </a>
  );
}

// ─── Hausaufgaben ────────────────────────────────────────────

function HomeworkTab({ onOpen, onNew }: { onOpen: (h: Homework) => void; onNew: () => void }) {
  const homework = useAppStore((s) => s.homework);
  const data = usePlannerData();
  const now = useNow();
  const today = toDateKey(now);
  const [filter, setFilter] = useState<'open' | 'done'>('open');
  const open = useMemo(() => openHomework(data), [data]);
  const done = useMemo(() => homework.filter((h) => h.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')), [homework]);
  const list = filter === 'open' ? open : done;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented<'open' | 'done'>
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: `Offen ${open.length}` },
            { value: 'done', label: `Erledigt ${done.length}` },
          ]}
        />
        <Button size="sm" variant="secondary" icon={Plus} onClick={onNew}>Einzelne Hausaufgabe</Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={NotebookPen} title={filter === 'open' ? 'Keine offenen Hausaufgaben' : 'Noch nichts erledigt'} />
      ) : (
        <div className="-mx-2 divide-y divide-white/[0.04]">
          {list.map((h) => (
            <HomeworkItem key={h.id} homework={h} today={today} now={now} onOpen={onOpen} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Tests ───────────────────────────────────────────────────

function ExamsTab({ onOpen, onNew }: { onOpen: (e: Exam) => void; onNew: () => void }) {
  const exams = useAppStore((s) => s.exams);
  const now = useNow();
  const today = toDateKey(now);
  const upcoming = useMemo(() => exams.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)), [exams, today]);
  const past = useMemo(() => exams.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date)), [exams, today]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Anstehend" icon={ClipboardList} action={<Button size="sm" variant="secondary" icon={Plus} onClick={onNew}>Neuer Test</Button>} />
        {upcoming.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Keine anstehenden Tests" text="Trag Klassenarbeiten und Tests ein – LifeOS plant die Lernzeit davor." />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {upcoming.map((e) => (
              <ExamCard key={e.id} exam={e} today={today} now={now} onOpen={onOpen} />
            ))}
          </div>
        )}
      </Card>
      {past.length > 0 && (
        <Card className="opacity-70">
          <CardHeader title="Vergangen" />
          <div className="grid gap-2 md:grid-cols-2">
            {past.map((e) => (
              <ExamCard key={e.id} exam={e} today={today} now={now} onOpen={onOpen} compact />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
