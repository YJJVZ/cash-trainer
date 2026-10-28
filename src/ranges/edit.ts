import { ALL_HANDS, type HandClass } from '../engine/hands';
import { isDemoSpot } from './demo/demoRanges';
import type { RangeSpot } from './types';

/**
 * Pure range-editing helpers. A hand set to `null` is removed: it becomes "not provided",
 * never an implicit fold.
 */
export function paintHands(spot: RangeSpot, hands: readonly HandClass[], actionId: string | null): RangeSpot {
  if (actionId !== null && !spot.actions.some((a) => a.id === actionId)) throw new Error(`Unknown action "${actionId}"`);
  const next = { ...spot.hands };
  for (const h of hands) {
    if (actionId === null) delete next[h];
    else next[h] = { [actionId]: 1 };
  }
  return { ...spot, hands: next };
}

/** Sets every hand that is not provided yet; provided hands are left untouched. */
export function fillMissing(spot: RangeSpot, actionId: string): RangeSpot {
  return paintHands(spot, ALL_HANDS.filter((h) => !spot.hands[h]), actionId);
}

export function clearAll(spot: RangeSpot): RangeSpot {
  return { ...spot, hands: {} };
}

/** Slug id that does not collide with existing ids. */
export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'spot';
  if (!taken.has(slug)) return slug;
  for (let i = 2; ; i++) if (!taken.has(`${slug}-${i}`)) return `${slug}-${i}`;
}

/**
 * Editable copy owned by the user. Editing a demo or pack spot never keeps its status:
 * the copy is a user source, unverified, detached from the pack, so altered data cannot pass for the original.
 */
export function userCopy(spot: RangeSpot, taken: ReadonlySet<string>): RangeSpot {
  const name = spot.name.replace(/^\[D[EÉ]MO\]\s*/, '');
  const { pack: _pack, ...rest } = structuredClone(spot);
  return {
    ...rest,
    id: uniqueId(`my-${name}`, taken),
    name: `${name} (my range)`,
    source: { kind: 'user', name: 'My range', proprietary: false },
    verification: 'unverified',
    notes: undefined,
  };
}

/** Can this spot be edited in place? Demo and pack spots are always copied first. */
export function editableInPlace(spot: RangeSpot): boolean {
  return !isDemoSpot(spot) && !spot.pack;
}
