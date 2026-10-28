import type { ActionOption, HistoryAction, RangeSpot } from './types';

const fmtBb = (x: number) => `${x} BB`;

export function describeHistoryAction(h: HistoryAction, raiseIndex: number): string {
  switch (h.kind) {
    case 'fold':
      return `${h.position} fold`;
    case 'limp':
      return `${h.position} limp`;
    case 'call':
      return `${h.position} call`;
    case 'check':
      return `${h.position} check`;
    case 'allin':
      return `${h.position} all-in`;
    case 'raise': {
      const name = raiseIndex === 0 ? 'open' : `${raiseIndex + 2}-bet`;
      return `${h.position} ${name}${h.sizeBb ? ` ${fmtBb(h.sizeBb)}` : ''}`;
    }
  }
}

/** Readable history: "UTG fold · HJ fold · CO open 2.5 BB". */
export function describeHistory(history: HistoryAction[]): string[] {
  let raises = 0;
  return history.map((h) => {
    const text = describeHistoryAction(h, raises);
    if (h.kind === 'raise') raises++;
    return text;
  });
}

export function describeSituation(spot: RangeSpot): string {
  const acted = describeHistory(spot.history).filter((t) => !t.endsWith(' fold'));
  const before = acted.length ? acted.join(', ') : spot.history.length ? 'folded to you' : 'first to act';
  return `${before} — you are ${spot.hero}`;
}

/** Spot name without the demo prefix (also handles records saved before translation). */
export function shortName(name: string): string {
  return name.replace(/^\[D[E\u00c9]MO\]\s*/, '');
}

export function actionLabel(spot: RangeSpot, id: string): string {
  return spot.actions.find((a) => a.id === id)?.label ?? id;
}

export function findAction(spot: RangeSpot, id: string): ActionOption | undefined {
  return spot.actions.find((a) => a.id === id);
}

/** Pot before hero acts (blinds + bets), in BB. */
export function potBeforeHero(spot: RangeSpot): number {
  const committed: Record<string, number> = { SB: 0.5, BB: 1 };
  for (const h of spot.history) {
    if (h.kind === 'raise' || h.kind === 'allin' || h.kind === 'limp' || h.kind === 'call') {
      committed[h.position] = h.sizeBb ?? committed[h.position] ?? 0;
    }
  }
  return Object.values(committed).reduce((s, v) => s + v, 0);
}
