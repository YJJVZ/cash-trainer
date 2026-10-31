import { actionColor } from '../engine/actions';
import { ALL_HANDS, combosPerKind, handKind, type HandClass } from '../engine/hands';
import type { Position } from '../engine/positions';
import { pick, type Rng } from '../engine/random';
import type { RangeSpot } from '../ranges/types';

/**
 * "Read the range" game: a villain opens from a position, the player paints the range
 * they think the villain plays, then compares it with the spot's range (Standard view).
 */

const TOTAL_COMBOS = 1326;
const combos = (h: HandClass) => combosPerKind(handKind(h));

/** RFI spots with a complete range: the only ones where "what does villain open?" has a full answer. */
export function guessableSpots(spots: readonly RangeSpot[], heroes?: readonly Position[]): RangeSpot[] {
  return spots.filter(
    (s) => s.family === 'RFI' && s.mode === 'standard' && Object.keys(s.hands).length === ALL_HANDS.length && (!heroes || heroes.includes(s.hero)),
  );
}

export function drawGuessSpot(spots: readonly RangeSpot[], rng: Rng, previous?: string): RangeSpot {
  if (spots.length === 0) throw new Error('No spot to guess');
  const fresh = spots.filter((s) => s.id !== previous);
  return pick(fresh.length ? fresh : spots, rng);
}

/** Hands the villain puts money in with (any non-fold action: open, or limp from the SB). */
export function playedHands(spot: RangeSpot): Set<HandClass> {
  const kinds = new Map(spot.actions.map((a) => [a.id, a.kind]));
  return new Set(
    ALL_HANDS.filter((h) => {
      const s = spot.hands[h];
      return !!s && Object.entries(s).some(([id, f]) => f > 0 && actionColor(kinds.get(id) ?? 'fold') !== 'fold');
    }),
  );
}

export type GuessCell = 'hit' | 'missed' | 'extra' | 'fold';

export interface GuessResult {
  cells: Record<HandClass, GuessCell>;
  hitCombos: number;
  missedCombos: number;
  extraCombos: number;
  /** Share of all combos in each range (0–1). */
  guessedPct: number;
  actualPct: number;
  /** Overlap of both ranges in combos (intersection / union, 0–1): 1 = identical. */
  match: number;
}

export function scoreGuess(spot: RangeSpot, guess: ReadonlySet<HandClass>): GuessResult {
  const actual = playedHands(spot);
  const cells: Record<HandClass, GuessCell> = {};
  let hit = 0;
  let missed = 0;
  let extra = 0;
  for (const h of ALL_HANDS) {
    const inA = actual.has(h);
    const inG = guess.has(h);
    cells[h] = inA && inG ? 'hit' : inA ? 'missed' : inG ? 'extra' : 'fold';
    if (inA && inG) hit += combos(h);
    else if (inA) missed += combos(h);
    else if (inG) extra += combos(h);
  }
  const union = hit + missed + extra;
  return {
    cells,
    hitCombos: hit,
    missedCombos: missed,
    extraCombos: extra,
    guessedPct: (hit + extra) / TOTAL_COMBOS,
    actualPct: (hit + missed) / TOTAL_COMBOS,
    match: union === 0 ? 1 : hit / union,
  };
}

export function rangePct(hands: ReadonlySet<HandClass>): number {
  let n = 0;
  for (const h of hands) n += combos(h);
  return n / TOTAL_COMBOS;
}
