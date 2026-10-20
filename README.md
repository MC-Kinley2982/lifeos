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
- **Freizeit-Schutz & geschützte Zeiten:** Mindest-Freizeit pro Tag, Planungsanteil, Tage mit viel Freizeit
  (Wochenende) bevorzugt, jede Aktivität höchstens einmal pro Tag, „Mehr Freizeit“. Geschützte Zeiträume
  (*Mein Alltag → Planung → Geschützte Zeiten*, z. B. Morgenroutine „ab Aufstehen bis 07:45“, Familienzeit)
  werden von keinem Planer genutzt – auch keine kleinen Lücken zwischen Routine-Punkten.
- **To-dos:** schnelle persönliche Liste (Heute · Diese Woche · Später), mit einem Tipp abhaken, erledigte bleiben
  gespeichert. Ein To-do blockiert keine Zeit; erst „Planen“ macht daraus eine Aufgabe, für die LifeOS einen freien
  Zeitraum sucht (Reihenfolge: Termine → geschützte Zeiten/Routinen → Schule → Hausaufgaben → Aufgaben →
  geplante To-dos → Ziele → freie Zeit). Synchronisiert über dieselbe `lifeos_records`-Tabelle (Sammlung `todos`).
  - **Wiederkehrende To-dos** (z. B. „Sporttasche packen“ jeden Montag): täglich, wöchentlich an bestimmten Tagen
    oder monatlich, jeweils „alle n …“. Nach dem Abhaken erscheint automatisch das nächste Vorkommen; Wieder-Öffnen
    nimmt es zurück. Verpasstes stapelt sich nicht, sondern rückt auf das letzte fällige Vorkommen.
  - **Siri / Kurzbefehle:** `#/todos?add=Text&when=today` legt ein To-do an (siehe unten).
- **Schnelleingabe mit Texterkennung** (To-dos, Aufgaben, Siri-Link): „morgen 17 Uhr 45 min Mathe lernen“,
  „freitag Geschenk kaufen“, „jeden Montag Sporttasche packen“, „Referat bis Freitag 2 Stunden wichtig“.
  Erkannt werden Tag (heute/morgen/übermorgen, Wochentage, 24.10., 24. Oktober, in 3 Tagen, diese/nächste Woche,
  Wochenende, später), Uhrzeit (17 Uhr, 17:30, um 5 → 17:00, halb 5), Dauer, Wiederholung, Tageszeit und
  Wichtigkeit. Regelbasiert, ohne KI-Dienst; die Vorschau zeigt, was erkannt wurde – antippen = ignorieren.
  Abschaltbar unter *Mein Alltag → Profil & Allgemein*.
- **Hausaufgabenzeit lernen:** Nach dem Erledigen fragt LifeOS (abschaltbar), wie lange es gedauert hat. Der
  gleitende Durchschnitt der letzten Hausaufgaben eines Fachs wird zum Standard für neue Hausaufgaben
  (Anzahl und Mindestmenge einstellbar; bis dahin gilt der Startwert des Fachs bzw. der allgemeine Standard).
- **Noten** (*Schule → Noten*): deutsche Skala 1–6 mit Plus/Minus (Wert einstellbar), Notenarten mit Gewicht
  (Klassenarbeit, Test, Mündlich … frei änderbar), Berechnung „gewichtet“ oder „nach Notenart“ (z. B. schriftlich
  50 % / mündlich 50 %), Schnitt pro Fach und gesamt, „Was brauche ich in der nächsten Arbeit?“ und eine Liste
  vergangener Tests ohne Note. Synchronisiert als Sammlung `grades`.
- **Rückblick** (Wochenstatistik): Erledigtes (Aufgaben, To-dos, Hausaufgaben), geschaffte Zeit, freie Zeit,
  Zielfortschritt, Zeit pro Tag (fest · geplant · frei, auch als Tabelle) und die letzten 8 Wochen im Vergleich.
- **Google Kalender (optional):** Google-Termine lesen (blockieren Zeit) und – nur auf Wunsch – Termine,
  Hausaufgaben, Lernzeiten, markierte To-dos oder Routinen eintragen (für die normalen Google-Benachrichtigungen).

## Kurzbefehle & Siri: „To-do hinzufügen“

Ein Link legt To-dos an – ideal für einen iOS-Kurzbefehl, ein Lesezeichen oder andere Apps:

