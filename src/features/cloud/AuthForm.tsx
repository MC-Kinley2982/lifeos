import { useState } from 'react';
import { LogIn, MailCheck, UserPlus } from 'lucide-react';
import { cloud } from '../../store/cloud';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/controls';
import { Field, TextInput } from '../../ui/fields';

/** Anmelden / Registrieren mit E-Mail und Passwort. */
export function AuthForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkMail, setCheckMail] = useState(false);

  const mismatch = mode === 'signup' && confirm.length > 0 && confirm !== password;
  const valid = email.includes('@') && password.length >= 6 && (mode === 'signin' || password === confirm);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') await cloud.signIn(email.trim(), password);
      else {
        const res = await cloud.signUp(email.trim(), password);
        if (res.needsConfirmation) setCheckMail(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (checkMail) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-400/[0.07] p-4 text-sm">
        <MailCheck size={20} className="mt-0.5 shrink-0 text-emerald-400" />
        <div>
          <p className="font-medium">Fast geschafft – bestätige deine E-Mail.</p>
          <p className="mt-1 text-ink-muted">
            Wir haben dir einen Link an <span className="text-ink">{email}</span> geschickt. Danach kannst du dich hier anmelden.
          </p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => { setCheckMail(false); setMode('signin'); }}>
            Zur Anmeldung
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <Segmented<'signin' | 'signup'>
        size="sm"
        value={mode}
        onChange={(m) => { setMode(m); setError(null); }}
        options={[
          { value: 'signin', label: 'Anmelden' },
          { value: 'signup', label: 'Registrieren' },
        ]}
      />
      <Field label="E-Mail">
        <TextInput type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" />
      </Field>
      <Field label="Passwort" hint={mode === 'signup' ? 'Mindestens 6 Zeichen, besser 8 oder mehr.' : undefined}>
        <TextInput type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {mode === 'signup' && (
        <Field label="Passwort wiederholen">
          <TextInput type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
      )}
      {mismatch && <p className="text-xs text-red-300">Die Passwörter stimmen nicht überein.</p>}
      {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <Button type="submit" variant="primary" block icon={mode === 'signin' ? LogIn : UserPlus} disabled={!valid || busy}>
        {busy ? 'Einen Moment …' : mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
      </Button>
    </form>
  );
}
