import type { HandClass } from '../engine/hands';
import type { Verdict } from '../quiz/scoring';

/**
 * Simple spaced repetition (Leitner boxes).
 * Mistake → box 1 (quick review). Correct answer → next box, longer interval.
 */
export const SRS_INTERVALS_MS = [
  0, // box 0: unused
  5 * 60_000, // box 1: 5 min
  60 * 60_000, // box 2: 1 h
  24 * 3_600_000, // box 3: 1 d
  3 * 24 * 3_600_000, // box 4: 3 d
  10 * 24 * 3_600_000, // box 5: 10 d
];
export const MAX_BOX = SRS_INTERVALS_MS.length - 1;

export interface SrsItem {
  key: string;
  spotId: string;
  hand: HandClass;
  box: number;
  due: number;
  lapses: number;
  reviews: number;
  lastSeen: number;
}

export const srsKey = (spotId: string, hand: HandClass) => `${spotId}|${hand}`;

/**
 * Updates (or creates) the item after an answer. Only hands already missed
 * enter the system: a correct answer on an untracked hand creates nothing.
 */
export function updateSrs(item: SrsItem | undefined, spotId: string, hand: HandClass, verdict: Verdict, now: number): SrsItem | undefined {
  if (!item && verdict === 'correct') return undefined;
  const base: SrsItem = item ?? { key: srsKey(spotId, hand), spotId, hand, box: 1, due: now, lapses: 0, reviews: 0, lastSeen: now };
  const box = verdict === 'correct' ? Math.min(MAX_BOX, base.box + 1) : 1;
  return {
    ...base,
    box,
    due: now + SRS_INTERVALS_MS[box]!,
    lapses: base.lapses + (verdict === 'correct' ? 0 : 1),
    reviews: base.reviews + 1,
    lastSeen: now,
  };
}

export function dueItems(items: readonly SrsItem[], now: number): SrsItem[] {
  return items.filter((i) => i.due <= now).sort((a, b) => a.due - b.due);
}

/** An item in the top box is considered mastered. */
export function isMastered(item: SrsItem): boolean {
  return item.box === MAX_BOX;
}

export function boxDistribution(items: readonly SrsItem[]): number[] {
  const out = Array.from({ length: MAX_BOX + 1 }, () => 0);
  for (const i of items) out[i.box]!++;
  return out;
}