```
https://mc-kinley2982.github.io/lifeos/#/todos?add=Sporttasche%20packen&when=tomorrow
```

| Parameter | Bedeutung |
| --- | --- |
| `add` | Titel (Pflicht, URL-codiert). Mehrere Zeilen = mehrere To-dos. |
| `when` | `today` · `tomorrow` · `week` · `later` oder `YYYY-MM-DD`. Ohne Angabe erkennt LifeOS „morgen“, „Freitag 17 Uhr“ … im Text, sonst heute. |
| `time` | optionale Uhrzeit `HH:MM` |
| `note` | optionale Notiz |
| `important` | `1` = als wichtig markieren |

Der Link wird genau einmal verarbeitet: Die Parameter verschwinden danach aus der Adresszeile, Neuladen oder
„Zurück“ legt nichts doppelt an. Kommt der Link vor dem Onboarding bzw. vor dem ersten Cloud-Abgleich an, wartet
LifeOS damit, bis die Daten bereit sind.

**iOS-Kurzbefehl einrichten** (auch in der App unter *Mein Alltag → Kurzbefehle & Siri*, mit Link-Vorlage zum Kopieren):

1. App **Kurzbefehle** → **+**.
2. Aktion **„Nach Eingabe fragen“** (Text), Frage z. B. „Was soll auf die Liste?“.
3. Aktion **„URL codieren“** (engl. „URL Encode“) mit *Bereitgestellte Eingabe*.
4. Aktion **„URL“**: `https://mc-kinley2982.github.io/lifeos/#/todos?add=` + Variable *URL-codierter Text* + `&when=today`.
5. Aktion **„URLs öffnen“**.
6. Kurzbefehl **„To-do hinzufügen“** nennen → „Hey Siri, To-do hinzufügen“.

> **Wichtig (iPhone):** „URLs öffnen“ öffnet **Safari**, nicht die Home-Bildschirm-App. iOS trennt die Speicher von
> Safari und Home-Bildschirm-Apps – ohne Konto landet das To-do also nur in Safari. Damit es in der App erscheint, in
> **beiden** mit demselben Konto anmelden; die Cloud-Synchronisierung gleicht es dann ab.

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
| `VITE_GOOGLE_CLIENT_ID` | Optional: OAuth-Client-ID (Webanwendung) für Google Kalender – öffentlich, kein Secret |

Ohne Supabase-Werte läuft LifeOS genau wie V1 rein lokal.

### Datenbank

Eine Tabelle **`public.lifeos_records`** – eine Zeile pro Eintrag (Einstellungen, Routine, Termin, Aufgabe,
To-do, Ziel, Tageszustand, Urlaub, Fach, Stunde, Hausaufgabe, Test). Neue Bereiche wie die To-dos brauchen
keine Migration – sie sind einfach eine weitere `collection` mit derselben Row Level Security:

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

1. PC: App öffnen → *Mein Alltag → Konto & Integrationen* → registrieren (E-Mail bestätigen) → anmelden. Status 🟢.
2. iPhone: Live-Seite in Safari öffnen → *Teilen → Zum Home-Bildschirm* → in der installierten App
   „Ich habe schon ein Konto“ → anmelden. Die Daten vom PC erscheinen.
3. PC: Hausaufgabe eintragen. iPhone: App öffnen (oder *Jetzt synchronisieren*) → die Hausaufgabe ist da.
4. Offline: iPhone in den Flugmodus → Hausaufgabe abhaken (Status 🔴 Offline · 1) → Flugmodus aus →
   Status wird 🟢, der PC zeigt die Änderung beim nächsten Öffnen.

Ohne Supabase lässt sich das lokal durchspielen: `npm run dev:mock -- --host 127.0.0.1`, dann
`http://127.0.0.1:5173` („PC“) und `http://localhost:5173` („iPhone“) – zwei Ursprünge mit getrennten Daten.

## Google Kalender einrichten (optional)

LifeOS meldet sich direkt im Browser über **Google Identity Services** an (OAuth-Token-Modell, kein Server,
kein Client-Secret). Das Zugriffstoken bleibt auf dem jeweiligen Gerät (sessionStorage, ca. 1 h gültig) und wird
nie mit Supabase synchronisiert. Synchronisiert werden nur die Einstellungen (Konto, Kalender, was übertragen wird).

