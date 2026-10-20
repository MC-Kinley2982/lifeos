import { TIME_OF_DAY_LABEL } from '../../domain/labels';
import { addDays, formatDuration, getWeekday, parseDateKey, relativeDayLabel, startOfWeek, toDateKey, toHHMM } from '../../domain/time';
import type { DateKey, Priority, TimeHHMM, TimeOfDay, TodoRepeat, Weekday } from '../../domain/types';
import { firstOccurrenceFrom, repeatLabel } from '../todos/repeat';

/**
 * Regelbasierte Texterkennung für die Schnelleingabe (Deutsch), z. B.
 *   "morgen 17 Uhr 45 min Mathe lernen" → Mathe lernen · Morgen · 17:00 · 45 min
 *   "freitag Geschenk kaufen"           → Geschenk kaufen · Fr.
 *   "jeden Montag Sporttasche packen"   → Sporttasche packen · Jeden Mo
 * Kein KI-Dienst, keine Daten verlassen das Gerät. Erkannte Stellen werden aus dem Titel entfernt;
 * jede Art lässt sich abschalten (`ignore`), dann bleibt der Text im Titel stehen.
 */

export type QuickTokenKind = 'date' | 'time' | 'duration' | 'priority' | 'repeat' | 'timeOfDay';

export interface QuickChip {
  kind: QuickTokenKind;
  label: string;
}

export interface QuickParse {
  /** Titel ohne erkannte Angaben (bzw. der ganze Text, wenn nichts erkannt wurde). */
  title: string;
  /** day = bestimmter Tag (date), week = Woche ab `date`, later = ohne Datum. */
  horizon?: 'day' | 'week' | 'later';
  date?: DateKey;
  /** "bis Freitag": das Datum ist eine Frist, kein Termin. */
  deadline?: boolean;
  time?: TimeHHMM;
  durationMin?: number;
  priority?: Priority;
  timeOfDay?: TimeOfDay;
  repeat?: TodoRepeat;
  /** Was erkannt wurde – für die Vorschau unter dem Eingabefeld. */
  chips: QuickChip[];
}

export interface QuickParseOptions {
  today: DateKey;
  weekStartsOn: Weekday;
  /** Diese Arten nicht erkennen (z. B. weil der Nutzer sie in der Vorschau abgewählt hat). */
  ignore?: QuickTokenKind[];
}

// ─── Bausteine ───────────────────────────────────────────────

/** Wortgrenzen inkl. Umlauten (\b kennt nur ASCII). */
const L = '(?<![\\p{L}\\p{N}])';
const R = '(?![\\p{L}\\p{N}])';
const WD = '(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag)';
const NUM = '(\\d+|eins|ein|eine|einem|einer|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf)';
const MONTHS = '(januar|jan|februar|feb|märz|maerz|mär|april|apr|mai|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|dezember|dez)';

const WEEKDAY: Record<string, Weekday> = { montag: 0, dienstag: 1, mittwoch: 2, donnerstag: 3, freitag: 4, samstag: 5, sonnabend: 5, sonntag: 6 };
const NUMBER_WORDS: Record<string, number> = {
  eins: 1, ein: 1, eine: 1, einem: 1, einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12,
};
const MONTH_INDEX: Record<string, number> = {
  jan: 1, feb: 2, mär: 3, maerz: 3, apr: 4, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dez: 12,
};
const MASK = '\u0001';

const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : (NUMBER_WORDS[s] ?? NaN));
const monthOf = (s: string) => MONTH_INDEX[s.slice(0, 3) === 'mae' ? 'maerz' : s.slice(0, 3)] ?? MONTH_INDEX[s];
const weekdaysIn = (text: string): Weekday[] =>
  [...new Set([...text.matchAll(new RegExp(WD, 'gu'))].map((m) => WEEKDAY[m[1]]))].sort((a, b) => a - b);

