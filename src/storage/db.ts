import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RangeSpot } from '../ranges/types';
import type { SrsItem } from '../stats/srs';
import type { AnswerRecord } from '../stats/types';

interface TrainerDB extends DBSchema {
  spots: { key: string; value: RangeSpot };
  answers: { key: string; value: AnswerRecord; indexes: { ts: number } };
  srs: { key: string; value: SrsItem };
  meta: { key: string; value: unknown };
}

export interface Storage {
  getSpots(): Promise<RangeSpot[]>;
  putSpots(spots: RangeSpot[]): Promise<void>;
  deleteSpots(ids: string[]): Promise<void>;
  getAnswers(): Promise<AnswerRecord[]>;
  addAnswer(r: AnswerRecord): Promise<void>;
  getSrs(): Promise<SrsItem[]>;
  putSrs(i: SrsItem): Promise<void>;
  deleteSrs(keys: string[]): Promise<void>;
  clearStats(): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
  persistent: boolean;
}

async function idbStorage(): Promise<Storage> {
  const db: IDBPDatabase<TrainerDB> = await openDB<TrainerDB>('cash-trainer', 1, {
    upgrade(d) {
      d.createObjectStore('spots', { keyPath: 'id' });
      d.createObjectStore('answers', { keyPath: 'id' }).createIndex('ts', 'ts');
      d.createObjectStore('srs', { keyPath: 'key' });
      d.createObjectStore('meta');
    },
  });
  return {
    persistent: true,
    getSpots: () => db.getAll('spots'),
    async putSpots(spots) {
      const tx = db.transaction('spots', 'readwrite');
      await Promise.all([...spots.map((s) => tx.store.put(s)), tx.done]);
    },
    async deleteSpots(ids) {
      const tx = db.transaction('spots', 'readwrite');
      await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
    },
    getAnswers: () => db.getAllFromIndex('answers', 'ts'),
    addAnswer: async (r) => void (await db.put('answers', r)),
    getSrs: () => db.getAll('srs'),
    putSrs: async (i) => void (await db.put('srs', i)),
    async deleteSrs(keys) {
      const tx = db.transaction('srs', 'readwrite');
      await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done]);
    },
    async clearStats() {
      await Promise.all([db.clear('answers'), db.clear('srs')]);
    },
    getMeta: async <T,>(key: string) => (await db.get('meta', key)) as T | undefined,
    setMeta: async (key, value) => void (await db.put('meta', value, key)),
  };
}

/** In-memory fallback when IndexedDB is unavailable (strict private browsing…). */
function memoryStorage(): Storage {
  const spots = new Map<string, RangeSpot>();
  const answers: AnswerRecord[] = [];
  const srs = new Map<string, SrsItem>();
  const meta = new Map<string, unknown>();
  return {
    persistent: false,
    getSpots: async () => [...spots.values()],
    putSpots: async (s) => s.forEach((x) => spots.set(x.id, x)),
    deleteSpots: async (ids) => ids.forEach((id) => spots.delete(id)),
    getAnswers: async () => [...answers],
    addAnswer: async (r) => void answers.push(r),
    getSrs: async () => [...srs.values()],
    putSrs: async (i) => void srs.set(i.key, i),
    deleteSrs: async (keys) => keys.forEach((k) => srs.delete(k)),
    clearStats: async () => {
      answers.length = 0;
      srs.clear();
    },
    getMeta: async <T,>(key: string) => meta.get(key) as T | undefined,
    setMeta: async (key, value) => void meta.set(key, value),
  };
}

export async function openStorage(): Promise<Storage> {
  try {
    return await idbStorage();
  } catch {
    return memoryStorage();
  }
}
