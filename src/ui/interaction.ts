import { useEffect, useState } from 'react';

/**
 * Erkennt, ob der Nutzer gerade mit etwas anderem beschäftigt ist – damit automatische Dialoge
 * (z. B. die Hausaufgaben-Nachfrage nach der Schule) nicht mitten ins Tippen springen und
 * Fokus oder Enter "klauen".
 */

/** So lange nach dem letzten Tastendruck gilt der Nutzer noch als "tippt gerade". */
export const TYPING_GRACE_MS = 5000;

let lastKeyAt = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => (lastKeyAt = Date.now()), true);
}

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file', 'image']);

/** Kann man in dieses Element gerade tippen? */
export function isEditable(el: Element | null): boolean {
  if (!el || typeof HTMLElement === 'undefined' || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(el.type);
}

/** Tippt der Nutzer gerade, oder ist schon ein anderer Dialog offen? */
export function isUserBusy(now = Date.now()): boolean {
  if (isEditable(document.activeElement)) return true;
  if (now - lastKeyAt < TYPING_GRACE_MS) return true;
  return document.querySelector('[role="dialog"]') !== null;
}

/**
 * Liefert `true`, sobald `want` gilt UND der Nutzer gerade nicht beschäftigt ist.
 * Solange er tippt oder ein anderer Dialog offen ist, wird gewartet und regelmäßig neu geprüft.
 */
export function useWhenUserIdle(want: boolean, checkMs = 2000): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!want) {
      setReady(false);
      return;
    }
    let done = false;
    const check = () => {
      if (done || isUserBusy()) return;
      done = true;
      setReady(true);
    };
    // activeElement ist erst nach dem focusout-Ereignis aktualisiert.
    const onFocusOut = () => window.setTimeout(check, 0);
    check();
    const id = window.setInterval(check, checkMs);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      done = true;
      window.clearInterval(id);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [want, checkMs]);

  return want && ready;
}