function isoDate(y: number, m: number, d: number): DateKey | undefined {
  const date = new Date(y, m - 1, d, 12);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return undefined;
  return toDateKey(date);
}

/** Datum ohne Jahr: dieses Jahr, oder nächstes, wenn es schon vorbei ist. */
function upcomingDate(day: number, month: number, today: DateKey, year?: number): DateKey | undefined {
  if (year !== undefined) return isoDate(year < 100 ? 2000 + year : year, month, day);
  const y = parseDateKey(today).getFullYear();
  const date = isoDate(y, month, day);
  return date && date < today ? isoDate(y + 1, month, day) : date;
}

function addMonths(key: DateKey, months: number): DateKey {
  const d = parseDateKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1, 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toDateKey(target);
}

/** Nächster Tag mit diesem Wochentag – strikt nach heute ("Montag" am Montag = nächste Woche). */
function nextWeekday(today: DateKey, wd: Weekday): DateKey {
  const diff = (wd - getWeekday(today) + 7) % 7 || 7;
  return addDays(today, diff);
}

// ─── Regeln ──────────────────────────────────────────────────

interface Acc {
  date?: DateKey;
  horizon?: 'day' | 'week' | 'later';
  deadline?: boolean;
  dateEnd?: number;
  time?: { h: number; m: number; ambiguous: boolean };
  durationMin?: number;
  priority?: Priority;
  timeOfDay?: TimeOfDay;
  repeat?: { type?: TodoRepeat['type']; every?: number; weekdays?: Weekday[] };
}

interface Ctx {
  acc: Acc;
  today: DateKey;
  weekStartsOn: Weekday;
  /** Text zwischen zwei Positionen (maskiert) – für "abend nach heute". */
  between(from: number, to: number): string;
}

interface Rule {
  kind: QuickTokenKind;
  re: RegExp;
  /** true = übernommen (Textstelle wird entfernt). */
  apply(m: RegExpExecArray, ctx: Ctx): boolean;
}

const rx = (source: string) => new RegExp(source, 'gu');

function setDate(ctx: Ctx, date: DateKey | undefined, m: RegExpExecArray, deadline: boolean, horizon: Acc['horizon'] = 'day'): boolean {
  if (!date || ctx.acc.horizon) return false;
  ctx.acc.date = date;
  ctx.acc.horizon = horizon;
  ctx.acc.deadline = deadline || undefined;
  ctx.acc.dateEnd = m.index + m[0].length;
  return true;
}

function setRepeat(ctx: Ctx, patch: NonNullable<Acc['repeat']>): boolean {
  const r = (ctx.acc.repeat ??= {});
  if (patch.type && r.type && r.type !== patch.type && !(r.type === 'weekly' && patch.type === 'weekly')) return false;
  if (patch.type) r.type = patch.type;
  if (patch.every) r.every = patch.every;
  if (patch.weekdays) r.weekdays = [...new Set([...(r.weekdays ?? []), ...patch.weekdays])].sort((a, b) => a - b);
  return true;
}

function setTime(ctx: Ctx, h: number, m: number, ambiguous = false): boolean {
  if (ctx.acc.time || !Number.isFinite(h) || h > 23 || m > 59) return false;
  ctx.acc.time = { h, m, ambiguous };
  return true;
}

function setDuration(ctx: Ctx, minutes: number): boolean {
  if (ctx.acc.durationMin || !Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) return false;
  ctx.acc.durationMin = Math.round(minutes);
  return true;
}

const DUR_PREFIX = '(?:für\\s+|ca\\.?\\s+|etwa\\s+|circa\\s+)?';

