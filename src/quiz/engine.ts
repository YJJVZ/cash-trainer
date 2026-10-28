import type { Card } from '../engine/cards';
import { combosOf, combosPerKind, handKind, type HandClass } from '../engine/hands';
import type { Position } from '../engine/positions';
import { pick, pickWeighted, type Rng } from '../engine/random';
import { topActions } from '../ranges/analysis';
import type { RangeSpot, SpotFamily, SpotMode, Strategy } from '../ranges/types';
import { standardPolicy, type ScoringPolicy, type Verdict } from './scoring';

export interface QuizFilter {
  families: SpotFamily[];
  heroes: Position[];
  /** Optionally restricts to specific spots. */
  spotIds?: string[];
}

export interface QuizItemRef {
  spotId: string;
  hand: HandClass;
}

export interface Question extends QuizItemRef {
  id: string;
  combo: readonly [Card, Card];
  /** Where the question came from (random, mistake review, spaced repetition). */
  origin: 'random' | 'review' | 'srs';
}

export interface Evaluation {
  verdict: Verdict;
  chosen: string;
  chosenFrequency: number;
  bestActions: string[];
  strategy: Strategy;
}

let counter = 0;
const nextId = () => `q${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Spots playable in the requested mode and matching the filters. */
export function eligibleSpots(spots: readonly RangeSpot[], filter: QuizFilter, mode: SpotMode = 'standard'): RangeSpot[] {
  return spots.filter(
    (s) =>
      s.mode === mode &&
      filter.families.includes(s.family) &&
      filter.heroes.includes(s.hero) &&
      (!filter.spotIds || filter.spotIds.includes(s.id)) &&
      definedHands(s).length > 0,
  );
}

/** Provided hands only: a missing hand is NEVER quizzed. */
export function definedHands(spot: RangeSpot): HandClass[] {
  return Object.keys(spot.hands).filter((h) => spot.hands[h] !== undefined);
}

export function isPlayable(spot: RangeSpot | undefined, hand: HandClass): spot is RangeSpot {
  return !!spot && spot.hands[hand] !== undefined;
}

export function questionFor(spot: RangeSpot, hand: HandClass, rng: Rng, origin: Question['origin'] = 'random'): Question {
  if (!spot.hands[hand]) throw new Error(`Hand ${hand} not provided in ${spot.id}`);
  return { id: nextId(), spotId: spot.id, hand, combo: pick(combosOf(hand), rng), origin };
}

/**
 * Deals a random hand: uniform spot, then hand weighted by its combo count
 * (equivalent to dealing two random cards among provided hands).
 */
export function drawRandomQuestion(spots: readonly RangeSpot[], rng: Rng): Question {
  if (spots.length === 0) throw new Error('No eligible spot');
  const spot = pick(spots, rng);
  const hands = definedHands(spot);
  const hand = pickWeighted(hands, hands.map((h) => combosPerKind(handKind(h))), rng);
  return questionFor(spot, hand, rng, 'random');
}

export interface DrawOptions {
  rng: Rng;
  /** Spaced-repetition items due (already filtered by date). */
  due?: QuizItemRef[];
  /** Probability of drawing a due item when there is one. */
  srsRatio?: number;
  /** Avoids asking the same hand twice in a row. */
  previous?: QuizItemRef;
}

export function drawNext(spots: readonly RangeSpot[], opts: DrawOptions): Question {
  const byId = new Map(spots.map((s) => [s.id, s]));
  const due = (opts.due ?? []).filter(
    (d) => isPlayable(byId.get(d.spotId), d.hand) && !(opts.previous && sameItem(d, opts.previous)),
  );
  if (due.length > 0 && opts.rng() < (opts.srsRatio ?? 0.3)) {
    const item = pick(due, opts.rng);
    return questionFor(byId.get(item.spotId)!, item.hand, opts.rng, 'srs');
  }
  let q = drawRandomQuestion(spots, opts.rng);
  for (let i = 0; i < 3 && opts.previous && sameItem(q, opts.previous); i++) q = drawRandomQuestion(spots, opts.rng);
  return q;
}

export function sameItem(a: QuizItemRef, b: QuizItemRef): boolean {
  return a.spotId === b.spotId && a.hand === b.hand;
}

export function evaluateAnswer(spot: RangeSpot, hand: HandClass, actionId: string, policy: ScoringPolicy = standardPolicy): Evaluation {
  const strategy = spot.hands[hand];
  if (!strategy) throw new Error(`Hand ${hand} not provided: cannot grade`);
  if (!spot.actions.some((a) => a.id === actionId)) throw new Error(`Illegal action "${actionId}"`);
  return {
    verdict: policy.evaluate(strategy, actionId),
    chosen: actionId,
    chosenFrequency: strategy[actionId] ?? 0,
    bestActions: topActions(strategy),
    strategy,
  };
}

/** Mistake review queue: deduplicated, shuffled, a fresh combo per hand. */
export function buildReviewQueue(mistakes: QuizItemRef[], spots: readonly RangeSpot[], rng: Rng): Question[] {
  const byId = new Map(spots.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const unique: QuizItemRef[] = [];
  for (const m of mistakes) {
    const key = `${m.spotId}|${m.hand}`;
    if (seen.has(key) || !isPlayable(byId.get(m.spotId), m.hand)) continue;
    seen.add(key);
    unique.push(m);
  }
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [unique[i], unique[j]] = [unique[j]!, unique[i]!];
  }
  return unique.map((m) => questionFor(byId.get(m.spotId)!, m.hand, rng, 'review'));
}
