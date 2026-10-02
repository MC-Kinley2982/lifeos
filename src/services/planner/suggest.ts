import { ENERGY_LABEL, TIME_OF_DAY_LABEL } from '../../domain/labels';
import { formatDuration, minutesSinceMidnight, toDateKey, toHHMM, weekDays } from '../../domain/time';
import type { DateKey, DaySchedule, EnergyLevel, ScheduleBlock, Task, TaskEnergy } from '../../domain/types';
import { energyFits, estimateEnergy, requiredEnergy } from './energy';
import { timeOfDayAt } from './freeTime';
import { computeGoalProgress } from './goals';
import { buildDaySchedule } from './schedule';
import { priorityScore, urgencyScore } from './scoring';
import type { NowSuggestion, PlannerData, SuggestionItem } from './types';

const MAX_ITEMS = 3;
const NEED_WORD: Record<TaskEnergy, string> = { low: 'wenig', medium: 'mittlere', high: 'viel' };

/**
 * "Was soll ich jetzt machen?"
 * Analysiert Uhrzeit, Energie, nächste feste Termine, offene Aufgaben, Priorität,
 * Deadline und benötigte Energie – und liefert einen nachvollziehbaren Vorschlag.
 */
export function suggestNow(data: PlannerData, now: Date): NowSuggestion {
  const { planning } = data.settings;
  const today = toDateKey(now);
  const nowMin = minutesSinceMidnight(now);
  const schedule = buildDaySchedule(data, today);

  // ── Nachtruhe ──────────────────────────────────────────────
  if (nowMin < schedule.awake.start || nowMin >= schedule.awake.end) {
    const energy = estimateEnergy(data, schedule, nowMin);
    return {
      mode: 'night',
      headline: 'Eigentlich ist jetzt Schlafenszeit.',
      lines: [
        nowMin < schedule.awake.start
          ? `Dein Tag startet um ${toHHMM(schedule.awake.start)}.`
          : 'Leg das Handy weg – morgen ist ein neuer Tag.',
      ],
      energy,
      fromMinute: nowMin,
      availableMin: 0,
      items: [],
      laterForEnergy: [],
    };
  }

  // ── Laufender Block? Dann gilt der Vorschlag ab dessen Ende. ─
  const busyNow = (m: number) => schedule.blocks.find((b) => b.blocksFreeTime && b.kind !== 'sleep' && b.start <= m && m < b.end);
  const currentBlock = busyNow(nowMin);
  const currentTask = currentBlock?.kind === 'task' ? data.tasks.find((t) => t.id === currentBlock.sourceId) : undefined;

  let fromMinute = nowMin;
  if (currentBlock && !currentTask) {
    let guard = 0;
    let block: ScheduleBlock | undefined = currentBlock;
    while (block && block.kind !== 'task' && guard++ < 20) {
      fromMinute = block.end;
      block = busyNow(fromMinute);
    }
  }

  const nextBlock = schedule.blocks
    .filter((b) => b.blocksFreeTime && b.kind !== 'sleep' && b.kind !== 'task' && b.start >= fromMinute)
    .sort((a, b) => a.start - b.start)[0];
  const untilMin = Math.min(nextBlock?.start ?? schedule.awake.end, schedule.awake.end);
  const availableMin = Math.max(0, untilMin - fromMinute);
  const energy = estimateEnergy(data, schedule, fromMinute);

  const lines: string[] = [];
  if (currentBlock && !currentTask) {
    lines.push(`Gerade: ${currentBlock.title} bis ${toHHMM(currentBlock.end)}. Frei ab ${toHHMM(fromMinute)}:`);
  }
  lines.push(availabilityLine(availableMin, nextBlock, untilMin, schedule));
  lines.push(energyLine(energy.level));

  // ── Laut Plan läuft gerade eine Aufgabe ────────────────────
  if (currentTask && currentBlock && currentTask.status !== 'done') {
    return {
      mode: 'tasks',
      headline: `Laut Plan: ${currentTask.title}`,
      lines: [`Eingeplant bis ${toHHMM(currentBlock.end)}.`, energyLine(energy.level)],
      energy,
      fromMinute: nowMin,
      availableMin: currentBlock.end - nowMin,
      currentBlock,
      nextBlock,
      items: [
        {
          key: currentTask.id,
          task: currentTask,
          title: currentTask.title,
          minutes: currentBlock.end - nowMin,
          partial: false,
          reasons: ['Steht jetzt in deinem Tagesplan'],
        },
      ],
      laterForEnergy: [],
    };
  }

  // ── Kandidaten bewerten ────────────────────────────────────
  const candidates: Array<SuggestionItem & { score: number }> = [];
  const laterForEnergy: SuggestionItem[] = [];

  for (const task of data.tasks) {
    if (task.status === 'done') continue;
    const item = scoreTask(data, task, today, fromMinute, energy.level);
    if (!energyFits(data, task.energy, energy.level)) {
      laterForEnergy.push({ ...item, reasons: [`Braucht ${NEED_WORD[task.energy]} Energie (ab ${requiredEnergy(data, task.energy)}/5)`] });
      continue;
    }
    candidates.push(item);
  }

  // Ziele, die diese Woche hinterherhinken, als zusätzliche Kandidaten.
  const goalProgress = computeGoalProgress(data, weekDays(today, data.settings.ui.weekStartsOn), now);
  for (const goal of data.goals) {
    if (!goal.active) continue;
    const p = goalProgress[goal.id];
    if (!p || p.remainingMin <= 0) continue;
    if (data.tasks.some((t) => t.goalId === goal.id && t.status !== 'done')) continue; // offene Aufgabe deckt das ab
    if (!energyFits(data, goal.energy, energy.level)) continue;
    const minutes = Math.min(goal.sessionMin || planning.defaultGoalSessionMin, p.remainingMin);
    candidates.push({
      key: `goal:${goal.id}`,
      goal,
      title: goal.title,
      minutes,
      partial: false,
      reasons: [`Ziel: noch ${formatDuration(p.remainingMin)} diese Woche`],
      score: 20,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.minutes - b.minutes);

  // ── Verfügbare Zeit füllen (greedy) ────────────────────────
  const items: SuggestionItem[] = [];
  let left = availableMin;
  for (const c of candidates) {
    if (items.length >= MAX_ITEMS) break;
    if (c.minutes <= left) {
      items.push(stripScore(c));
      left -= c.minutes;
    }
  }

  // Passt nichts komplett, aber etwas Wichtiges steht an → Anfang machen.
  if (items.length === 0 && candidates.length > 0 && availableMin >= planning.minSlotMin) {
    const top = candidates[0];
    if (top.score >= 40) {
      items.push({ ...stripScore(top), minutes: availableMin, partial: true, reasons: [...top.reasons, `Schon mal ${formatDuration(availableMin)} anfangen`] });
    }
  }

  if (availableMin < planning.minSlotMin) {
    return {
      mode: 'short',
      headline: availableMin > 0 ? `Nur ${formatDuration(availableMin)} Zeit.` : 'Gleich geht es weiter.',
      lines: [...lines.slice(0, -1), 'Kurz durchatmen, etwas trinken, Sachen bereitlegen.'],
      energy,
      fromMinute,
      availableMin,
      currentBlock,
      nextBlock,
      items,
      laterForEnergy: [],
    };
  }

  if (items.length === 0) {
    const lowEnergy = energy.level <= 1;
    return {
      mode: lowEnergy ? 'rest' : 'free',
      headline: lowEnergy ? 'Gönn dir eine Pause.' : 'Nichts Dringendes – das ist Freizeit.',
      lines: [
        ...lines,
        lowEnergy
          ? 'Deine Energie ist sehr niedrig. Erholung ist jetzt das Produktivste.'
          : 'Du musst diese Zeit nicht füllen. Mach, worauf du Lust hast.',
      ],
      energy,
      fromMinute,
      availableMin,
      currentBlock,
      nextBlock,
      items: [],
      laterForEnergy: laterForEnergy.slice(0, 3),
    };
  }

  return {
    mode: 'tasks',
    headline: energy.level <= 2 ? 'Wenig Energie – also etwas Leichtes:' : 'Mein Vorschlag:',
    lines,
    energy,
    fromMinute,
    availableMin,
    currentBlock,
    nextBlock,
    items,
    laterForEnergy: laterForEnergy.slice(0, 3),
  };
}

function scoreTask(
  data: PlannerData,
  task: Task,
  today: DateKey,
  minute: number,
  energy: EnergyLevel,
): SuggestionItem & { score: number } {
  const { planning } = data.settings;
  const urgency = urgencyScore(task.deadline, today);
  const prio = priorityScore(task.priority);
  const reasons = [urgency.reason, prio.reason].filter((r): r is string => !!r);
  let score = urgency.points + prio.points;

  if (task.schedule?.date === today && !task.schedule.start) {
    score += 25;
    reasons.push('Für heute vorgenommen');
  } else if (task.schedule?.start && task.schedule.date === today) {
    score -= 15; // hat später einen eigenen Platz
  } else if (task.schedule && task.schedule.date > today) {
    score -= 30;
  }

  const need = requiredEnergy(data, task.energy);
  if (energy >= 4 && need >= 4) {
    score += 15;
    reasons.push('Viel Energie – gute Zeit für Anspruchsvolles');
  } else if (energy <= 2 && task.energy === 'low') {
    score += 15;
    reasons.push('Leicht – passt zu deiner Energie');
  }

  if (task.preferredTimeOfDay && timeOfDayAt(minute, planning) === task.preferredTimeOfDay) {
    score += 10;
    reasons.push(`Bevorzugt ${TIME_OF_DAY_LABEL[task.preferredTimeOfDay].toLowerCase()}`);
  }
  if (task.status === 'in_progress') {
    score += 10;
    reasons.push('Schon angefangen');
  }

  return { key: task.id, task, title: task.title, minutes: Math.max(5, task.estimatedMin), partial: false, reasons, score };
}

function stripScore(c: SuggestionItem & { score: number }): SuggestionItem {
  const { score: _score, ...rest } = c;
  return rest;
}

function availabilityLine(available: number, next: ScheduleBlock | undefined, until: number, schedule: DaySchedule): string {
  const dur = formatDuration(available);
  if (!next || until >= schedule.awake.end) return `Du hast ${dur} bis zur Schlafenszeit (${toHHMM(schedule.awake.end)}).`;
  if (next.kind === 'travel') return `Du hast ${dur}, bevor du los musst (${toHHMM(next.start)}).`;
  return `Du hast ${dur} bis ${next.title} (${toHHMM(next.start)}).`;
}

function energyLine(level: EnergyLevel): string {
  if (level <= 2) return `Deine Energie ist gerade ${ENERGY_LABEL[level].toLowerCase()} (${level}/5).`;
  if (level >= 4) return `Deine Energie ist ${ENERGY_LABEL[level].toLowerCase()} (${level}/5) – nutz das!`;
  return `Deine Energie ist normal (${level}/5).`;
}
