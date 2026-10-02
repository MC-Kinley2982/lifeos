import { create } from 'zustand';
import { CircleCheck, Info } from 'lucide-react';

/** Kurzlebige Rückmeldungen ("Plan übernommen"). Reiner UI-Zustand, wird nicht gespeichert. */
interface Toast {
  id: number;
  text: string;
  tone: 'success' | 'info';
}

interface ToastState {
  toasts: Toast[];
  push(text: string, tone?: Toast['tone']): void;
  dismiss(id: number): void;
}

let counter = 0;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (text, tone = 'success') => {
    const id = ++counter;
    set({ toasts: [...get().toasts, { id, text, tone }] });
    window.setTimeout(() => get().dismiss(id), 2800);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (text: string, tone?: Toast['tone']) => useToasts.getState().push(text, tone);

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex animate-slide-up items-center gap-2 rounded-2xl border border-line-strong bg-surface-3/95 px-4 py-2.5 text-sm shadow-xl backdrop-blur"
        >
          {t.tone === 'success' ? <CircleCheck size={16} className="text-emerald-400" /> : <Info size={16} className="text-violet-300" />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
