import { minutesSinceMidnight, toDateKey } from '../../domain/time';
import { awakeWindow } from '../planner/schedule';
import type { PlannerData } from '../planner/types';
import { schoolEndOn, subjectsOn } from './timetable';

/**
 * Soll gerade nach neuen Hausaufgaben gefragt werden?
 * Ja, wenn heute Unterricht war, die Schule vorbei ist, die Nachfrage aktiviert ist
 * und sie heute weder beantwortet noch gerade vertagt wurde.
 */
export function shouldAskForHomework(data: PlannerData, now: Date): boolean {
  const { settings } = data;
  if (!settings.onboardingDone || !settings.school.enabled || !settings.school.askForHomework) return false;
  const today = toDateKey(now);
  const end = schoolEndOn(data, today);
  if (end === null) return false;
  const minute = minutesSinceMidnight(now);
  if (minute < end || minute >= awakeWindow(settings.sleep, today).end) return false;
  const prompt = data.dailyStates[today]?.homeworkPrompt;
  if (prompt?.status === 'done') return false;
  if (prompt?.status === 'snoozed' && prompt.until && new Date(prompt.until) > now) return false;
  return subjectsOn(data, today).length > 0;
}
