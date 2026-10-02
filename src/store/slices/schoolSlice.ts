import { stamp } from '../../domain/factories';
import { createId, nowIso } from '../../domain/ids';
import { minutesSinceMidnight, toDateKey, toMinutes } from '../../domain/time';
import type { Exam, Homework, SchoolBlock, Subject, TimetableEntry } from '../../domain/types';
import { patchEntity, removeById } from '../helpers';
import type { AppState, BlockOwner, SchoolActions, SliceCreator } from '../types';

export interface SchoolSlice extends SchoolActions {
  subjects: Subject[];
  timetable: TimetableEntry[];
  homework: Homework[];
  exams: Exam[];
}

/** Blöcke einer Hausaufgabe bzw. Lerneinheiten eines Tests unveränderlich bearbeiten. */
function mapBlocks(state: AppState, owner: BlockOwner, fn: (blocks: SchoolBlock[]) => SchoolBlock[]): Partial<AppState> {
  const ts = nowIso();
  if (owner.kind === 'homework') {
    return { homework: state.homework.map((h) => (h.id === owner.id ? { ...h, plannedBlocks: fn(h.plannedBlocks), updatedAt: ts } : h)) };
  }
  return { exams: state.exams.map((e) => (e.id === owner.id ? { ...e, studySessions: fn(e.studySessions), updatedAt: ts } : e)) };
}

/** Liegt ein Block (noch) in der Zukunft? */
function isUpcoming(block: SchoolBlock, now: Date): boolean {
  const today = toDateKey(now);
  if (block.date !== today) return block.date > today;
  return toMinutes(block.start) + block.durationMin > minutesSinceMidnight(now);
}

export const createSchoolSlice: SliceCreator<SchoolSlice> = (set) => ({
  subjects: [],
  timetable: [],
  homework: [],
  exams: [],

  updateSchoolSettings: (patch) => set((s) => ({ settings: { ...s.settings, school: { ...s.settings.school, ...patch } } })),

  addSubject: (input) => {
    const subject = stamp(input, 'subj');
    set((s) => ({ subjects: [...s.subjects, subject] }));
    return subject.id;
  },
  updateSubject: (id, patch) => set((s) => ({ subjects: patchEntity(s.subjects, id, patch) })),
  removeSubject: (id) =>
    set((s) => ({
      subjects: removeById(s.subjects, id),
      timetable: s.timetable.filter((t) => t.subjectId !== id),
    })),

  addLesson: (input) => {
    const lesson = stamp(input, 'tt');
    set((s) => ({ timetable: [...s.timetable, lesson] }));
    return lesson.id;
  },
  updateLesson: (id, patch) => set((s) => ({ timetable: patchEntity(s.timetable, id, patch) })),
  removeLesson: (id) => set((s) => ({ timetable: removeById(s.timetable, id) })),

  addHomework: (input) => {
    const hw = stamp(input, 'hw');
    set((s) => ({ homework: [...s.homework, hw] }));
    return hw.id;
  },
  updateHomework: (id, patch) => set((s) => ({ homework: patchEntity(s.homework, id, patch) })),
  removeHomework: (id) => set((s) => ({ homework: removeById(s.homework, id) })),
  toggleHomeworkDone: (id) =>
    set((s) => {
      const now = new Date();
      return {
        homework: s.homework.map((h) => {
          if (h.id !== id) return h;
          const done = h.status !== 'done';
          return {
            ...h,
            status: done ? 'done' : 'todo',
            completedAt: done ? now.toISOString() : undefined,
            // Erledigt: kommende, noch offene Blöcke freigeben.
            plannedBlocks: done ? h.plannedBlocks.filter((b) => b.done || !isUpcoming(b, now)) : h.plannedBlocks,
            updatedAt: now.toISOString(),
          };
        }),
      };
    }),

  addExam: (input) => {
    const exam = stamp(input, 'exam');
    set((s) => ({ exams: [...s.exams, exam] }));
    return exam.id;
  },
  updateExam: (id, patch) => set((s) => ({ exams: patchEntity(s.exams, id, patch) })),
  removeExam: (id) => set((s) => ({ exams: removeById(s.exams, id) })),

  updateSchoolBlock: (owner, blockId, patch) =>
    set((s) =>
      mapBlocks(s, owner, (blocks) =>
        blocks.map((b) => {
          if (b.id !== blockId) return b;
          // Nur "erledigt" ändern lässt die Herkunft unverändert; Zeit/Datum ändern macht den Block manuell.
          const onlyDone = Object.keys(patch).every((k) => k === 'done');
          return { ...b, ...patch, source: onlyDone ? b.source : 'manual' };
        }),
      ),
    ),
  addSchoolBlock: (owner, block) => set((s) => mapBlocks(s, owner, (blocks) => [...blocks, { ...block, id: createId('blk') }])),
  removeSchoolBlock: (owner, blockId) => set((s) => mapBlocks(s, owner, (blocks) => blocks.filter((b) => b.id !== blockId))),
  toggleSchoolBlockDone: (owner, blockId) =>
    set((s) => mapBlocks(s, owner, (blocks) => blocks.map((b) => (b.id === blockId ? { ...b, done: !b.done } : b)))),

  applySchoolPlan: (result) =>
    set((s) => {
      const ts = nowIso();
      const hwIds = Object.keys(result.homework);
      const examIds = Object.keys(result.exams);
      if (hwIds.length === 0 && examIds.length === 0) return {};
      return {
        homework: s.homework.map((h) => (h.id in result.homework ? { ...h, plannedBlocks: result.homework[h.id], updatedAt: ts } : h)),
        exams: s.exams.map((e) => (e.id in result.exams ? { ...e, studySessions: result.exams[e.id], updatedAt: ts } : e)),
      };
    }),
});
