import { rankIndex, type Rank } from '../../engine/cards';
import { handKind, type HandClass } from '../../engine/hands';

const HIGH_CARD: Record<Rank, number> = {
  A: 10, K: 8, Q: 7, J: 6, T: 5, '9': 4.5, '8': 4, '7': 3.5, '6': 3, '5': 2.5, '4': 2, '3': 1.5, '2': 1,
};

/**
 * Chen formula (Bill Chen, public hand-strength heuristic).
 * Used ONLY to generate a fictional demo: this is not a GTO solution.
 */
export function chenScore(hand: HandClass): number {
  const r1 = hand[0] as Rank;
  const r2 = hand[1] as Rank;
  const kind = handKind(hand);
  if (kind === 'pair') return Math.max(5, HIGH_CARD[r1] * 2);
  let score = HIGH_CARD[r1];
  if (kind === 'suited') score += 2;
  const gap = rankIndex(r2) - rankIndex(r1) - 1;
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && rankIndex(r1) > rankIndex('Q')) score += 1;
  return Math.ceil(score);
}
