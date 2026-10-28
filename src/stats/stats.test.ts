import { describe, expect, it } from 'vitest';
import { byPosition, bySpot, currentStreak, dailyActivity, errorHistory, tally, worstHands } from './aggregate';
import { MAX_BOX, SRS_INTERVALS_MS, boxDistribution, dueItems, updateSrs } from './srs';
import type { AnswerRecord } from './types';

let t = 1_000_000;
const rec = (over: Partial<AnswerRecord>): AnswerRecord => ({
  id: String(t),
  ts: t++,
  sessionId: 's',
  spotId: 'a',
  spotName: 'A',
  family: 'RFI',
  hero: 'BTN',
  hand: 'AA',
  combo: 'AsAh',
  chosen: 'raise',
  chosenLabel: 'Raise',
  expectedLabel: 'Raise',
  verdict: 'correct',
  origin: 'random',
  ...over,
});

describe('aggregates', () => {
  const records = [
    rec({}),
    rec({ verdict: 'wrong', hand: 'KTo' }),
    rec({ hero: 'BB', spotId: 'b', verdict: 'wrong', hand: 'K9o' }),
    rec({ hero: 'BB', spotId: 'b', verdict: 'wrong', hand: 'K9o' }),
    rec({ hero: 'BB', spotId: 'b' }),
  ];

  it('counts total and accuracy', () => {
    expect(tally(records)).toMatchObject({ total: 5, correct: 2, wrong: 3, accuracy: 0.4 });
    expect(tally([]).accuracy).toBe(0);
  });

  it('breaks down by position and spot', () => {
    expect(byPosition(records).get('BTN')).toMatchObject({ total: 2, correct: 1 });
    expect(byPosition(records).get('BB')).toMatchObject({ total: 3, correct: 1 });
    expect(bySpot(records).get('b')!.wrong).toBe(2);
  });

  it('lists mistakes from newest to oldest', () => {
    const errs = errorHistory(records);
    expect(errs).toHaveLength(3);
    expect(errs[0]!.ts).toBeGreaterThan(errs[1]!.ts);
  });

  it('identifies the most missed hands', () => {
    expect(worstHands(records)[0]).toMatchObject({ spotId: 'b', hand: 'K9o', wrong: 2 });
  });

  it('computes the current streak', () => {
    expect(currentStreak(records)).toBe(1);
  });

  it('groups activity by day', () => {
    const now = new Date(2026, 0, 10, 12).getTime();
    const days = dailyActivity([rec({ ts: now }), rec({ ts: now - 86_400_000 }), rec({ ts: now - 30 * 86_400_000 })], 7, now);
    expect(days).toHaveLength(7);
    expect(days[6]!.total).toBe(1);
    expect(days[5]!.total).toBe(1);
  });
});

describe('spaced repetition', () => {
  it('a correct answer on a never-missed hand creates no item', () => {
    expect(updateSrs(undefined, 'a', 'AA', 'correct', 0)).toBeUndefined();
  });

  it('a mistake puts the hand in box 1, due soon', () => {
    const i = updateSrs(undefined, 'a', 'KTo', 'wrong', 1000)!;
    expect(i).toMatchObject({ box: 1, lapses: 1, due: 1000 + SRS_INTERVALS_MS[1]! });
  });

  it('correct answers raise the box up to the max, a mistake resets it to 1', () => {
    let i = updateSrs(undefined, 'a', 'KTo', 'wrong', 0)!;
    for (let k = 0; k < 10; k++) i = updateSrs(i, 'a', 'KTo', 'correct', 0)!;
    expect(i.box).toBe(MAX_BOX);
    i = updateSrs(i, 'a', 'KTo', 'wrong', 0)!;
    expect(i).toMatchObject({ box: 1, lapses: 2 });
  });

  it('returns only due items, sorted by due date', () => {
    const a = { ...updateSrs(undefined, 'a', 'KTo', 'wrong', 0)!, due: 50 };
    const b = { ...updateSrs(undefined, 'a', 'K9o', 'wrong', 0)!, due: 10 };
    const c = { ...updateSrs(undefined, 'a', 'Q9o', 'wrong', 0)!, due: 500 };
    expect(dueItems([a, b, c], 100).map((x) => x.hand)).toEqual(['K9o', 'KTo']);
    expect(boxDistribution([a, b, c])[1]).toBe(3);
  });
});
