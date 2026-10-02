import { useEffect, useMemo, useState } from 'react';
import { toDateKey } from '../../domain/time';
import { shouldAskForHomework } from '../../services/school/prompt';
import { useNow, usePlannerData } from '../../store/hooks';
import { useAppStore } from '../../store/useAppStore';
import { HomeworkCaptureSheet } from './HomeworkCaptureSheet';

const SNOOZE_MIN = 90;

/**
 * Fragt nach Schulschluss einmal pro Tag nach neuen Hausaufgaben.
 * "Später" vertagt um 90 Minuten, "Keine Hausaufgaben"/"Hinzufügen" beendet die Nachfrage für heute.
 * Der Status liegt im Tageszustand – wird also auch zwischen Geräten synchronisiert.
 */
export function AfterSchoolPrompt({ enabled }: { enabled: boolean }) {
  const data = usePlannerData();
  const now = useNow(60_000);
  const setHomeworkPrompt = useAppStore((s) => s.setHomeworkPrompt);
  const [open, setOpen] = useState(false);
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const today = toDateKey(now);
  const ask = useMemo(() => enabled && shouldAskForHomework(data, now), [enabled, data, minuteKey]);

  useEffect(() => {
    if (ask) setOpen(true);
  }, [ask]);

  if (!open) return null;

  const snooze = () => {
    setHomeworkPrompt(today, 'snoozed', new Date(Date.now() + SNOOZE_MIN * 60_000).toISOString());
    setOpen(false);
  };

  return (
    <HomeworkCaptureSheet
      mode="prompt"
      date={today}
      onClose={() => setOpen(false)}
      onSnooze={snooze}
      onDone={() => setHomeworkPrompt(today, 'done')}
    />
  );
}
