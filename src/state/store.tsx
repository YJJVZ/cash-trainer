import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Evaluation, Question } from '../quiz/engine';
import { actionLabel } from '../ranges/describe';
import { DEMO_SPOTS, DEMO_VERSION, isDemoSpot } from '../ranges/demo/demoRanges';
import type { RangeSpot } from '../ranges/types';
import { srsKey, updateSrs, type SrsItem } from '../stats/srs';
import type { AnswerRecord } from '../stats/types';
import { cardToString } from '../engine/cards';
import { openStorage, type Storage } from '../storage/db';

interface Store {
  ready: boolean;
  persistent: boolean;
  spots: RangeSpot[];
  answers: AnswerRecord[];
  srs: SrsItem[];
  sessionId: string;
  spotById(id: string): RangeSpot | undefined;
  recordAnswer(q: Question, spot: RangeSpot, ev: Evaluation): Promise<AnswerRecord>;
  saveSpots(spots: RangeSpot[]): Promise<void>;
  deleteSpots(ids: string[]): Promise<void>;
  restoreDemo(): Promise<void>;
  resetStats(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const db = useRef<Storage | null>(null);
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [spots, setSpots] = useState<RangeSpot[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [srs, setSrs] = useState<SrsItem[]>([]);
  const sessionId = useMemo(() => `s${Date.now().toString(36)}`, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await openStorage();
      // Fictional demo seeded once; the user may delete it.
      if (!(await s.getMeta<boolean>('demoSeeded'))) {
        await s.putSpots([...DEMO_SPOTS]);
        await s.setMeta('demoSeeded', true);
        await s.setMeta('demoVersion', DEMO_VERSION);
      } else if ((await s.getMeta<number>('demoVersion')) !== DEMO_VERSION) {
        // Refresh stored demo copies (e.g. after translation) without restoring deleted ones.
        const kept = new Set((await s.getSpots()).filter(isDemoSpot).map((x) => x.id));
        await s.putSpots(DEMO_SPOTS.filter((d) => kept.has(d.id)));
        await s.setMeta('demoVersion', DEMO_VERSION);
      }
      const [sp, an, sr] = await Promise.all([s.getSpots(), s.getAnswers(), s.getSrs()]);
      if (cancelled) return;
      db.current = s;
      setPersistent(s.persistent);
      setSpots(sp.sort((a, b) => a.id.localeCompare(b.id)));
      setAnswers(an);
      setSrs(sr);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const spotById = useCallback((id: string) => spots.find((s) => s.id === id), [spots]);

  const recordAnswer = useCallback(
    async (q: Question, spot: RangeSpot, ev: Evaluation) => {
      const now = Date.now();
      const record: AnswerRecord = {
        id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        ts: now,
        sessionId,
        spotId: spot.id,
        spotName: spot.name,
        family: spot.family,
        hero: spot.hero,
        hand: q.hand,
        combo: q.combo.map(cardToString).join(''),
        chosen: ev.chosen,
        chosenLabel: actionLabel(spot, ev.chosen),
        expectedLabel: ev.bestActions.map((id) => actionLabel(spot, id)).join(' / '),
        verdict: ev.verdict,
        origin: q.origin,
      };
      setAnswers((a) => [...a, record]);
      await db.current?.addAnswer(record);
      const key = srsKey(spot.id, q.hand);
      const prev = srs.find((i) => i.key === key);
      const next = updateSrs(prev, spot.id, q.hand, ev.verdict, now);
      if (next) {
        setSrs((items) => [...items.filter((i) => i.key !== key), next]);
        await db.current?.putSrs(next);
      }
      return record;
    },
    [sessionId, srs],
  );

  const saveSpots = useCallback(async (incoming: RangeSpot[]) => {
    const stamped = incoming.map((s) => ({ ...s, updatedAt: new Date().toISOString() }));
    await db.current?.putSpots(stamped);
    setSpots((cur) => {
      const ids = new Set(stamped.map((s) => s.id));
      return [...cur.filter((s) => !ids.has(s.id)), ...stamped].sort((a, b) => a.id.localeCompare(b.id));
    });
  }, []);

  const deleteSpots = useCallback(async (ids: string[]) => {
    await db.current?.deleteSpots(ids);
    setSpots((cur) => cur.filter((s) => !ids.includes(s.id)));
    const orphan = srs.filter((i) => ids.includes(i.spotId)).map((i) => i.key);
    await db.current?.deleteSrs(orphan);
    setSrs((cur) => cur.filter((i) => !ids.includes(i.spotId)));
  }, [srs]);

  const restoreDemo = useCallback(() => saveSpots([...DEMO_SPOTS]), [saveSpots]);

  const resetStats = useCallback(async () => {
    await db.current?.clearStats();
    setAnswers([]);
    setSrs([]);
  }, []);

  const value: Store = {
    ready, persistent, spots, answers, srs, sessionId, spotById, recordAnswer, saveSpots, deleteSpots, restoreDemo, resetStats,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
