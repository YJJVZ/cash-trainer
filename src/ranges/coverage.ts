import { isBundledSpot } from './bundled';
import type { RangeSpot } from './types';

/** Identity of a preflop situation, independent of the data source. */
export function situationKey(s: RangeSpot): string {
  return `${s.family}|${s.hero}|${s.history.map((h) => `${h.position}:${h.kind}`).join(',')}`;
}

/** Bundled default spots whose situation is already covered by a spot from another (imported) range pack. */
export function coveredDefaultIds(spots: readonly RangeSpot[]): Set<string> {
  const real = new Set(spots.filter((s) => s.pack && !isBundledSpot(s)).map(situationKey));
  return new Set(spots.filter((s) => isBundledSpot(s) && real.has(situationKey(s))).map((s) => s.id));
}

/**
 * Spots offered for training. Default spots covered by an imported pack are hidden by default;
 * nothing is deleted, they stay visible in the viewer and the library.
 */
export function trainingSpots(spots: readonly RangeSpot[], showCoveredDefaults = false): RangeSpot[] {
  if (showCoveredDefaults) return [...spots];
  const hidden = coveredDefaultIds(spots);
  return spots.filter((s) => !hidden.has(s.id));
}
