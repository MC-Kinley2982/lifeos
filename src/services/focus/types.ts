import type { DateKey, ID } from '../../domain/types';

/**
 * Platzhalter für die spätere Focus-Co-Pilot-Anbindung.
 *
 * Idee: Der Focus Co-Pilot liefert echte Fokus-Sitzungen (z. B. für Ziel-Fortschritt
 * und Energie-Lernen) und kann geplante Blöcke als Fokus-Sessions übernehmen.
 * Noch nicht implementiert – die UI greift nie direkt auf diese Schicht zu.
 */
export interface FocusSession {
  id: string;
  date: DateKey;
  start: string;
  end: string;
  taskId?: ID;
  goalId?: ID;
  /** Selbst eingeschätzte Fokus-Qualität 1–5. */
  quality?: number;
}

export interface FocusProvider {
  id: string;
  name: string;
  isConnected(): boolean;
  listSessions(range: { from: DateKey; to: DateKey }): Promise<FocusSession[]>;
}
