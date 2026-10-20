import { describe, expect, it } from 'vitest';
import type { DateKey } from '../../domain/types';
import { parseQuickAdd, type QuickParseOptions } from './quickAdd';

const TUE: DateKey = '2026-10-06';
const opts: QuickParseOptions = { today: TUE, weekStartsOn: 0 };
const p = (text: string, o: Partial<QuickParseOptions> = {}) => parseQuickAdd(text, { ...opts, ...o });

describe('Schnelleingabe: Beispiele aus dem Alltag', () => {
  it('"morgen 17 Uhr 45 min Mathe lernen"', () => {
    expect(p('morgen 17 Uhr 45 min Mathe lernen')).toMatchObject({
      title: 'Mathe lernen',
      horizon: 'day',
      date: '2026-10-07',
      time: '17:00',
      durationMin: 45,
    });
  });

  it('"freitag Geschenk kaufen" → nächster Freitag, Titel groß', () => {
    expect(p('freitag Geschenk kaufen')).toMatchObject({ title: 'Geschenk kaufen', date: '2026-10-09', horizon: 'day' });
    expect(p('Geschenk kaufen am Freitag')).toMatchObject({ title: 'Geschenk kaufen', date: '2026-10-09' });
  });

  it('Wochentag wie heute → nächste Woche', () => {
    expect(p('Dienstag Vokabeln').date).toBe('2026-10-13');
  });

  it('Vorschau-Chips beschreiben, was erkannt wurde', () => {
    expect(p('morgen 17 Uhr 45 min Mathe lernen').chips.map((c) => c.label)).toEqual(['Morgen', '17:00', '45 min']);
  });

  it('ohne Angaben bleibt der Text unverändert', () => {
    expect(p('Spiel für Papa und mich suchen')).toEqual({ title: 'Spiel für Papa und mich suchen', chips: [] });
    expect(p('Montagsmaler spielen')).toEqual({ title: 'Montagsmaler spielen', chips: [] });
    expect(p('iPhone laden')).toEqual({ title: 'iPhone laden', chips: [] });
  });

  it('nur eine Angabe ohne Titel wird nicht zerlegt', () => {
    expect(p('morgen')).toEqual({ title: 'morgen', chips: [] });
  });
});

describe('Datum', () => {
  it.each([
    ['heute Zimmer aufräumen', '2026-10-06'],
    ['übermorgen Bio lesen', '2026-10-08'],
    ['am 24.10. Kino', '2026-10-24'],
    ['Kino 24.10.2026', '2026-10-24'],
    ['Zahnarzt am 3.1.', '2027-01-03'],
    ['am 24.10 Kino', '2026-10-24'],
    ['24. Oktober Oma Geburtstag', '2026-10-24'],
    ['Referat am 2. Nov.', '2026-11-02'],
    ['in 3 Tagen Buch zurückgeben', '2026-10-09'],
    ['in zwei Wochen Fahrrad reparieren', '2026-10-20'],
    ['in einem Monat Abo kündigen', '2026-11-06'],
    ['am Wochenende Garten', '2026-10-10'],
    ['nächsten Montag Sport', '2026-10-12'],
  ])('%s → %s', (text, date) => {
    expect(p(text)).toMatchObject({ horizon: 'day', date });
  });

  it('diese / nächste Woche und später', () => {
    expect(p('diese Woche Bewerbung schreiben')).toMatchObject({ title: 'Bewerbung schreiben', horizon: 'week', date: '2026-10-05' });
    expect(p('nächste Woche Bewerbung schreiben')).toMatchObject({ horizon: 'week', date: '2026-10-12' });
    expect(p('irgendwann Keller ausmisten')).toMatchObject({ title: 'Keller ausmisten', horizon: 'later', date: undefined });
  });

  it('"bis" macht daraus eine Frist', () => {
    expect(p('Referat fertig bis Freitag')).toMatchObject({ title: 'Referat fertig', date: '2026-10-09', deadline: true });
    expect(p('Referat fertig bis Freitag').chips[0].label).toBe('bis Fr., 9. Okt.');
  });

  it('ungültige Daten werden ignoriert', () => {
    expect(p('am 31.02. Party').title).toBe('am 31.02. Party');
  });
});

