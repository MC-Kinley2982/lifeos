import { useState } from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { toDateKey } from '../../domain/time';
import type { SchoolPlanResult } from '../../services/school/types';
import { replanSchool } from '../../store/schoolAutomation';
import { Button } from '../../ui/Button';
import { formatBlock } from './format';

/**
 * Zeigt, wohin Hausaufgaben/Lernzeit eingeplant wurden – und bietet bei Engpässen an,
 * den Freizeit-Schutz für genau diese Aufgabe auszusetzen (nur auf ausdrücklichen Wunsch).
 */
export function PlanResultView({ result, titles }: { result: SchoolPlanResult; titles: Array<{ id: string; owner: 'homework' | 'exam'; title: string }> }) {
  const today = toDateKey(new Date());
  const [current, setCurrent] = useState(result);

  const force = (id: string, owner: 'homework' | 'exam') => {
    const extra = replanSchool(owner === 'homework' ? { homeworkIds: [id], overBudgetIds: [id] } : { examIds: [id], overBudgetIds: [id] }, true);
    setCurrent((prev) => ({
      ...prev,
      added: [...prev.added, ...extra.added],
      unplanned: [...prev.unplanned.filter((u) => u.id !== id), ...extra.unplanned],
    }));
  };

  return (
    <div className="space-y-2">
      {titles.map((t) => {
        const blocks = current.added.filter((a) => a.id === t.id).map((a) => a.block);
        const gap = current.unplanned.find((u) => u.id === t.id);
        return (
          <div key={t.id} className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-start gap-2">
              {gap ? <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-300" /> : <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {blocks.length > 0 && (
                  <p className="mt-0.5 text-xs text-ink-muted">Eingeplant: {blocks.map((b) => formatBlock(b, today)).join(' · ')}</p>
                )}
                {blocks.length === 0 && !gap && <p className="mt-0.5 text-xs text-ink-muted">Bereits eingeplant oder nichts zu planen.</p>}
                {gap && (
                  <>
                    <p className="mt-0.5 text-xs text-amber-200/90">{gap.reason}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={() => force(t.id, t.owner)}>
                      Trotzdem einplanen (Freizeit kürzen)
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