1. https://console.cloud.google.com → neues Projekt (z. B. „LifeOS“).
2. *APIs & Dienste → Bibliothek* → **Google Calendar API** aktivieren.
3. *OAuth-Zustimmungsbildschirm* (Google Auth Platform → Branding/Zielgruppe): Typ **Extern**, App-Name, Support-
   E-Mail. Unter *Zielgruppe* bleibt die App im Modus **Testen** → dein Google-Konto als **Testnutzer** hinzufügen.
   Bereiche (Datenzugriff): `…/auth/calendar.calendarlist.readonly` und `…/auth/calendar.events`.
4. *Clients → Client erstellen* → Typ **Webanwendung**. *Autorisierte JavaScript-Quellen*:
   `https://mc-kinley2982.github.io` und für die Entwicklung `http://localhost:5173` / `http://localhost:5180`
   (Weiterleitungs-URIs werden nicht gebraucht). **Kein Client-Secret verwenden.**
5. Die Client-ID (`…apps.googleusercontent.com`) als `VITE_GOOGLE_CLIENT_ID` eintragen – lokal in `.env.local`,
   für die Live-Seite als GitHub-Repository-Variable (wie bei Supabase) – und neu veröffentlichen.
6. In LifeOS: *Mein Alltag → Konto & Integrationen → Google Kalender → Mit Google verbinden*.
   Im Testmodus zeigt Google den Hinweis „Google hat diese App nicht überprüft“ → *Weiter*.

So funktioniert der Abgleich (Zeitraum: heute + 28 Tage):

- **Lesen:** Termine des gewählten Kalenders erscheinen in LifeOS (Termine-Seite, Tagesplan) und blockieren Zeit;
  als „frei“ markierte Google-Termine nicht. Sie sind in LifeOS nur lesbar.
- **Schreiben:** nur die eingeschalteten Bereiche (Standard: nichts). Jeder LifeOS-Eintrag hat eine stabile
  Google-Event-ID (aus seinem LifeOS-Schlüssel abgeleitet) – wiederholte Synchronisierung, auch von mehreren
  Geräten, erzeugt keine Duplikate. Geänderte Einträge werden aktualisiert.
- **Löschen:** nur Einträge mit der privaten Markierung `lifeos=1`, also von LifeOS angelegte. Persönliche
  Google-Termine werden nie geändert oder gelöscht.
- **Automatisch** nur, solange das Gerät angemeldet ist (beim Start, nach Änderungen, alle 10 min). Danach genügt
  ein Tipp auf „Jetzt synchronisieren“. Offline läuft LifeOS normal weiter.
- To-dos werden nur übertragen, wenn „To-dos mit Kalendertermin“ erlaubt **und** beim To-do „In Google Kalender
  eintragen“ eingeschaltet ist. Standard-Erinnerung für To-dos: keine.

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
    school/            Stundenplan, Hausaufgaben (Deadline, Dauer, gelernte Zeit), Tests (Lernzeitraum, Fortschritt),
                       schoolPlanner.ts (Hausaufgaben + Lernzeit gemeinsam planen), prompt.ts, grades.ts (Noten)
    nlp/               Texterkennung der Schnelleingabe (quickAdd.ts, regelbasiert, Deutsch)
    stats/             Wochenrückblick (weekly.ts)
    cloud/             CloudBackend-Interface, Supabase-Adapter, In-Memory-Server (Tests/Dev-Mock)
    sync/              Sync-Engine (Outbox, Pull/Push, Konflikte, erster Login), Datensatz-Abbildung
    calendar/ focus/ ai/   Platzhalter für Google Calendar, Focus Co-Pilot, KI-Planer
    todos/             To-do-Liste: Abschnitte, Wiederholungen (repeat.ts), Kurzbefehl-Links (links.ts)
    storage/           Persistenz-Adapter (localStorage, versioniert; Migrationen in store/persistence.ts)
  store/               useAppStore (Slices: settings, routines, events, tasks, goals, daily, school, data),
                       cloud.ts (Sync-Anbindung), schoolAutomation.ts (automatisches Neuplanen)
  features/            UI pro Bereich: today, week, school, tasks, goals, events, routines, settings, cloud …
                       (alles außer Heute/To-dos lädt per Code-Splitting erst bei Bedarf, im Hintergrund vorgeladen)
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
feldgenaues Zusammenführen bei Konflikten (aktuell: neuere Änderung pro Eintrag gewinnt), A/B-Wochen im Stundenplan,
Oberstufen-Punkte (0–15) bei den Noten, Passwort-zurücksetzen-Seite.
