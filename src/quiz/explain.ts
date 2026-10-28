import { GRID, gridPosition, handKind, type HandClass } from '../engine/hands';
import { analyzeSpot, formatPercent, topActions } from '../ranges/analysis';
import { actionLabel, describeSituation } from '../ranges/describe';
import { VERIFICATION_LABELS, type RangeSpot, type Strategy } from '../ranges/types';
import type { Evaluation } from './engine';

export function strategyText(spot: RangeSpot, s: Strategy): string {
  return Object.entries(s)
    .filter(([, f]) => f > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, f]) => (f === 1 ? actionLabel(spot, id) : `${actionLabel(spot, id)} ${formatPercent(f, 0)}`))
    .join(' · ');
}

/** Neighbouring hands (next kicker up / down, or adjacent pair). */
export function neighbours(hand: HandClass): { stronger?: HandClass; weaker?: HandClass } {
  const { row, col } = gridPosition(hand);
  const at = (r: number, c: number) => GRID[r]?.[c]?.hand;
  switch (handKind(hand)) {
    case 'pair':
      return { stronger: at(row - 1, col - 1), weaker: at(row + 1, col + 1) };
    case 'suited':
      return { stronger: col - 1 > row ? at(row, col - 1) : undefined, weaker: at(row, col + 1) };
    case 'offsuit':
      return { stronger: row - 1 > col ? at(row - 1, col) : undefined, weaker: at(row + 1, col) };
  }
}

/**
 * Explanation built only from the spot data:
 * no theoretical justification is invented.
 */
export function explain(spot: RangeSpot, hand: HandClass, ev: Evaluation): string[] {
  const lines: string[] = [];
  lines.push(`Situation: ${describeSituation(spot)}, holding ${hand}.`);
  lines.push(`Range answer: ${strategyText(spot, ev.strategy)}.`);
  if (ev.verdict !== 'correct') {
    lines.push(
      ev.chosenFrequency > 0
        ? `Your choice (${actionLabel(spot, ev.chosen)}) is played ${formatPercent(ev.chosenFrequency, 0)} of the time: it is not the main action.`
        : `Your choice (${actionLabel(spot, ev.chosen)}) is never played with this hand in this spot.`,
    );
  }

  const best = ev.bestActions[0];
  const { stronger, weaker } = neighbours(hand);
  for (const [n, word] of [[weaker, 'weaker'], [stronger, 'stronger']] as const) {
    const ns = n ? spot.hands[n] : undefined;
    if (n && ns && best && !topActions(ns).includes(best)) {
      lines.push(`Borderline hand: the next ${word} hand ${n} plays ${strategyText(spot, ns)}.`);
    }
  }

  const a = analyzeSpot(spot);
  const parts = spot.actions
    .map((act) => `${act.label} ${formatPercent((a.combosByAction[act.id] ?? 0) / a.definedCombos)}`)
    .join(', ');
  lines.push(`Range breakdown (${a.definedCombos} combos provided): ${parts}.`);
  lines.push(`Source: ${spot.source.name} — ${VERIFICATION_LABELS[spot.verification]}.`);
  return lines;
}
