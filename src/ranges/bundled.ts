import estimatePack from '../../data/ranges/packs/estimate-6max-100bb.json';
import { validatePackFile } from './pack';
import type { RangeSpot } from './types';

/**
 * Default ranges shipped with the app: ESTIMATED 6-max 100 BB strategies
 * (built by scripts/build-estimate-pack.mjs). Not solver output; the user may delete
 * them or import their own packs, which then take precedence in training.
 */
const bundled = validatePackFile(estimatePack);
if (bundled.errors.length) throw new Error(`Bundled pack is invalid: ${bundled.errors[0]!.path} ${bundled.errors[0]!.message}`);

export const BUNDLED_PACK_ID = bundled.header!.id;
export const BUNDLED_SPOTS: readonly RangeSpot[] = bundled.spots;

/** Changes whenever the bundled pack is rebuilt with a new version, so stored copies are refreshed. */
export const BUNDLED_VERSION = `${BUNDLED_PACK_ID}@${bundled.header!.version}`;

export function isBundledSpot(spot: RangeSpot): boolean {
  return spot.pack?.header.id === BUNDLED_PACK_ID;
}
