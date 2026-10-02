import { eventSource, mealSource, routineSource, SLEEP_SOURCE, taskSource } from '../../domain/sources';
import {
  addDays,
  getWeekday,
  isDateInRange,
  MINUTES_PER_DAY,
  subtractSlots,
  toMinutes,
  totalMinutes,
} from '../../domain/time';
import type {
  BlockKind,
  CalendarEvent,
  DaySchedule,
  DateKey,
  ScheduleBlock,
  SleepSettings,
  SleepTimes,
  SourceKey,
  TimeSlot,
  Weekday,
} from '../../domain/types';
import { getDailyState, isSourceActive, resolveDayState } from './dayState';
import type { PlannerData } from './types';

const NOON = 12 * 60;
/** Lücken unter dieser Länge zählen nicht als freie Zeit (reines Rauschen zwischen Blöcken). */
const NOISE_GAP_MIN = 5;

const KIND_ORDER: Record<BlockKind, number> = {
  sleep: 0,
  travel: 1,
  routine: 2,
  event: 3,
  meal: 4,
  task: 5,
  break: 6,
};

export function sleepTimesFor(sleep: SleepSettings, weekday: Weekday): SleepTimes {
  return sleep.perWeekday[weekday] ?? sleep.default;
}

/**
 * Wachzeit eines Tages, abgeleitet aus den Schlafeinstellungen.
 * Schlafenszeit vor 12:00 bedeutet "nach Mitternacht" → der Tag läuft bis 24:00.
 */
export function awakeWindow(sleep: SleepSettings, date: DateKey): TimeSlot {
  if (!sleep.enabled) return { start: 0, end: MINUTES_PER_DAY };
  const times = sleepTimesFor(sleep, getWeekday(date));
  const wake = toMinutes(times.wakeTime);
  const bed = toMinutes(times.bedtime);
  const end = bed >= NOON ? bed : MINUTES_PER_DAY;
  return { start: wake, end: Math.max(wake, end) };
}

/**
 * Baut den kompletten Tagesplan für ein Datum:
 * Schlaf, Mahlzeiten, Routinen, Termine, Wegzeiten, Pausen und fest eingeplante Aufgaben.
 * Berücksichtigt Tageszustand (Krank, Urlaub, …) und manuell ausgelassene Quellen.
 */
