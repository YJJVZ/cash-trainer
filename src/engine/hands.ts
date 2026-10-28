import { RANKS, SUITS, rankIndex, isRank, type Card, type Rank } from './cards';

/** One of the 169 starting-hand classes: "AA", "AKs", "AKo"… */
export type HandClass = string;

export type HandKind = 'pair' | 'suited' | 'offsuit';

export interface GridCell {
  hand: HandClass;
  row: number;
  col: number;
  kind: HandKind;
  combos: number;
}

/**
 * Standard grid convention:
 * - diagonal: pairs;
 * - above the diagonal (col > row): suited;
 * - below (row > col): offsuit.
 */
export function handAt(row: number, col: number): HandClass {
  const r1 = RANKS[row];
  const r2 = RANKS[col];
  if (r1 === undefined || r2 === undefined) throw new Error(`Cell outside grid: ${row},${col}`);
  if (row === col) return `${r1}${r2}`;
  return row < col ? `${r1}${r2}s` : `${r2}${r1}o`;
}

export function handKind(hand: HandClass): HandKind {
  if (hand.length === 2) return 'pair';
  return hand.endsWith('s') ? 'suited' : 'offsuit';
}

export function combosPerKind(kind: HandKind): number {
  return kind === 'pair' ? 6 : kind === 'suited' ? 4 : 12;
}

export function buildGrid(): GridCell[][] {
  return RANKS.map((_, row) =>
    RANKS.map((__, col) => {
      const hand = handAt(row, col);
      const kind = handKind(hand);
      return { hand, row, col, kind, combos: combosPerKind(kind) };
    }),
  );
}

export const GRID: readonly (readonly GridCell[])[] = buildGrid();

/** The 169 classes in grid reading order. */
export const ALL_HANDS: readonly HandClass[] = GRID.flat().map((c) => c.hand);

const HAND_SET = new Set(ALL_HANDS);

export function isHandClass(value: string): value is HandClass {
  return HAND_SET.has(value);
}

/** Normalizes user input ("kas", "KAs", "AK s") to canonical notation. */
export function normalizeHand(input: string): HandClass | null {
  const t = input.replace(/\s+/g, '');
  if (t.length < 2 || t.length > 3) return null;
  const a = t[0]!.toUpperCase();
  const b = t[1]!.toUpperCase();
  const suffix = t[2]?.toLowerCase() ?? '';
  if (!isRank(a) || !isRank(b)) return null;
  if (a === b) return suffix === '' ? `${a}${b}` : null;
  if (suffix !== 's' && suffix !== 'o') return null;
  const [hi, lo] = rankIndex(a) < rankIndex(b) ? [a, b] : [b, a];
  return `${hi}${lo}${suffix}`;
}

export function gridPosition(hand: HandClass): { row: number; col: number } {
  const r1 = rankIndex(hand[0] as Rank);
  const r2 = rankIndex(hand[1] as Rank);
  const kind = handKind(hand);
  if (kind === 'pair') return { row: r1, col: r1 };
  return kind === 'suited' ? { row: r1, col: r2 } : { row: r2, col: r1 };
}

export type Combo = readonly [Card, Card];

/** All concrete combos of a class (6, 4 or 12). */
export function combosOf(hand: HandClass): Combo[] {
  const r1 = hand[0] as Rank;
  const r2 = hand[1] as Rank;
  const kind = handKind(hand);
  const out: Combo[] = [];
  if (kind === 'pair') {
    for (let i = 0; i < SUITS.length; i++)
      for (let j = i + 1; j < SUITS.length; j++) out.push([{ rank: r1, suit: SUITS[i]! }, { rank: r1, suit: SUITS[j]! }]);
  } else if (kind === 'suited') {
    for (const s of SUITS) out.push([{ rank: r1, suit: s }, { rank: r2, suit: s }]);
  } else {
    for (const s1 of SUITS) for (const s2 of SUITS) if (s1 !== s2) out.push([{ rank: r1, suit: s1 }, { rank: r2, suit: s2 }]);
  }
  return out;
}

/** The 1,326 two-card combos. */
export function allCombos(): Combo[] {
  return ALL_HANDS.flatMap(combosOf);
}

/** Class of a concrete combo, regardless of card order. */
export function handClassOf(a: Card, b: Card): HandClass {
  if (a.rank === b.rank) {
    if (a.suit === b.suit) throw new Error('Two identical cards');
    return `${a.rank}${b.rank}`;
  }
  const [hi, lo] = rankIndex(a.rank) < rankIndex(b.rank) ? [a, b] : [b, a];
  return `${hi.rank}${lo.rank}${a.suit === b.suit ? 's' : 'o'}`;
}

export const TOTAL_COMBOS = 1326;
