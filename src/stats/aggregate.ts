import type { AnswerRecord } from './types';

export interface Tally {
  total: number;
  correct: number;
  partial: number;
  wrong: number;
  accuracy: number;
}

export function tally(records: readonly AnswerRecord[]): Tally {
  const t = { total: records.length, correct: 0, partial: 0, wrong: 0, accuracy: 0 };
  for (const r of records) t[r.verdict]++;
  t.accuracy = t.total ? (t.correct + t.partial * 0.5) / t.total : 0;
  return t;
}

export function groupBy<K extends string>(records: readonly AnswerRecord[], key: (r: AnswerRecord) => K): Map<K, Tally> {
  const groups = new Map<K, AnswerRecord[]>();
  for (const r of records) {
    const k = key(r);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(r);
  }
  return new Map([...groups].map(([k, g]) => [k, tally(g)]));
}

export const byPosition = (records: readonly AnswerRecord[]) => groupBy(records, (r) => r.hero);
export const bySpot = (records: readonly AnswerRecord[]) => groupBy(records, (r) => r.spotId);
export const byFamily = (records: readonly AnswerRecord[]) => groupBy(records, (r) => r.family);

/** Mistake history, most recent first. */
export function errorHistory(records: readonly AnswerRecord[], limit = 50): AnswerRecord[] {
  return records
    .filter((r) => r.verdict !== 'correct')
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

/** Most frequently missed hands. */
export function worstHands(records: readonly AnswerRecord[], limit = 10) {
  const g = groupBy(records, (r) => `${r.spotId}|${r.hand}`);
  return [...g]
    .filter(([, t]) => t.wrong + t.partial > 0)
    .map(([key, t]) => {
      const [spotId, hand] = key.split('|') as [string, string];
      return { spotId, hand, ...t };
    })
    .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy)
    .slice(0, limit);
}

/** Current streak of correct answers (from most recent backwards). */
export function currentStreak(records: readonly AnswerRecord[]): number {
  const sorted = [...records].sort((a, b) => b.ts - a.ts);
  let n = 0;
  for (const r of sorted) {
    if (r.verdict !== 'correct') break;
    n++;
  }
  return n;
}

/** Answers per day over the last `days` days (index 0 = days-1 days ago). */
export function dailyActivity(records: readonly AnswerRecord[], days: number, now = Date.now()): Tally[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const first = start.getTime() - (days - 1) * 86_400_000;
  const buckets: AnswerRecord[][] = Array.from({ length: days }, () => []);
  for (const r of records) {
    const i = Math.floor((r.ts - first) / 86_400_000);
    if (i >= 0 && i < days) buckets[i]!.push(r);
  }
  return buckets.map(tally);
}