const RULES: Rule[] = [
  // ── Wiederholung ──
  { kind: 'repeat', re: rx(`${L}(?:jeden\\s+tag|täglich|taeglich)${R}`), apply: (_m, c) => setRepeat(c, { type: 'daily' }) },
  { kind: 'repeat', re: rx(`${L}(?:jeden\\s+werktag|werktags)${R}`), apply: (_m, c) => setRepeat(c, { type: 'weekly', weekdays: [0, 1, 2, 3, 4] }) },
  { kind: 'repeat', re: rx(`${L}(?:jedes\\s+wochenende|wochenends)${R}`), apply: (_m, c) => setRepeat(c, { type: 'weekly', weekdays: [5, 6] }) },
  {
    kind: 'repeat',
    re: rx(`${L}(?:jeden|jede|immer)\\s+${WD}(?:\\s*(?:,|und|&|\\+)\\s*${WD})*${R}`),
    apply: (m, c) => setRepeat(c, { type: 'weekly', weekdays: weekdaysIn(m[0]) }),
  },
  {
    kind: 'repeat',
    re: rx(`${L}${WD}s(?:\\s*(?:,|und|&|\\+)\\s*${WD}s)*${R}`),
    apply: (m, c) => setRepeat(c, { type: 'weekly', weekdays: weekdaysIn(m[0]) }),
  },
  { kind: 'repeat', re: rx(`${L}(?:jede\\s+woche|wöchentlich|woechentlich)${R}`), apply: (_m, c) => setRepeat(c, { type: 'weekly' }) },
  { kind: 'repeat', re: rx(`${L}(?:jeden\\s+monat|monatlich)${R}`), apply: (_m, c) => setRepeat(c, { type: 'monthly' }) },
  {
    kind: 'repeat',
    re: rx(`${L}alle\\s+${NUM}\\s+(tage|wochen|monate)${R}`),
    apply: (m, c) => {
      const every = num(m[1]);
      if (!(every >= 1 && every <= 52)) return false;
      return setRepeat(c, { type: m[2] === 'tage' ? 'daily' : m[2] === 'wochen' ? 'weekly' : 'monthly', every });
    },
  },

  // ── Datum ──
  {
    kind: 'date',
    re: rx(`${L}(bis\\s+)?(?:(?:in\\s+)?(diese[rn]?)|(nächste[rn]?|naechste[rn]?|kommende[rn]?))\\s+woche${R}`),
    apply: (m, c) => {
      const start = startOfWeek(c.today, c.weekStartsOn);
      return setDate(c, m[2] ? start : addDays(start, 7), m, !!m[1], 'week');
    },
  },
  {
    kind: 'date',
    re: rx(`${L}(bis\\s+)?(?:(?:am|übers|uebers)\\s+)?wochenende${R}`),
    apply: (m, c) => {
      const wd = getWeekday(c.today);
      return setDate(c, wd >= 5 ? c.today : addDays(c.today, 5 - wd), m, !!m[1]);
    },
  },
  {
    kind: 'date',
    re: rx(`${L}(bis\\s+)?(übermorgen|uebermorgen|heute|morgen)${R}`),
    apply: (m, c) => setDate(c, addDays(c.today, m[2] === 'heute' ? 0 : m[2] === 'morgen' ? 1 : 2), m, !!m[1]),
  },
  {
    kind: 'date',
    re: rx(`${L}(bis\\s+(?:zum\\s+)?)?(?:am\\s+)?(?:(?:nächsten|naechsten|kommenden|diesen)\\s+)?${WD}${R}`),
    apply: (m, c) => setDate(c, nextWeekday(c.today, WEEKDAY[m[2]]), m, !!m[1]),
  },
  {
    kind: 'date',
    re: rx(`${L}(bis\\s+(?:zum\\s+)?)?(?:am\\s+)?(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4}|\\d{2})?(?!\\d)`),
    apply: (m, c) => setDate(c, upcomingDate(Number(m[2]), Number(m[3]), c.today, m[4] ? Number(m[4]) : undefined), m, !!m[1]),
  },
  {
    kind: 'date',
    re: rx(`${L}(bis\\s+(?:zum\\s+)?|am\\s+)(\\d{1,2})\\.(\\d{1,2})(?![\\d.:])(?!\\s*uhr)`),
    apply: (m, c) => setDate(c, upcomingDate(Number(m[2]), Number(m[3]), c.today), m, m[1].startsWith('bis')),
  },
  {
    kind: 'date',
    re: rx(`${L}(bis\\s+(?:zum\\s+)?)?(?:am\\s+)?(\\d{1,2})\\.?\\s*${MONTHS}\\.?(?:\\s+(\\d{4}))?${R}`),
    apply: (m, c) => setDate(c, upcomingDate(Number(m[2]), monthOf(m[3]), c.today, m[4] ? Number(m[4]) : undefined), m, !!m[1]),
  },
  {
    kind: 'date',
    re: rx(`${L}(bis\\s+)?in\\s+${NUM}\\s+(tag|tagen|woche|wochen|monat|monaten)${R}`),
    apply: (m, c) => {
      const n = num(m[2]);
      if (!(n >= 1 && n <= 366)) return false;
      const date = m[3].startsWith('tag') ? addDays(c.today, n) : m[3].startsWith('woche') ? addDays(c.today, n * 7) : addMonths(c.today, n);
      return setDate(c, date, m, !!m[1]);
    },
  },
  {
    kind: 'date',
    re: rx(`${L}(?:später|spaeter|irgendwann)${R}`),
    apply: (m, c) => {
      if (c.acc.horizon) return false;
      c.acc.horizon = 'later';
      c.acc.dateEnd = m.index + m[0].length;
      return true;
    },
  },

  // ── Dauer (vor der Uhrzeit, damit "17 Uhr 45 min" = 17:00 + 45 min) ──
  {
    kind: 'duration',
    re: rx(`${L}${DUR_PREFIX}(\\d+)\\s*(?:h|std\\.?|stunden?)\\s*(?:und\\s+)?(\\d{1,2})\\s*(?:min(?:uten?)?|mins?|m)?${R}`),
    apply: (m, c) => setDuration(c, Number(m[1]) * 60 + Number(m[2])),
  },
  {
    kind: 'duration',
    re: rx(`${L}${DUR_PREFIX}(\\d+(?:[.,]\\d+)?)\\s*(?:h|std\\.?|stunden?)${R}`),
    apply: (m, c) => setDuration(c, Number(m[1].replace(',', '.')) * 60),
  },
  {
    kind: 'duration',
    re: rx(`${L}${DUR_PREFIX}(\\d+)\\s*(?:min(?:uten?)?|mins?)${R}`),
    apply: (m, c) => setDuration(c, Number(m[1])),
  },
  {
    kind: 'duration',
    re: rx(`${L}(?:für\\s+)?(?:eine\\s+)?(halbe\\s+stunde|viertelstunde|viertel\\s+stunde|dreiviertelstunde|dreiviertel\\s+stunde)${R}`),
    apply: (m, c) => setDuration(c, m[1].startsWith('halbe') ? 30 : m[1].startsWith('dreiviertel') ? 45 : 15),
  },
  { kind: 'duration', re: rx(`${L}(?:für\\s+)?(?:eine|1)\\s+stunde${R}`), apply: (_m, c) => setDuration(c, 60) },
  {
    kind: 'duration',
    re: rx(`${L}(?:für\\s+)?(anderthalb|eineinhalb|zwei|drei|vier|fünf|fuenf)\\s+stunden${R}`),
    apply: (m, c) => setDuration(c, m[1] === 'anderthalb' || m[1] === 'eineinhalb' ? 90 : num(m[1]) * 60),
  },

  // ── Uhrzeit ──
  {
    kind: 'time',
    re: rx(`${L}(?:um\\s+|ab\\s+|bis\\s+)?(\\d{1,2}):(\\d{2})(?:\\s*uhr)?${R}`),
    apply: (m, c) => setTime(c, Number(m[1]), Number(m[2])),
  },
  {
    kind: 'time',
    re: rx(`${L}(?:um\\s+|ab\\s+|bis\\s+)?(\\d{1,2})\\.(\\d{2})\\s*uhr${R}`),
    apply: (m, c) => setTime(c, Number(m[1]), Number(m[2])),
  },
  {
    kind: 'time',
    re: rx(`${L}(?:um\\s+|ab\\s+|bis\\s+)?(\\d{1,2})\\s*uhr(?:\\s+(\\d{1,2})(?!\\d))?${R}`),
    apply: (m, c) => setTime(c, Number(m[1]), m[2] ? Number(m[2]) : 0),
  },
  {
    kind: 'time',
    re: rx(`${L}(?:um\\s+)?halb\\s+(\\d{1,2})${R}`),
    apply: (m, c) => setTime(c, (Number(m[1]) + 23) % 24, 30, true),
  },
  {
    kind: 'time',
    re: rx(`${L}um\\s+(\\d{1,2})(?![\\d.:,])${R}`),
    apply: (m, c) => setTime(c, Number(m[1]), 0, true),
  },

  // ── Tageszeit ──
  {
    kind: 'timeOfDay',
    re: rx(`${L}(morgens|vormittags|mittags|nachmittags|abends|nachts)${R}`),
    apply: (m, c) => setTimeOfDay(c, m[1]),
  },
  {
    // "heute Abend", "morgen früh" – das Hauptwort nur direkt nach einer Tagesangabe.
    kind: 'timeOfDay',
    re: rx(`${L}(früh|frueh|vormittag|mittag|nachmittag|abend|nacht)${R}`),
    apply: (m, c) => c.acc.dateEnd !== undefined && c.between(c.acc.dateEnd, m.index).trim() === '' && setTimeOfDay(c, m[1]),
  },

  // ── Priorität ──
  { kind: 'priority', re: rx(`${L}(?:sehr\\s+wichtig|dringend|prio\\s*1|p1)${R}`), apply: (_m, c) => setPriority(c, 'urgent') },
  { kind: 'priority', re: rx(`${L}(?:wichtig|prio\\s*2|p2)${R}`), apply: (_m, c) => setPriority(c, 'high') },
  { kind: 'priority', re: rx(`!+(?=\\s|$)`), apply: (m, c) => setPriority(c, m[0].length >= 2 ? 'urgent' : 'high') },
];

