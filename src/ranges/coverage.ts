import { isDemoSpot } from './demo/demoRanges';
import type { RangeSpot } from './types';

/** Identity of a preflop situation, independent of the data source. */
export function situationKey(s: RangeSpot): string {
  return `${s.family}|${s.hero}|${s.history.map((h) => `${h.position}:${h.kind}`).join(',')}`;
}

/** Demo spots whose situation is already covered by a spot coming from a real (v2) range pack. */
export function coveredDemoIds(spots: readonly RangeSpot[]): Set<string> {
  const real = new Set(spots.filter((s) => s.pack && !isDemoSpot(s)).map(situationKey));
  return new Set(spots.filter((s) => isDemoSpot(s) && real.has(situationKey(s))).map((s) => s.id));
}

/**
 * Spots offered for training. Demo spots covered by a real pack are hidden by default;
 * nothing is deleted, they stay visible in the viewer and the library.
 */
export function trainingSpots(spots: readonly RangeSpot[], showCoveredDemos = false): RangeSpot[] {
  if (showCoveredDemos) return [...spots];
  const hidden = coveredDemoIds(spots);
  return spots.filter((s) => !hidden.has(s.id));
}
