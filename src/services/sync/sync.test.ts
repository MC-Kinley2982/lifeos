import { describe, expect, it } from 'vitest';
import { createExampleData } from '../../domain/defaults';
import type { Homework, Todo } from '../../domain/types';
import { emptyData, normalizeData } from '../../store/persistence';
import type { AppData } from '../../store/types';
import { createMemoryBackend } from '../cloud/memoryBackend';
import { MemoryCloudStore } from '../cloud/memoryStore';
import { createHomeworkInput } from '../school/homework';
import { SyncEngine, type DataPort, type MetaStorage, type SyncMeta } from './engine';
import { applyRecords, hashValue, stableStringify, toRecords } from './records';

const TODAY = '2026-09-30';
const ts = '2026-09-30T10:00:00.000Z';

/** Gemeinsame Uhr aller simulierten Geräte (wie die echte Uhrzeit). */
let clock = Date.parse('2026-09-30T12:00:00.000Z');
const tick = () => new Date((clock += 1000));

/** Ein simuliertes Gerät: eigene lokale Daten, eigener Sync-Speicher, gemeinsamer "Server". */
function device(server: MemoryCloudStore, initial: AppData) {
  let data = normalizeData(initial);
  const listeners = new Set<() => void>();
  const backups: AppData[] = [];
  const port: DataPort = {
    get: () => data,
    replace: (next) => {
      data = normalizeData(next);
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    backup: (d) => backups.push(d),
  };
  let meta: SyncMeta | null = null;
  const metaStore: MetaStorage = { load: () => meta, save: (m) => (meta = JSON.parse(JSON.stringify(m))), clear: () => (meta = null) };
  const backend = createMemoryBackend(server);
  const engine = new SyncEngine(backend, port, metaStore, { now: tick, isOnline: () => true });
  return {
    engine,
    backend,
    backups,
    get data() {
      return data;
    },
    edit(fn: (d: AppData) => AppData) {
      port.replace(fn(data));
    },
  };
}

function exampleData(): AppData {
  const ex = createExampleData(TODAY, 'Josh');
  return { ...emptyData(), ...ex, settings: { ...ex.settings, onboardingDone: true } };
}

function homework(data: AppData, title: string): Homework {
  const subject = data.subjects.find((s) => s.shortName === 'Ma')!;
  return { ...createHomeworkInput({ ...data } as never, subject.id, TODAY, { title }), id: `hw-${title}`, createdAt: ts, updatedAt: ts };
}

describe('Datensätze', () => {
  it('Fingerabdruck ist unabhängig von der Schlüssel-Reihenfolge', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
    expect(hashValue({ b: 1, a: undefined })).toBe(hashValue({ b: 1 }));
  });

  it('App-Daten → Datensätze → App-Daten ergibt denselben Stand', () => {
    const data = normalizeData(exampleData());
    const records = [...toRecords(data).values()].map((r) => ({ ...r, deleted: false, updatedAt: ts }));
    expect(applyRecords(emptyData(), records)).toEqual(data);
  });
});

describe('Erster Login', () => {
  it('Cloud leer → lokale Daten werden ins Konto übernommen', async () => {
    const server = new MemoryCloudStore();
    const pc = device(server, exampleData());
    await pc.engine.signUp('josh@example.com', 'geheim123');
    expect(pc.engine.getState().status).toBe('synced');
    const remote = server.dump(pc.engine.getState().session!.userId);
    expect(remote.filter((r) => r.collection === 'routines')).toHaveLength(pc.data.routines.length);
  });

  it('neues Gerät ohne Daten → Cloud-Daten werden verwendet', async () => {
    const server = new MemoryCloudStore();
    const pc = device(server, exampleData());
    await pc.engine.signUp('josh@example.com', 'geheim123');
    const phone = device(server, emptyData());
    await phone.engine.signIn('josh@example.com', 'geheim123');
    expect(phone.data.settings.onboardingDone).toBe(true);
    expect(phone.data.routines.map((r) => r.name).sort()).toEqual(pc.data.routines.map((r) => r.name).sort());
    expect(phone.data.timetable).toHaveLength(pc.data.timetable.length);
  });

  it('beide Seiten mit Daten → Dialog statt Überschreiben; "Cloud verwenden" legt vorher eine Sicherung an', async () => {
    const server = new MemoryCloudStore();
    const pc = device(server, exampleData());
    await pc.engine.signUp('josh@example.com', 'geheim123');

    const other = exampleData();
    other.routines = [];
    const phone = device(server, other);
    await phone.engine.signIn('josh@example.com', 'geheim123');
    expect(phone.engine.getState().linkDecision).toBeDefined();
    expect(phone.data.routines).toHaveLength(0); // noch nichts überschrieben

    await phone.engine.resolveLink('cloud');
    expect(phone.backups).toHaveLength(1);
    expect(phone.data.routines).toHaveLength(pc.data.routines.length);
  });

  it('"Lokale Daten übernehmen" ersetzt den Stand im Konto', async () => {
    const server = new MemoryCloudStore();
    const pc = device(server, exampleData());
    await pc.engine.signUp('josh@example.com', 'geheim123');

    const other = exampleData();
    other.routines = other.routines.slice(0, 1);
    const phone = device(server, other);
    await phone.engine.signIn('josh@example.com', 'geheim123');
    await phone.engine.resolveLink('local');

    await pc.engine.syncNow();
    expect(pc.data.routines.map((r) => r.id)).toEqual([other.routines[0].id]);
  });
});

