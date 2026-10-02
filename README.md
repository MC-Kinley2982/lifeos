# LifeOS – Personal Life Planner

Persönliche Life-Management-App als PWA. Sie weiß, wie dein normaler Tag aussieht (Schlaf, Mahlzeiten,
Routinen, Stundenplan, Termine), berechnet daraus deine freie Zeit, schätzt deine Energie und plant
Aufgaben, Hausaufgaben und Lernzeit regelbasiert ein – ohne deine Freizeit komplett zu verplanen.

**Stack:** React 19 · TypeScript 7 · Vite 8 · Tailwind CSS 4 · Zustand 5 · lucide-react · vite-plugin-pwa ·
Supabase (Auth + Postgres, optional) · Vitest · PGlite (nur Tests)

**Live:** https://mc-kinley2982.github.io/lifeos/

## Starten

```bash
npm install
npm run dev        # Entwicklung (http://localhost:5173) – rein lokal
npm run dev:mock   # Entwicklung mit simulierter Cloud (Registrieren/Login/Sync ohne Supabase)
npm test           # Unit-Tests: Planer, Schule, Sync-Engine, Store, Supabase-RLS (PGlite)
npm run build      # Typecheck + Produktions-Build inkl. Service Worker
npm run preview    # Produktions-Build lokal ansehen
```

## Funktionen

- **V1:** Routinen, einmalige Termine, Aufgaben, Ziele, Tages- und Wochenplanung, freie Zeit,
  Energie-System, „Was soll ich jetzt machen?“, Tageszustände (Krank, Urlaub, Ferien …), Export/Import.
- **Schule:** Fächer, Stundenplan, Hausaufgaben, Tests/Klassenarbeiten mit Lernplan.
  - Der Stundenplan bestimmt an Schultagen die Zeiten der verknüpften Routine „Schule“ –
    Schulweg, Pause danach, Krank/Ferien und Energie-Regeln gelten unverändert weiter.
  - Nach Schulschluss fragt LifeOS (einmal pro Tag, abschaltbar): „Welche Hausaufgaben hast du heute bekommen?“
  - Deadline = Beginn der nächsten Stunde des Fachs (Ferien/Urlaub werden übersprungen).
  - Dauer = Ø-Hausaufgabenzeit (Einstellung) bzw. fachspezifischer Wert.
  - Hausaufgaben und Lernzeit werden automatisch vor ihrer Deadline in freie Zeit geplant
    (früheste Deadline zuerst, lange Aufgaben aufgeteilt, Lernzeit über mehrere Tage verteilt).
  - Blöcke lassen sich verschieben; verschobene Blöcke bleiben, wo du sie hinlegst.
- **Konto & Cloud-Sync (optional):** Registrierung/Login mit E-Mail + Passwort, dieselben Daten auf PC und iPhone,
  offline weiter nutzbar, Statusanzeige 🟢 Synchronisiert · 🟡 Synchronisiere … · 🔴 Offline.

## Cloud-Synchronisierung einrichten (Supabase)

1. Kostenloses Projekt auf https://supabase.com anlegen.
2. **SQL Editor** → Inhalt von [`supabase/migrations/20261002120000_lifeos_records.sql`](supabase/migrations/20261002120000_lifeos_records.sql) einfügen → *Run*.
   Das legt die Tabelle `lifeos_records` mit Row Level Security an.
3. **Authentication → Sign In / Providers → Email** aktiviert lassen.
   „Confirm email“ kann an bleiben (dann kommt nach der Registrierung eine Bestätigungs-Mail).
4. **Authentication → URL Configuration**
   - *Site URL:* `https://mc-kinley2982.github.io/lifeos/`
   - *Redirect URLs:* `https://mc-kinley2982.github.io/lifeos/**` und `http://localhost:5173/**`