function setTimeOfDay(ctx: Ctx, word: string): boolean {
  if (ctx.acc.timeOfDay) return false;
  ctx.acc.timeOfDay = /^(morgens|früh|frueh|vormittag)/.test(word) ? 'morning' : /^(mittag|nachmittag)/.test(word) ? 'afternoon' : 'evening';
  return true;
}

function setPriority(ctx: Ctx, p: Priority): boolean {
  if (ctx.acc.priority) return false;
  ctx.acc.priority = p;
  return true;
}

// ─── Auswertung ──────────────────────────────────────────────

/** Leerzeichen zusammenfassen, übrig gebliebene Satzzeichen bzw. ein hängendes "und" an den Rändern entfernen. */
function cleanTitle(text: string): string {
  let t = text.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
  for (let i = 0; i < 5; i++) {
    const next = t.replace(/^[,;:–-]+\s*/u, '').replace(/(?:\s*[,;:–-]+|\s+und)$/iu, '').trim();
    if (next === t) break;
    t = next;
  }
  return t;
}

export function parseQuickAdd(input: string, opts: QuickParseOptions): QuickParse {
  const raw = input.replace(/\s+/g, ' ').trim();
  const lower = raw.toLowerCase();
  if (lower.length !== raw.length) return { title: raw, chips: [] }; // Sonderzeichen mit anderer Länge – lieber nichts erkennen
  const ignore = new Set(opts.ignore ?? []);
  const masked = lower.split('');
  const removed = new Array<boolean>(raw.length).fill(false);
  const acc: Acc = {};
  const ctx: Ctx = { acc, today: opts.today, weekStartsOn: opts.weekStartsOn, between: (a, b) => masked.slice(a, b).join('').replaceAll(MASK, ' ') };

  for (const rule of RULES) {
    if (ignore.has(rule.kind)) continue;
    const text = masked.join('');
    for (const m of text.matchAll(rule.re)) {
      if (m[0].includes(MASK) || !rule.apply(m as RegExpExecArray, ctx)) continue;
      for (let i = m.index; i < m.index + m[0].length; i++) {
        masked[i] = MASK;
        removed[i] = true;
      }
    }
  }

  const title = cleanTitle(raw.split('').map((ch, i) => (removed[i] ? ' ' : ch)).join(''));
  if (!removed.some(Boolean) || title === '') return { title: raw, chips: [] };
  // Stand die Angabe am Anfang ("freitag geschenk kaufen"), beginnt der Titel groß.
  const result: QuickParse = { title: removed[0] ? title.charAt(0).toUpperCase() + title.slice(1) : title, chips: [] };

  // Uhrzeit: "um 5" meint am Nachmittag 17 Uhr; "abends"/"nachmittags" machen aus 8 → 20 Uhr.
  if (acc.time) {
    let { h } = acc.time;
    const pm = acc.timeOfDay === 'afternoon' || acc.timeOfDay === 'evening';
    if (h < 12 && (pm || (acc.time.ambiguous && h >= 1 && h <= 7 && acc.timeOfDay !== 'morning'))) h += 12;
    result.time = toHHMM(h * 60 + acc.time.m);
  }

  if (acc.horizon) {
    result.horizon = acc.horizon;
    result.date = acc.date;
    result.deadline = acc.deadline;
  } else if (result.time) {
    // Nur eine Uhrzeit ohne Tag: heute.
    result.horizon = 'day';
    result.date = opts.today;
  }

  if (acc.repeat?.type || acc.repeat?.weekdays) {
    const type = acc.repeat.type ?? 'weekly';
    const base = result.horizon === 'day' && result.date ? result.date : opts.today;
    const every = acc.repeat.every ?? 1;
    const rule: TodoRepeat =
      type === 'daily'
        ? { type, every, anchor: base }
        : type === 'weekly'
          ? { type, every, anchor: base, weekdays: acc.repeat.weekdays?.length ? acc.repeat.weekdays : [getWeekday(base)] }
          : { type, every, anchor: base, day: parseDateKey(base).getDate() };
    const first = firstOccurrenceFrom(rule, base < opts.today ? opts.today : base) ?? base;
    result.repeat = { ...rule, anchor: first };
    result.horizon = 'day';
    result.date = first;
    result.deadline = undefined;
  }

  if (acc.durationMin) result.durationMin = acc.durationMin;
  if (acc.priority) result.priority = acc.priority;
  if (acc.timeOfDay) result.timeOfDay = acc.timeOfDay;

  // Vorschau
  if (result.repeat) result.chips.push({ kind: 'repeat', label: repeatLabel(result.repeat) });
  if (result.horizon === 'week' && result.date) {
    const label = result.date === startOfWeek(opts.today, opts.weekStartsOn) ? 'Diese Woche' : 'Nächste Woche';
    result.chips.push({ kind: 'date', label: result.deadline ? `bis ${label}` : label });
  } else if (result.horizon === 'later') result.chips.push({ kind: 'date', label: 'Später' });
  else if (result.date && !result.repeat) {
    const label = relativeDayLabel(result.date, opts.today);
    result.chips.push({ kind: 'date', label: result.deadline ? `bis ${label}` : label });
  }
  if (result.time) result.chips.push({ kind: 'time', label: result.time });
  if (result.timeOfDay) result.chips.push({ kind: 'timeOfDay', label: TIME_OF_DAY_LABEL[result.timeOfDay] });
  if (result.durationMin) result.chips.push({ kind: 'duration', label: formatDuration(result.durationMin) });
  if (result.priority) result.chips.push({ kind: 'priority', label: result.priority === 'urgent' ? 'Dringend' : 'Wichtig' });
  return result;
}
