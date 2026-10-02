import { useMemo } from 'react';
import { GraduationCap, NotebookPen } from 'lucide-react';
import { hrefFor, PATHS } from '../../app/router';
import { addDays, toHHMM } from '../../domain/time';
import type { DateKey, DaySchedule, Exam, Homework } from '../../domain/types';
import { upcomingExams } from '../../services/school/exams';
import { openHomework } from '../../services/school/homework';
import { usePlannerData } from '../../store/hooks';
import { Button } from '../../ui/Button';
import { Card, CardHeader } from '../../ui/Card';
import { alpha } from '../../ui/cn';
import { ExamCard } from './ExamCard';
import { HomeworkItem } from './HomeworkItem';

interface Props {
  date: DateKey;
  now: Date;
  schedule: DaySchedule;
  onCapture: () => void;
  onOpenHomework: (h: Homework) => void;
  onOpenExam: (e: Exam) => void;
}

/** Schule auf einen Blick: heutige Fächer, fällige Hausaufgaben, nahe Tests. */
export function SchoolTodayCard({ date, now, schedule, onCapture, onOpenHomework, onOpenExam }: Props) {
  const data = usePlannerData();
  const tomorrow = addDays(date, 1);
  const homework = useMemo(
    () => openHomework(data).filter((h) => h.deadline.date <= tomorrow || h.plannedBlocks.some((b) => b.date === date && !b.done)),
    [data, date, tomorrow],
  );
  const exams = useMemo(() => upcomingExams(data, date, 7), [data, date]);

  if (!data.settings.school.enabled || data.subjects.length === 0) return null;
  const lessons = schedule.lessons;
  const end = lessons.length ? Math.max(...lessons.map((l) => l.end)) : null;

  return (
    <Card>
      <CardHeader
        title="Schule"
        icon={GraduationCap}
        subtitle={end !== null ? `${lessons.length} Stunden · bis ${toHHMM(end)}` : 'Heute kein Unterricht'}
        action={
          <a href={hrefFor(PATHS.school())} className="text-xs text-violet-300 hover:underline">
            Öffnen
          </a>
        }
      />
      {lessons.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {lessons.map((l) => (
            <span key={l.entryId} className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: alpha(l.color, 0.16), color: l.color }} title={`${toHHMM(l.start)}–${toHHMM(l.end)}`}>
              {l.title}
            </span>
          ))}
        </div>
      )}
      {homework.length > 0 && (
        <div className="-mx-2 mb-2">
          {homework.slice(0, 4).map((h) => (
            <HomeworkItem key={h.id} homework={h} today={date} now={now} onOpen={onOpenHomework} />
          ))}
        </div>
      )}
      {exams.length > 0 && (
        <div className="mb-3 space-y-2">
          {exams.slice(0, 2).map((e) => (
            <ExamCard key={e.id} exam={e} today={date} now={now} onOpen={onOpenExam} compact />
          ))}
        </div>
      )}
      <Button variant="secondary" icon={NotebookPen} block onClick={onCapture}>
        Hausaufgaben eintragen
      </Button>
    </Card>
  );
}
