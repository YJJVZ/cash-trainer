import { topActions } from '../ranges/analysis';
import { actionLabel, shortName } from '../ranges/describe';
import type { RangeSpot } from '../ranges/types';
import type { AnswerRecord } from '../stats/types';

/**
 * Display labels for a stored answer. Uses the current spot when it still exists, so
 * records saved before a rename/translation show up-to-date names.
 */
export function recordLabels(r: AnswerRecord, spot: RangeSpot | undefined) {
  const strat = spot?.hands[r.hand];
  return {
    spot: shortName(spot?.name ?? r.spotName),
    chosen: spot ? actionLabel(spot, r.chosen) : r.chosenLabel,
    expected: spot && strat ? topActions(strat).map((id) => actionLabel(spot, id)).join(' / ') : r.expectedLabel,
  };
}
