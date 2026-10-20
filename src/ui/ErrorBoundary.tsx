import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

const RELOAD_KEY = 'lifeos-chunk-reload';

/** Fehler beim Nachladen eines Seiten-Bausteins (z. B. nach einem Update, wenn alte Dateien fehlen). */
function isChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Failed to fetch/i.test(msg);
}

/**
 * Fängt Fehler einer Seite ab, statt die ganze App leer zu lassen.
 * Fehlt nach einem Update ein nachzuladender Baustein, lädt die App einmal neu (dann ist die neue Version da).
 * Die Daten sind davon nie betroffen – sie liegen im Speicher des Geräts.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('LifeOS: Fehler in einer Seite', error, info.componentStack);
    if (isChunkError(error)) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        /* sessionStorage nicht verfügbar – dann bleibt der Hinweis stehen */
      }
    }
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Beim Wechsel auf eine andere Seite einen neuen Versuch erlauben.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = isChunkError(this.state.error);
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-line bg-surface/80 p-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
          <TriangleAlert size={22} />
        </span>
        <p className="font-medium">{chunk ? 'Neue Version verfügbar' : 'Hier ist etwas schiefgelaufen'}</p>
        <p className="mt-1 text-sm text-ink-muted">
          {chunk
            ? 'Ein Teil der App konnte nicht geladen werden – meist nach einem Update. Neu laden hilft.'
            : 'Dieser Bereich konnte nicht angezeigt werden. Deine Daten sind sicher gespeichert.'}
        </p>
        {!chunk && this.state.error instanceof Error && <p className="mt-2 font-mono text-[11px] break-words text-ink-faint">{this.state.error.message}</p>}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-surface-3 px-4 text-sm font-medium hover:bg-white/10"
        >
          <RefreshCw size={15} /> Neu laden
        </button>
      </div>
    );
  }
}
