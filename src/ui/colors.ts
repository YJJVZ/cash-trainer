import { actionColor, type ActionColor } from '../engine/actions';
import type { RangeSpot, Strategy } from '../ranges/types';

const VAR: Record<ActionColor, string> = {
  fold: 'var(--color-act-fold)',
  call: 'var(--color-act-call)',
  raise: 'var(--color-act-raise)',
  limp: 'var(--color-act-limp)',
};

/** Color of each spot action; a second raise (e.g. 4-bet + all-in) gets a darker red. */
export function spotColors(spot: RangeSpot): Record<string, string> {
  const out: Record<string, string> = {};
  let raises = 0;
  for (const a of spot.actions) {
    const group = actionColor(a.kind);
    out[a.id] = group === 'raise' && raises++ > 0 ? 'var(--color-act-raise-2)' : VAR[group];
  }
  return out;
}

/** Cell background: solid color, or proportional bands for a mixed strategy. */
export function strategyBackground(spot: RangeSpot, s: Strategy, colors = spotColors(spot)): string {
  // Most aggressive actions on the left (solver convention): reverse declaration order.
  const parts = [...spot.actions].reverse().map((a) => [a.id, s[a.id] ?? 0] as const).filter(([, f]) => f > 0);
  if (parts.length === 1) return colors[parts[0]![0]]!;
  let acc = 0;
  const stops = parts.map(([id, f]) => {
    const from = acc * 100;
    acc += f;
    return `${colors[id]} ${from.toFixed(2)}% ${(acc * 100).toFixed(2)}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
