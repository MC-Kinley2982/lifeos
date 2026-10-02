import { toMinutes } from '../../domain/time';
import type { DaySchedule, EnergyLevel, EnergyState, TaskEnergy } from '../../domain/types';
import { getDailyState } from './dayState';
import type { PlannerData } from './types';

/**
 * Energie zu einem Zeitpunkt.
 *
 * 1. Manueller Wert des Tages gewinnt immer (auch gegenüber Zustands-Grenzen).
 * 2. Sonst: Zeitfenster-Wert → überschrieben durch "während Kategorie" →
 *    überschrieben durch "nach Kategorie" (endet nach Dauer oder nach einer Pause).
 * 3. Danach greift ggf. die Energie-Obergrenze des Tageszustands (z. B. Krank).
 */
export function estimateEnergy(data: PlannerData, schedule: DaySchedule, minute: number): EnergyState {
  const daily = getDailyState(data, schedule.date);
  if (daily.energy) {
    return { level: daily.energy, source: 'manual', reason: 'Von dir für heute eingestellt', capped: false };
  }

  const { energy } = data.settings;
  let level: EnergyLevel = energy.baseline;
  let reason = 'Grundwert';

  const window = energy.timeWindows.find((w) => toMinutes(w.start) <= minute && minute < toMinutes(w.end));
  if (window) {
    level = window.level;
    reason = window.label;
  }

  const activities = schedule.blocks.filter((b) => (b.kind === 'routine' || b.kind === 'school' || b.kind === 'event') && b.categoryId);
  const current = activities.find((b) => b.start <= minute && minute < b.end);
  const duringRule = current && energy.categoryRules.find((r) => r.categoryId === current.categoryId && r.duringLevel);

  if (current && duringRule?.duringLevel) {
    level = duringRule.duringLevel;
    reason = `Während ${current.title}`;
  } else {
    const recent = activities.filter((b) => b.end <= minute).sort((a, b) => b.end - a.end);
    for (const block of recent) {
      const rule = energy.categoryRules.find((r) => r.categoryId === block.categoryId && r.afterLevel);
      if (!rule?.afterLevel) continue;
      if (minute < block.end + rule.afterDurationMin) {
        const hadBreak = schedule.blocks.some((b) => b.kind === 'break' && b.start >= block.end && b.end <= minute);
        if (!hadBreak) {
          level = rule.afterLevel;
          reason = `Nach ${block.title}`;
        }
      }
      break;
    }
  }

  const cap = schedule.dayState.definition.energyCap;
  if (cap && level > cap) {
    return { level: cap, source: 'estimated', reason: `${reason} · begrenzt (${schedule.dayState.definition.name})`, capped: true };
  }
  return { level, source: 'estimated', reason, capped: false };
}

/** Mindest-Energie, die eine Aufgabe braucht (aus den Planungs-Einstellungen). */
export function requiredEnergy(data: PlannerData, energy: TaskEnergy): EnergyLevel {
  return data.settings.planning.energyRequirement[energy];
}

export function energyFits(data: PlannerData, energy: TaskEnergy, current: EnergyLevel): boolean {
  return requiredEnergy(data, energy) <= current;
}
