# LifeOS – Personal Life Planner (V1)

Persönliche Life-Management-App als PWA. Sie weiß, wie dein normaler Tag aussieht (Schlaf, Mahlzeiten,
Routinen, Termine), berechnet daraus deine freie Zeit, schätzt deine Energie und plant Aufgaben regelbasiert ein.
Alles läuft lokal im Browser – kein Backend, kein Konto.

**Stack:** React 19 · TypeScript 7 · Vite 8 · Tailwind CSS 4 · Zustand 5 · lucide-react · vite-plugin-pwa · Vitest

## Starten

```bash
npm install
npm run dev        # Entwicklung (http://localhost:5173)
npm test           # Unit-Tests der Planungslogik und des Stores
npm run build      # Typecheck + Produktions-Build inkl. Service Worker
npm run preview    # Produktions-Build lokal ansehen
```

### Auf dem iPhone installieren

1. `npm run build` und den Ordner `dist/` auf einen HTTPS-Host legen (z. B. Netlify, Vercel, GitHub Pages).
2. Seite in Safari öffnen → **Teilen** → **Zum Home-Bildschirm**.
3. Die App startet dann im Vollbild; das App-Grundgerüst ist offline verfügbar.

Hash-Routing (`#/woche`) sorgt dafür, dass kein Server-Rewrite nötig ist.

## Architektur

```
src/
  domain/              Reines Datenmodell, keine React-Abhängigkeit
    types.ts           UserProfile, Routine, CalendarEvent, Task, Goal, DailyState, EnergyState,
                       Meal, ScheduleBlock, Vacation, SpecialDay, Settings …
    defaults.ts        Start-Konfiguration + optionaler Beispiel-Alltag (alles editierbar)
    factories.ts       Formular-Vorlagen für neue Einträge
    time.ts            Datum/Uhrzeit, Intervall-Rechnung
  services/
    planner/           Planungslogik – pure Funktionen, unabhängig von React
      schedule.ts      Tagesplan: Schlaf, Mahlzeiten, Routinen, Termine, Wege, Pausen, Aufgaben
      dayState.ts      Tageszustand (manuell > besonderer Tag > Urlaub > Standard) + Regeln
      energy.ts        Energie-Schätzung (Tageszeit, Aktivitäten, Pausen, Zustands-Grenze)
      freeTime.ts      Freie Zeit, Planungsbudget (Freizeit-Schutz), Arbeitszeiten
      autoPlan.ts      Regelbasierte Auto-Planung (Aufgaben + Wochenziele)
      suggest.ts       „Was soll ich jetzt machen?“
      goals.ts         Wochen-Fortschritt von Zielen
      index.ts         PlannerStrategy-Interface (Austauschpunkt für einen späteren KI-Planer)
    calendar/          CalendarProvider-Interface (Google Calendar später hier anbinden)
    focus/             FocusProvider-Interface (Focus Co-Pilot später hier anbinden)
    ai/                Platzhalter für KI-Planer (implementiert PlannerStrategy)
    storage/           Persistenz-Adapter (V1: localStorage)
  store/               Zentraler Zustand-Store `useAppStore` mit Slices:
                       settings · routines · events · tasks · goals · daily (dailyStates, vacations, specialDays)
  features/            UI pro Bereich (today, week, tasks, goals, events, routines, settings, …)
  ui/                  Design-System (Button, Card, Sheet, Felder, Schalter, Toasts)
  app/                 Layout (Sidebar/Bottom-Navigation) und Hash-Router
```

### Grundprinzipien

- **Keine versteckten Annahmen:** Schlaf, Mahlzeiten, Pausen, Energie, Zustände, Freizeit-Schutz,
  Arbeitszeiten, Energie-Schwellen – alles liegt in `Settings` und ist unter „Mein Alltag“ editierbar.
- **Berechnetes wird nie gespeichert:** `ScheduleBlock`, freie Zeit, Energie und Vorschläge werden
  bei Bedarf aus den gespeicherten Daten abgeleitet.
- **Zustände pausieren, statt zu löschen:** Regel-Reihenfolge Quelle → Kategorie → Standard des Zustands.
- **Freizeit ist ein eigener Zustand:** Auto-Planung verplant höchstens einen einstellbaren Anteil der
  freien Zeit und lässt immer eine Mindest-Freizeit übrig. Vorschläge werden erst nach Bestätigung übernommen.
- **Daten-Snapshot statt Store-Zugriff:** Der Planer bekommt `PlannerData` übergeben – er kennt weder
  React noch den Store und ist dadurch testbar und austauschbar.

### Spätere Erweiterungen (bewusst noch nicht gebaut)

| Erweiterung | Andockpunkt |
| --- | --- |
| Google Calendar | `services/calendar` – Provider liefert `CalendarEvent` mit `source: 'google'` + `externalId` |
| Focus Co-Pilot | `services/focus` – `FocusProvider` für echte Fokus-Sitzungen |
| KI-Planer | `services/ai` – implementiert `PlannerStrategy`, aktivieren über `setPlanner()` |
| Cloud-Sync / Konten | `services/storage` – anderer Persistenz-Adapter, `normalizeData`/`migrate` für Versionen |
| Statistiken | eigener Service auf Basis von Tasks/Goals/DailyStates |

## Daten

Alles liegt im localStorage unter dem Schlüssel `lifeos-data` (versioniert). Unter
„Mein Alltag → Daten & Backup“ lässt sich ein JSON-Backup exportieren und wieder importieren.