5. **Project Settings → API Keys**: Projekt-URL und *Publishable key* (`sb_publishable_…`, bei älteren
   Projekten „anon key“) kopieren. **Nie** den *secret*/*service_role*-Schlüssel verwenden.
6. Lokal: `.env.example` nach `.env.local` kopieren und beide Werte eintragen.
7. Für die Live-Seite: GitHub → Repository → *Settings → Secrets and variables → Actions → Variables*:
   `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` anlegen, dann den Deploy-Workflow neu starten
   (oder einen Commit pushen).

### Umgebungsvariablen

| Variable | Bedeutung |
| --- | --- |
| `VITE_SUPABASE_URL` | Projekt-URL, z. B. `https://abcd.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Öffentlicher Client-Schlüssel (alternativ `VITE_SUPABASE_ANON_KEY`) |
| `VITE_MOCK_CLOUD` | Nur Entwicklung (`.env.mock`): simulierte Cloud im Dev-Server |

Ohne Supabase-Werte läuft LifeOS genau wie V1 rein lokal.

### Datenbank

Eine Tabelle **`public.lifeos_records`** – eine Zeile pro Eintrag (Einstellungen, Routine, Termin, Aufgabe,
Ziel, Tageszustand, Urlaub, Fach, Stunde, Hausaufgabe, Test):

| Spalte | Inhalt |
| --- | --- |
| `user_id` | Besitzer (aus der Anmeldung, `auth.uid()`) |
| `collection`, `id` | Art und ID des Eintrags (zusammen mit `user_id` Primärschlüssel) |
| `data` | Eintrag als JSON |
| `deleted` | Löschmarkierung (damit andere Geräte Löschungen mitbekommen) |
| `updated_at` | Zeitpunkt der Änderung auf dem Gerät – entscheidet Konflikte |
| `server_updated_at` | vom Server gesetzt – Cursor für „alles seit dem letzten Abgleich“ |

**Row Level Security:** Lesen, Anlegen, Ändern und Löschen nur für angemeldete Nutzer und nur für die eigenen
Zeilen; anonyme Zugriffe sind gesperrt. Ein Trigger verhindert, dass ältere Stände neuere überschreiben.
`supabase/rls.test.ts` prüft das gegen eine echte Postgres-Engine (PGlite).

### So funktioniert die Synchronisierung

1. Die App arbeitet immer mit den lokalen Daten (localStorage) – auch offline.
2. Änderungen werden per Vergleich mit dem zuletzt synchronisierten Stand erkannt und mit Zeitstempel in einer
   Warteschlange gesammelt (überlebt Neustarts).
3. Abgleich beim Start, nach Änderungen, beim Zurückkehren in die App, beim Wiederverbinden und alle 30 s:
   erst Änderungen anderer Geräte holen, dann eigene hochladen.
4. Konflikte: pro Eintrag gewinnt die neuere Änderung (auf dem Gerät und auf dem Server).
5. Erster Login auf einem Gerät: Cloud leer → lokale Daten werden hochgeladen; Gerät leer → Cloud-Daten werden
   übernommen; beides vorhanden → Dialog „Lokale Daten gefunden“ (Gerät oder Cloud übernehmen; vorher wird
   automatisch eine Sicherung gespeichert).
6. „Alle Daten löschen“ setzt nur dieses Gerät zurück (vorher Abmeldung) – die Cloud-Daten bleiben.

### PC ↔ iPhone testen

1. PC: App öffnen → *Mein Alltag → Konto & Sync* → registrieren (E-Mail bestätigen) → anmelden. Status 🟢.
2. iPhone: Live-Seite in Safari öffnen → *Teilen → Zum Home-Bildschirm* → in der installierten App
   „Ich habe schon ein Konto“ → anmelden. Die Daten vom PC erscheinen.
3. PC: Hausaufgabe eintragen. iPhone: App öffnen (oder *Jetzt synchronisieren*) → die Hausaufgabe ist da.
4. Offline: iPhone in den Flugmodus → Hausaufgabe abhaken (Status 🔴 Offline · 1) → Flugmodus aus →
   Status wird 🟢, der PC zeigt die Änderung beim nächsten Öffnen.

Ohne Supabase lässt sich das lokal durchspielen: `npm run dev:mock -- --host 127.0.0.1`, dann
`http://127.0.0.1:5173` („PC“) und `http://localhost:5173` („iPhone“) – zwei Ursprünge mit getrennten Daten.

## Veröffentlichung (GitHub Pages)

Jeder Push auf `main` startet `.github/workflows/deploy.yml`: Abhängigkeiten → Tests → Build mit
`GITHUB_PAGES=true` (Base-Pfad `/lifeos/`, Supabase-Werte aus den Repository-Variablen) → Veröffentlichung.
Schlägt ein Test fehl, bleibt die bisherige Version online. Hash-Routing (`#/woche`) braucht keine Server-Rewrites.

### Auf dem iPhone installieren

1. https://mc-kinley2982.github.io/lifeos/ in **Safari** öffnen → **Teilen** → **Zum Home-Bildschirm**.
2. Die Home-Bildschirm-App hat auf iOS einen eigenen Speicher – erst installieren, dann dort einrichten/anmelden.

## Architektur

```
src/
  domain/              Datenmodell (keine React-Abhängigkeit): types, defaults, factories, time
  services/
    planner/           Planungslogik (pure Funktionen) + PlannerStrategy (Austauschpunkt für KI)
      schedule.ts      Tagesplan inkl. Stundenplan-Schulzeit, Tests, Hausaufgaben-/Lernblöcke
      placement.ts     gemeinsame Bausteine: Budgets (Freizeit-Schutz), Fokus-Regel, Slot-Bewertung
      autoPlan.ts      Aufgaben/Ziele vorschlagen · suggest.ts „Was soll ich jetzt machen?“
    school/            Stundenplan, Hausaufgaben (Deadline, Dauer), Tests (Lernzeitraum, Fortschritt),
                       schoolPlanner.ts (Hausaufgaben + Lernzeit gemeinsam planen), prompt.ts
    cloud/             CloudBackend-Interface, Supabase-Adapter, In-Memory-Server (Tests/Dev-Mock)
    sync/              Sync-Engine (Outbox, Pull/Push, Konflikte, erster Login), Datensatz-Abbildung
    calendar/ focus/ ai/   Platzhalter für Google Calendar, Focus Co-Pilot, KI-Planer
    storage/           Persistenz-Adapter (localStorage, Version 2 mit Migration)
  store/               useAppStore (Slices: settings, routines, events, tasks, goals, daily, school, data),
                       cloud.ts (Sync-Anbindung), schoolAutomation.ts (automatisches Neuplanen)
  features/            UI pro Bereich: today, week, school, tasks, goals, events, routines, settings, cloud …
  ui/                  Design-System
supabase/              SQL-Migration + RLS-Test
dev/                   Vite-Plugin für die simulierte Cloud (nur Entwicklung)
```

### Grundprinzipien

- **Keine versteckten Annahmen:** alles Planungsrelevante steht in den Einstellungen (*Mein Alltag*).
- **Berechnetes wird nie gespeichert** (Tagesplan, freie Zeit, Energie, Vorschläge).
- **Zustände pausieren, statt zu löschen** – auch Schule bei Krankheit/Ferien; Hausaufgaben und Tests bleiben.
- **Freizeit-Schutz:** Aufgaben/Ziele höchstens bis zum allgemeinen Planungsanteil, Schulaufgaben bis zum
  (höheren) Schul-Anteil, an Krankheitstagen weniger; immer bleibt eine Mindest-Freizeit.
- **Offline-first:** lokale Daten sind die Quelle, die Cloud ist ein Abgleich.

### Bewusst noch nicht umgesetzt

Google Calendar, Focus Co-Pilot, KI-Planung, Push-Benachrichtigungen, Echtzeit-Sync (Supabase Realtime),
feldgenaues Zusammenführen bei Konflikten (aktuell: neuere Änderung pro Eintrag gewinnt), automatisch gelernte
Hausaufgabenzeiten pro Fach (Datenfeld vorbereitet), A/B-Wochen im Stundenplan, Noten, Passwort-zurücksetzen-Seite.