describe('Fall 5: offline', () => {
  it('neue Hausaufgabe wird lokal gespeichert und später synchronisiert', async () => {
    const server = new MemoryCloudStore();
    const pc = device(server, exampleData());
    await pc.engine.signUp('josh@example.com', 'geheim123');
    const userId = pc.engine.getState().session!.userId;

    pc.backend.setOnline(false);
    pc.edit((d) => ({ ...d, homework: [...d.homework, homework(d, 'Offline-Mathe')] }));
    await pc.engine.syncNow();
    expect(pc.engine.getState().status).toBe('offline');
    expect(pc.engine.getState().pending).toBe(1);
    expect(pc.data.homework.map((h) => h.title)).toContain('Offline-Mathe'); // lokal vorhanden
    expect(server.dump(userId).some((r) => r.id === 'hw-Offline-Mathe')).toBe(false);

    pc.backend.setOnline(true);
    await pc.engine.syncNow();
    expect(pc.engine.getState()).toMatchObject({ status: 'synced', pending: 0 });
    expect(server.dump(userId).some((r) => r.id === 'hw-Offline-Mathe')).toBe(true);
  });
});

describe('Fall 6: PC ↔ iPhone', () => {
  const servers = new WeakMap<object, { store: MemoryCloudStore; userId: () => string }>();
  /** Was auf dem "Server" für das Konto eines Geräts liegt. */
  const server = (d: { engine: SyncEngine }) => {
    const s = servers.get(d)!;
    return s.store.dump(s.userId());
  };

  async function twoDevices() {
    const store = new MemoryCloudStore();
    const pc = device(store, exampleData());
    await pc.engine.signUp('josh@example.com', 'geheim123');
    const phone = device(store, emptyData());
    await phone.engine.signIn('josh@example.com', 'geheim123');
    for (const d of [pc, phone]) servers.set(d, { store, userId: () => d.engine.getState().session!.userId });
    return { pc, phone };
  }

  it('Hausaufgabe am PC erstellt → erscheint auf dem iPhone – und umgekehrt', async () => {
    const { pc, phone } = await twoDevices();
    pc.edit((d) => ({ ...d, homework: [...d.homework, homework(d, 'Mathe')] }));
    await pc.engine.syncNow();
    await phone.engine.syncNow();
    expect(phone.data.homework.map((h) => h.title)).toEqual(['Mathe']);

    phone.edit((d) => ({ ...d, homework: d.homework.map((h) => ({ ...h, status: 'done' as const })) }));
    await phone.engine.syncNow();
    await pc.engine.syncNow();
    expect(pc.data.homework[0].status).toBe('done');
  });

  it('Löschen wird übertragen', async () => {
    const { pc, phone } = await twoDevices();
    const removed = pc.data.routines[0].id;
    pc.edit((d) => ({ ...d, routines: d.routines.filter((r) => r.id !== removed) }));
    await pc.engine.syncNow();
    await phone.engine.syncNow();
    expect(phone.data.routines.some((r) => r.id === removed)).toBe(false);
  });

  it('Konflikt: die neuere Änderung gewinnt auf beiden Geräten', async () => {
    const { pc, phone } = await twoDevices();
    pc.backend.setOnline(false);
    phone.backend.setOnline(false);
    pc.edit((d) => ({ ...d, settings: { ...d.settings, profile: { ...d.settings.profile, name: 'PC' } } }));
    await pc.engine.syncNow(); // vorgemerkt (früher)
    phone.edit((d) => ({ ...d, settings: { ...d.settings, profile: { ...d.settings.profile, name: 'iPhone' } } }));
    await phone.engine.syncNow(); // vorgemerkt (später)

    pc.backend.setOnline(true);
    phone.backend.setOnline(true);
    await phone.engine.syncNow();
    await pc.engine.syncNow();
    await phone.engine.syncNow();
    expect(pc.data.settings.profile.name).toBe('iPhone');
    expect(phone.data.settings.profile.name).toBe('iPhone');
  });

  it('To-do offline auf dem iPhone erstellt → später synchronisiert → am PC sichtbar, Abhaken kommt zurück', async () => {
    const { pc, phone } = await twoDevices();
    const todo: Todo = { id: 'todo-papa', title: 'Spiel für Papa suchen', completed: false, horizon: 'day', date: TODAY, order: 1, createdAt: ts, updatedAt: ts };

    phone.backend.setOnline(false);
    phone.edit((d) => ({ ...d, todos: [...d.todos, todo] }));
    await phone.engine.syncNow();
    expect(phone.engine.getState().status).toBe('offline');
    expect(phone.data.todos.map((t) => t.title)).toEqual(['Spiel für Papa suchen']); // offline nutzbar
    expect(server(phone).some((r) => r.collection === 'todos')).toBe(false);

    phone.backend.setOnline(true);
    await phone.engine.syncNow();
    expect(server(phone).find((r) => r.collection === 'todos')).toMatchObject({ id: 'todo-papa', deleted: false });
    await pc.engine.syncNow();
    expect(pc.data.todos.map((t) => t.title)).toEqual(['Spiel für Papa suchen']);

    pc.edit((d) => ({ ...d, todos: d.todos.map((t) => ({ ...t, completed: true, completedAt: ts })) }));
    await pc.engine.syncNow();
    await phone.engine.syncNow();
    expect(phone.data.todos[0].completed).toBe(true);
  });

  it('übernommene Cloud-Änderungen werden nicht erneut hochgeladen', async () => {
    const { pc, phone } = await twoDevices();
    pc.edit((d) => ({ ...d, homework: [...d.homework, homework(d, 'Echo')] }));
    await pc.engine.syncNow();
    await phone.engine.syncNow();
    phone.engine.captureChanges();
    expect(phone.engine.getState().pending).toBe(0);
  });
});
