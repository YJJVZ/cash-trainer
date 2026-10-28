import { ALL_HANDS, combosPerKind, handKind, TOTAL_COMBOS, type HandClass } from '../engine/hands';
import type { RangeSpot, Strategy } from './types';

export interface RangeBreakdown {
  /** Combos (frequency-weighted) per action, over provided hands. */
  combosByAction: Record<string, number>;
  definedCombos: number;
  missingCombos: number;
  definedHands: number;
  missingHands: HandClass[];
  isMixed: boolean;
}

export function isMixedStrategy(s: Strategy): boolean {
  return Object.values(s).filter((f) => f > 0 && f < 1).length > 0;
}

export function analyzeSpot(spot: RangeSpot): RangeBreakdown {
  const combosByAction: Record<string, number> = Object.fromEntries(spot.actions.map((a) => [a.id, 0]));
  const missingHands: HandClass[] = [];
  let definedCombos = 0;
  let isMixed = false;
  for (const hand of ALL_HANDS) {
    const strat = spot.hands[hand];
    const n = combosPerKind(handKind(hand));
    if (!strat) {
      missingHands.push(hand);
      continue;
    }
    definedCombos += n;
    if (isMixedStrategy(strat)) isMixed = true;
    for (const [id, f] of Object.entries(strat)) combosByAction[id] = (combosByAction[id] ?? 0) + f * n;
  }
  return {
    combosByAction,
    definedCombos,
    missingCombos: TOTAL_COMBOS - definedCombos,
    definedHands: ALL_HANDS.length - missingHands.length,
    missingHands,
    isMixed,
  };
}

/** Highest-frequency actions (several when tied). */
export function topActions(s: Strategy): string[] {
  const max = Math.max(...Object.values(s));
  return Object.entries(s)
    .filter(([, f]) => Math.abs(f - max) < 1e-9 && f > 0)
    .map(([id]) => id);
}

export function formatPercent(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}