describe('Uhrzeit & Tageszeit', () => {
  it.each([
    ['Training 17:30', '17:30'],
    ['Training um 17.30 Uhr', '17:30'],
    ['Training 17 Uhr 30', '17:30'],
    ['Arzt um 9', '09:00'],
    ['Fußball um 5', '17:00'],
    ['Aufstehen morgens um 5', '05:00'],
    ['Treffen halb 5', '16:30'],
    ['Essen um 8 abends', '20:00'],
  ])('%s → %s', (text, time) => {
    expect(p(text).time).toBe(time);
  });

  it('Uhrzeit ohne Tag gilt für heute', () => {
    expect(p('Training 17:30')).toMatchObject({ title: 'Training', horizon: 'day', date: TUE });
  });

  it('"heute Abend" / "morgen früh"', () => {
    expect(p('heute Abend Zimmer aufräumen')).toMatchObject({ title: 'Zimmer aufräumen', date: TUE, timeOfDay: 'evening' });
    expect(p('morgen früh joggen')).toMatchObject({ title: 'Joggen', date: '2026-10-07', timeOfDay: 'morning' });
    expect(p('Abend vorbereiten')).toEqual({ title: 'Abend vorbereiten', chips: [] });
  });
});

describe('Dauer', () => {
  it.each([
    ['Lesen 30 min', 30],
    ['Lesen 30min', 30],
    ['Lesen 45 Minuten', 45],
    ['Lesen 1h', 60],
    ['Lesen 1,5 h', 90],
    ['Lesen 2 Stunden', 120],
    ['Lesen 1h30', 90],
    ['Lesen 1 Std 15 Min', 75],
    ['Lesen eine halbe Stunde', 30],
    ['Lesen eine Stunde', 60],
    ['Lesen anderthalb Stunden', 90],
    ['Lesen für 20 min', 20],
  ])('%s → %d min', (text, min) => {
    expect(p(text)).toMatchObject({ title: 'Lesen', durationMin: min });
  });
});

describe('Priorität', () => {
  it('wichtig, dringend, Ausrufezeichen', () => {
    expect(p('Mail an Frau Meier wichtig')).toMatchObject({ title: 'Mail an Frau Meier', priority: 'high' });
    expect(p('Formular abgeben dringend')).toMatchObject({ priority: 'urgent' });
    expect(p('Formular abgeben!')).toMatchObject({ title: 'Formular abgeben', priority: 'high' });
    expect(p('Formular abgeben !!')).toMatchObject({ title: 'Formular abgeben', priority: 'urgent' });
    expect(p('Wichtige Mail schreiben').priority).toBeUndefined();
  });
});

describe('Wiederholung', () => {
  it('"jeden Montag" → wöchentlich, erstes Vorkommen ab heute', () => {
    const r = p('jeden Montag Sporttasche packen');
    expect(r).toMatchObject({ title: 'Sporttasche packen', date: '2026-10-12', repeat: { type: 'weekly', weekdays: [0], every: 1 } });
    expect(r.chips.map((c) => c.label)).toEqual(['Jeden Mo']);
  });

  it('mehrere Tage, Adverbien, täglich, alle n', () => {
    expect(p('montags und donnerstags Training').repeat).toMatchObject({ type: 'weekly', weekdays: [0, 3] });
    expect(p('täglich Vokabeln 15 min')).toMatchObject({ title: 'Vokabeln', durationMin: 15, date: TUE, repeat: { type: 'daily' } });
    expect(p('alle 2 Wochen Bettwäsche wechseln').repeat).toMatchObject({ type: 'weekly', every: 2, weekdays: [1] });
    expect(p('werktags Tasche packen').repeat).toMatchObject({ weekdays: [0, 1, 2, 3, 4] });
    expect(p('monatlich am 15.11. Taschengeld').repeat).toMatchObject({ type: 'monthly', day: 15 });
  });
});

describe('Abwählen einzelner Erkennungen', () => {
  it('ignorierte Arten bleiben im Titel', () => {
    expect(p('Freitag der 13. schauen', { ignore: ['date'] })).toEqual({ title: 'Freitag der 13. schauen', chips: [] });
    const r = p('morgen 17 Uhr Mathe', { ignore: ['time'] });
    expect(r).toMatchObject({ title: '17 Uhr Mathe', date: '2026-10-07' });
    expect(r.time).toBeUndefined();
  });
});
