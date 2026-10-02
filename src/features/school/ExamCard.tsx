import { ClipboardList } from 'lucide-react';
import { formatDateMedium, formatDuration, formatHoursClock } from '../../domain/time';
import type { Exam } from '../../domain/types';
import { studyProgress } from '../../services/school/exams';
import { isBlockUpcoming } from '../../services/school/homework';
import { subjectLabel } from '../../services/school/timetable';
import { alpha } from '../../ui/cn';
import { ProgressBar } from '../../ui/controls';
import { countdown, formatBlock } from './format';
import { useSubject } from './SchoolBits';

export function ExamCard({ exam, today, now, onOpen, compact }: { exam: Exam; today: string; now: Date; onOpen: (e: Exam) => void; compact?: boolean }) {
  const label = subjectLabel(useSubject(exam.subjectId));
  const progress = studyProgress(exam, now);
  const next = exam.studySessions
    .filter((s) => !s.done && isBlockUpcoming(s, now))
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0];
  const soon = exam.date <= today;

  return (
    <button
      type="button"
      onClick={() => onOpen(exam)}
      className="block w-full rounded-2xl border p-3 text-left transition-colors hover:brightness-110"
      style={{ borderColor: alpha(label.color, 0.25), background: alpha(label.color, 0.07) }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: alpha(label.color, 0.18), color: label.color }}>
          <ClipboardList size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="truncate text-sm font-semibold">
              {label.name} · {exam.title}
            </span>
            <span className="shrink-0 text-xs font-medium" style={{ color: soon ? '#fbbf24' : label.color }}>
              {countdown(exam.date, today)}
            </span>
          </div>
          <p className="text-[11px] text-ink-muted">
            {formatDateMedium(exam.date)}
            {exam.startTime ? ` · ${exam.startTime}` : ''}
            {exam.room ? ` · Raum ${exam.room}` : ''}
          </p>
          {exam.desiredStudyMinutes > 0 && (
            <>
              <ProgressBar className="mt-2.5" value={progress.percent} planned={progress.targetMin ? (progress.plannedMin / progress.targetMin) * 100 : 0} color={label.color} />
              <p className="mt-1.5 text-[11px] text-ink-muted tabular">
                {formatHoursClock(progress.doneMin)} / {formatHoursClock(progress.targetMin)} h gelernt
                {progress.plannedMin > 0 && ` · ${formatHoursClock(progress.plannedMin)} h geplant`}
                {progress.remainingMin > 0 && <span className="text-amber-300"> · {formatDuration(progress.remainingMin)} offen</span>}
              </p>
              {!compact && next && <p className="mt-0.5 text-[11px] text-ink-faint">Nächste Einheit: {formatBlock(next, today)}</p>}
            </>
          )}
        </div>
      </div>
    </button>
  );
}
