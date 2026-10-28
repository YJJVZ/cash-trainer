import type { HandClass } from '../engine/hands';
import type { ActionOption, HandMap, Strategy } from './types';

const EPS = 1e-9;

/**
 * Standard-mode simplification of a (possibly mixed) strategy:
 * the highest-frequency action wins; ties are broken deterministically by `order`
 * (the first listed action wins). Original frequencies are never modified.
 */
export function majorityAction(s: Strategy, order: readonly string[]): string {
  const entries = Object.entries(s).filter(([, f]) => f > 0);
  if (entries.length === 0) throw new Error('Empty strategy');
  const max = Math.max(...entries.map(([, f]) => f));
  const tied = entries.filter(([, f]) => Math.abs(f - max) < EPS).map(([id]) => id);
  if (tied.length === 1) return tied[0]!;
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...tied].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0]!;
}

export interface StandardDerivation {
  hands: HandMap;
  /** Hands whose source strategy had more than one action. */
  simplified: HandClass[];
}

export function deriveStandard(source: HandMap, actions: readonly ActionOption[], tieBreak: readonly string[] | null): StandardDerivation {
  const order = tieBreak && tieBreak.length ? tieBreak : actions.map((a) => a.id);
  const hands: HandMap = {};
  const simplified: HandClass[] = [];
  for (const [hand, s] of Object.entries(source)) {
    if (!s) continue;
    if (Object.values(s).filter((f) => f > 0).length > 1) simplified.push(hand);
    hands[hand] = { [majorityAction(s, order)]: 1 };
  }
  return { hands, simplified };
}