export function buildDaySchedule(data: PlannerData, date: DateKey): DaySchedule {
  const { settings } = data;
  const weekday = getWeekday(date);
  const dayState = resolveDayState(data, date);
  const daily = getDailyState(data, date);
  const skipped = new Set(daily.skippedSources);

  const blocks: ScheduleBlock[] = [];
  const inactive: DaySchedule['inactive'] = [];

  const gate = (sourceKey: SourceKey, title: string, categoryId?: string): boolean => {
    if (!isSourceActive(dayState.definition, sourceKey, categoryId)) {
      inactive.push({ sourceKey, title, reason: 'state' });
      return false;
    }
    if (skipped.has(sourceKey)) {
      inactive.push({ sourceKey, title, reason: 'skipped' });
      return false;
    }
    return true;
  };

  // ── Schlaf ──────────────────────────────────────────────────
  const awake = awakeWindow(settings.sleep, date);
  if (settings.sleep.enabled && gate(SLEEP_SOURCE, 'Schlaf')) {
    const prev = sleepTimesFor(settings.sleep, getWeekday(addDays(date, -1)));
    const prevBed = toMinutes(prev.bedtime);
    // Ging ich gestern erst nach Mitternacht ins Bett, beginnt der Schlaf heute erst dann.
    const morningStart = prevBed < NOON ? Math.min(prevBed, awake.start) : 0;
    if (awake.start > morningStart) {
      blocks.push(makeBlock(date, 'sleep', 'Schlaf', morningStart, awake.start, settings.sleep.color, SLEEP_SOURCE, { suffix: 'am' }));
    }
    if (awake.end < MINUTES_PER_DAY) {
      blocks.push(makeBlock(date, 'sleep', 'Schlaf', awake.end, MINUTES_PER_DAY, settings.sleep.color, SLEEP_SOURCE, { suffix: 'pm' }));
    }
  }

  // ── Mahlzeiten ──────────────────────────────────────────────
  for (const meal of settings.meals) {
    if (!meal.enabled || !meal.weekdays.includes(weekday)) continue;
    const key = mealSource(meal.id);
    if (!gate(key, meal.name)) continue;
    const start = toMinutes(meal.time);
    const end = Math.min(MINUTES_PER_DAY, start + Math.max(0, meal.durationMin));
    if (end <= start) continue;
    blocks.push(makeBlock(date, 'meal', meal.name, start, end, meal.color, key, { sourceId: meal.id, skippable: true }));
  }

  // ── Routinen ────────────────────────────────────────────────
  for (const routine of data.routines) {
    if (!routine.enabled || !routine.weekdays.includes(weekday)) continue;
    if (!isDateInRange(date, routine.validFrom, routine.validUntil)) continue;
    const key = routineSource(routine.id);
    if (!gate(key, routine.name, routine.categoryId)) continue;
    const start = toMinutes(routine.start);
    const end = toMinutes(routine.end);
    if (end <= start) continue;
    const main = makeBlock(date, 'routine', routine.name, start, end, routine.color, key, {
      sourceId: routine.id,
      categoryId: routine.categoryId,
      blocksFreeTime: routine.blocksFreeTime,
      priority: routine.priority,
      goalId: routine.goalId,
      skippable: true,
    });
    blocks.push(main, ...travelBlocks(main, routine.travelBeforeMin, routine.travelAfterMin));
  }

  // ── Einmalige Termine ───────────────────────────────────────
  const allDayEvents: CalendarEvent[] = [];
  for (const event of data.events) {
    if (event.date !== date) continue;
    if (event.allDay) {
      allDayEvents.push(event);
      continue;
    }
    const start = toMinutes(event.start);
    const end = toMinutes(event.end);
    if (end <= start) continue;
    const color = event.color ?? categoryColor(data, event.categoryId);
    const main = makeBlock(date, 'event', event.title, start, end, color, eventSource(event.id), {
      sourceId: event.id,
      categoryId: event.categoryId,
      blocksFreeTime: event.blocksFreeTime,
      goalId: event.goalId,
    });
    blocks.push(main, ...travelBlocks(main, event.travelBeforeMin, event.travelAfterMin));
  }

  // ── Pausen-Regeln ───────────────────────────────────────────
  blocks.push(...breakBlocks(data, date, blocks, awake, skipped));

  // ── Fest eingeplante Aufgaben ───────────────────────────────
  for (const task of data.tasks) {
    if (task.schedule?.date !== date || !task.schedule.start) continue;
    const start = toMinutes(task.schedule.start);
    const end = Math.min(MINUTES_PER_DAY, start + Math.max(5, task.estimatedMin));
    blocks.push(
      makeBlock(date, 'task', task.title, start, end, categoryColor(data, task.categoryId), taskSource(task.id), {
        sourceId: task.id,
        categoryId: task.categoryId,
        priority: task.priority,
        goalId: task.goalId,
      }),
    );
  }

  blocks.sort((a, b) => a.start - b.start || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.end - b.end);

  const busy = blocks.filter((b) => b.blocksFreeTime).map((b) => ({ start: b.start, end: b.end }));
  const freeSlots = subtractSlots([awake], busy).filter((s) => s.end - s.start >= NOISE_GAP_MIN);
  const scheduledTaskMin = blocks.filter((b) => b.kind === 'task').reduce((sum, b) => sum + (b.end - b.start), 0);

  return {
    date,
    weekday,
    dayState,
    awake,
    blocks,
    allDayEvents,
    inactive,
    freeSlots,
    totalFreeMin: totalMinutes(freeSlots),
    scheduledTaskMin,
  };
}

// ─── Hilfsfunktionen ─────────────────────────────────────────

interface BlockOptions {
  sourceId?: string;
  categoryId?: string;
  blocksFreeTime?: boolean;
  priority?: ScheduleBlock['priority'];
  goalId?: string;
  relatedTo?: string;
  skippable?: boolean;
  suffix?: string;
}

