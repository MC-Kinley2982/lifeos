import { useState } from 'react';
import { ArrowRight, Check, LayoutTemplate, LogIn, Sparkles } from 'lucide-react';
import { Logo } from '../../app/AppShell';
import { todayKey } from '../../domain/time';
import { useCloud } from '../../store/cloud';
import { useAppStore } from '../../store/useAppStore';
import { AuthForm } from '../cloud/AuthForm';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Field, TextInput } from '../../ui/fields';

export function Welcome() {
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [name, setName] = useState('');
  const [withExample, setWithExample] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const cloudOn = useCloud((s) => s.mode !== 'off');

  const start = () => completeOnboarding({ name: name.trim(), withExample, today: todayKey() });

  return (
    <div className="pt-safe flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <Logo className="mb-6 h-14 w-14" />
        <h1 className="text-3xl font-semibold tracking-tight">Willkommen bei LifeOS</h1>
        <p className="mt-2 text-ink-muted">
          Dein persönlicher Planer, der weiß, wie dein normaler Tag aussieht – und daraus deine freie Zeit, Energie und nächsten Schritte ableitet.
        </p>

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <Field label="Wie heißt du? (optional)">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Vorname" autoFocus />
          </Field>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-ink-muted">Womit möchtest du starten?</span>
            <Choice
              active={withExample}
              onClick={() => setWithExample(true)}
              icon={Sparkles}
              title="Mit Beispiel-Alltag"
              text="Schule, Fußball, Mahlzeiten, Schlaf, ein paar Aufgaben und ein Ziel – alles frei anpassbar."
            />
            <Choice
              active={!withExample}
              onClick={() => setWithExample(false)}
              icon={LayoutTemplate}
              title="Leer starten"
              text="Nur Grundeinstellungen (Schlaf, Mahlzeiten, Tageszustände). Routinen legst du selbst an."
            />
          </div>

          <Button type="submit" variant="primary" size="lg" block iconRight={ArrowRight}>
            Los geht's
          </Button>
          <p className="text-center text-xs text-ink-faint">
            {cloudOn ? 'Kein Konto nötig – du kannst dich später anmelden, um Geräte zu synchronisieren.' : 'Alle Daten bleiben lokal auf diesem Gerät. Kein Konto nötig.'}
          </p>
        </form>

        {cloudOn && (
          <div className="mt-6 rounded-3xl border border-line bg-surface/80 p-4">
            {showLogin ? (
              <AuthForm />
            ) : (
              <button type="button" onClick={() => setShowLogin(true)} className="flex w-full items-center justify-between gap-3 text-left">
                <span>
                  <span className="block text-sm font-medium">Ich habe schon ein Konto</span>
                  <span className="block text-xs text-ink-muted">Anmelden und Daten von deinem anderen Gerät übernehmen</span>
                </span>
                <LogIn size={18} className="shrink-0 text-violet-300" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Choice({ active, onClick, icon: Icon, title, text }: { active: boolean; onClick: () => void; icon: typeof Sparkles; title: string; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
        active ? 'border-violet-400/50 bg-violet-500/10' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', active ? 'bg-violet-500/25 text-violet-200' : 'bg-surface-3 text-ink-muted')}>
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{text}</span>
      </span>
      <span className={cn('mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', active ? 'border-violet-400 bg-violet-400' : 'border-white/20')}>
        {active && <Check size={12} strokeWidth={3} className="text-black/70" />}
      </span>
    </button>
  );
}
