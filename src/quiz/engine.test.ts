import { describe, expect, it } from 'vitest';
import { handClassOf } from '../engine/hands';
import { seededRng } from '../engine/random';
import { DEMO_SPOTS } from '../ranges/demo/demoRanges';
import type { RangeSpot } from '../ranges/types';
import {
  buildReviewQueue, definedHands, drawNext, drawRandomQuestion, eligibleSpots, evaluateAnswer, questionFor, type QuizFilter,
} from './engine';
import { explain, neighbours } from './explain';
import { proPolicy, standardPolicy } from './scoring';

const spots = [...DEMO_SPOTS];
const all: QuizFilter = { families: ['RFI', 'VS_OPEN', 'VS_3BET', 'VS_4BET', 'BVB_LIMP'], heroes: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] };
const byId = (id: string) => spots.find((s) => s.id === id)!;

describe('spot selection', () => {
  it('filters by family and position', () => {
    const r = eligibleSpots(spots, { families: ['RFI'], heroes: ['BTN'] });
    expect(r.map((s) => s.id)).toEqual(['demo-btn-rfi']);
  });

  it('excludes Pro spots from the Standard quiz', () => {
    expect(eligibleSpots(spots, all).some((s) => s.mode === 'pro')).toBe(false);
    expect(eligibleSpots(spots, all, 'pro').every((s) => s.mode === 'pro')).toBe(true);
  });

  it('excludes spots with no provided hand', () => {
    const empty: RangeSpot = { ...byId('demo-btn-rfi'), id: 'empty', hands: {} };
    expect(eligibleSpots([empty], all)).toEqual([]);
  });

  it('can restrict to a list of spots', () => {
    expect(eligibleSpots(spots, { ...all, spotIds: ['demo-bb-vs-btn'] })).toHaveLength(1);
  });
});

describe('dealing hands', () => {
  it('never deals a hand that is not provided', () => {
    const partial = byId('demo-btn-vs-bb-3bet');
    const defined = new Set(definedHands(partial));
    expect(defined.size).toBeLessThan(169);
    const rng = seededRng(1);
    for (let i = 0; i < 2000; i++) {
      const q = drawRandomQuestion([partial], rng);
      expect(defined.has(q.hand)).toBe(true);
    }
  });

  it('the dealt combo always matches the announced class', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 500; i++) {
      const q = drawRandomQuestion(eligibleSpots(spots, all), rng);
      expect(handClassOf(q.combo[0], q.combo[1])).toBe(q.hand);
    }
  });

  it('is deterministic with a seed', () => {
    const a = drawRandomQuestion(spots, seededRng(42));
    const b = drawRandomQuestion(spots, seededRng(42));
    expect([a.spotId, a.hand, a.combo]).toEqual([b.spotId, b.hand, b.combo]);
  });

  it('weights by combo count (≈ 6/1326 for a given pair)', () => {
    const rng = seededRng(3);
    const spot = byId('demo-utg-rfi');
    let offsuit = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (drawRandomQuestion([spot], rng).hand.endsWith('o')) offsuit++;
    expect(offsuit / n).toBeGreaterThan(0.68);
    expect(offsuit / n).toBeLessThan(0.73); // 936 / 1326 ≈ 0.706
  });

  it('refuses to build a question on a missing hand', () => {
    expect(() => questionFor(byId('demo-btn-vs-bb-3bet'), '72o', seededRng(1))).toThrow(/not provided/);
  });

  it('draws due spaced-repetition items and skips unplayable ones', () => {
    const due = [{ spotId: 'demo-bb-vs-btn', hand: 'K9o' }, { spotId: 'demo-btn-vs-bb-3bet', hand: '72o' }];
    const q = drawNext(spots, { rng: seededRng(5), due, srsRatio: 1 });
    expect(q.origin).toBe('srs');
    expect(q.hand).toBe('K9o');
  });

  it('avoids asking the same hand twice in a row', () => {
    const due = [{ spotId: 'demo-bb-vs-btn', hand: 'K9o' }];
    const q = drawNext(spots, { rng: seededRng(5), due, srsRatio: 1, previous: due[0] });
    expect(q.origin).toBe('random');
  });
});

describe('correction', () => {
  it('Standard: correct only for the range action', () => {
    const s = byId('demo-utg-rfi');
    expect(evaluateAnswer(s, 'AA', 'raise').verdict).toBe('correct');
    expect(evaluateAnswer(s, 'AA', 'fold').verdict).toBe('wrong');
    expect(evaluateAnswer(s, '72o', 'fold').verdict).toBe('correct');
  });

  it('rejects an illegal action or a missing hand', () => {
    expect(() => evaluateAnswer(byId('demo-utg-rfi'), 'AA', 'call')).toThrow(/Illegal/);
    expect(() => evaluateAnswer(byId('demo-btn-vs-bb-3bet'), '72o', 'fold')).toThrow(/not provided/);
  });

  it('scoring policies with mixed frequencies (Pro mode groundwork)', () => {
    const mixed = { raise: 0.7, fold: 0.3 };
    expect(standardPolicy.evaluate(mixed, 'raise')).toBe('correct');
    expect(standardPolicy.evaluate(mixed, 'fold')).toBe('wrong');
    expect(proPolicy(0.2).evaluate(mixed, 'fold')).toBe('partial');
    expect(proPolicy(0.5).evaluate(mixed, 'fold')).toBe('wrong');
    expect(standardPolicy.evaluate({ raise: 0.5, fold: 0.5 }, 'fold')).toBe('correct');
  });
});

describe('explanations', () => {
  it('describe the situation, the answer and the source', () => {
    const s = byId('demo-bb-vs-btn');
    const ev = evaluateAnswer(s, 'AA', 'call');
    const text = explain(s, 'AA', ev).join('\n');
    expect(text).toMatch(/BTN open 2.5 BB/);
    expect(text).toMatch(/3-bet/);
    expect(text).toMatch(/Fictional demo/);
  });

  it('computes neighbouring hands', () => {
    expect(neighbours('KTo')).toEqual({ stronger: 'KJo', weaker: 'K9o' });
    expect(neighbours('AKs')).toEqual({ stronger: undefined, weaker: 'AQs' });
    expect(neighbours('TT')).toEqual({ stronger: 'JJ', weaker: '99' });
    expect(neighbours('22').weaker).toBeUndefined();
  });
});

describe('mistake review', () => {
  it('deduplicates and skips unplayable hands', () => {
    const mistakes = [
      { spotId: 'demo-utg-rfi', hand: 'A5s' },
      { spotId: 'demo-utg-rfi', hand: 'A5s' },
      { spotId: 'demo-bb-vs-btn', hand: 'K9o' },
      { spotId: 'inconnu', hand: 'AA' },
      { spotId: 'demo-btn-vs-bb-3bet', hand: '72o' },
    ];
    const q = buildReviewQueue(mistakes, spots, seededRng(9));
    expect(q).toHaveLength(2);
    expect(q.every((x) => x.origin === 'review')).toBe(true);
  });
});