function makeBlock(
  date: DateKey,
  kind: BlockKind,
  title: string,
  start: number,
  end: number,
  color: string,
  sourceKey: SourceKey,
  opts: BlockOptions = {},
): ScheduleBlock {
  return {
    id: `${sourceKey}@${date}${opts.suffix ? `#${opts.suffix}` : ''}`,
    date,
    start: Math.max(0, start),
    end: Math.min(MINUTES_PER_DAY, end),
    kind,
    title,
    color,
    categoryId: opts.categoryId,
    sourceKey,
    sourceId: opts.sourceId,
    blocksFreeTime: opts.blocksFreeTime ?? true,
    priority: opts.priority,
    goalId: opts.goalId,
    relatedTo: opts.relatedTo,
    skippable: opts.skippable ?? false,
  };
}

function travelBlocks(main: ScheduleBlock, beforeMin: number, afterMin: number): ScheduleBlock[] {
  const out: ScheduleBlock[] = [];
  if (beforeMin > 0) {
    out.push(
      makeBlock(main.date, 'travel', `Hinweg · ${main.title}`, main.start - beforeMin, main.start, main.color, main.sourceKey, {
        suffix: 'before',
        relatedTo: main.id,
        blocksFreeTime: main.blocksFreeTime,
        categoryId: main.categoryId,
      }),
    );
  }
  if (afterMin > 0) {
    out.push(
      makeBlock(main.date, 'travel', `Rückweg · ${main.title}`, main.end, main.end + afterMin, main.color, main.sourceKey, {
        suffix: 'after',
        relatedTo: main.id,
        blocksFreeTime: main.blocksFreeTime,
        categoryId: main.categoryId,
      }),
    );
  }
  return out;
}

function breakBlocks(
  data: PlannerData,
  date: DateKey,
  existing: ScheduleBlock[],
  awake: TimeSlot,
  skipped: Set<SourceKey>,
): ScheduleBlock[] {
  const out: ScheduleBlock[] = [];
  const anchors = existing.filter((b) => b.kind === 'routine' || b.kind === 'event' || b.kind === 'meal');
  const blocking = existing.filter((b) => b.blocksFreeTime && b.kind !== 'sleep');

  for (const rule of data.settings.breakRules) {
    if (!rule.enabled || rule.durationMin <= 0) continue;
    const ruleKey = `break:${rule.id}`;
    if (skipped.has(ruleKey)) continue;

    const matches = anchors.filter((b) => {
      const t = rule.trigger;
      if (t.type === 'afterSource') return b.sourceKey === t.sourceKey;
      if (t.type === 'afterCategory') return b.kind !== 'meal' && b.categoryId === t.categoryId;
      return b.kind !== 'meal' && b.blocksFreeTime && b.end - b.start >= t.minBlockMin;
    });

    for (const anchor of matches) {
      // Pause beginnt nach einem evtl. Rückweg.
      const travelAfter = existing.find((b) => b.kind === 'travel' && b.relatedTo === anchor.id && b.start === anchor.end);
      const start = travelAfter ? travelAfter.end : anchor.end;
      if (start >= awake.end) continue;
      // Nicht in den nächsten festen Block hineinragen.
      const nextBusy = blocking
        .filter((b) => b.start >= start && b.id !== anchor.id && b.relatedTo !== anchor.id)
        .reduce((min, b) => Math.min(min, b.start), awake.end);
      const end = Math.min(start + rule.durationMin, nextBusy);
      if (end - start < 5) continue;
      const block = makeBlock(date, 'break', rule.name || 'Pause', start, end, '#64748b', ruleKey, {
        suffix: anchor.id,
        relatedTo: anchor.id,
        skippable: true,
      });
      // Greifen mehrere Regeln am selben Zeitpunkt, gewinnt die längste Pause.
      const clash = out.findIndex((b) => b.start === start);
      if (clash === -1) out.push(block);
      else if (end - start > out[clash].end - out[clash].start) out[clash] = block;
    }
  }
  return out;
}

function categoryColor(data: PlannerData, categoryId: string): string {
  return data.settings.categories.find((c) => c.id === categoryId)?.color ?? '#a1a1aa';
}
