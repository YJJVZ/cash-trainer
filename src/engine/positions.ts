export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export type Position = (typeof POSITIONS)[number];

export function isPosition(value: unknown): value is Position {
  return typeof value === 'string' && (POSITIONS as readonly string[]).includes(value);
}

/** Preflop action order (6-max): UTG acts first, BB last. */
export function preflopOrder(p: Position): number {
  return POSITIONS.indexOf(p);
}

export const POSITION_NAMES: Record<Position, string> = {
  UTG: 'Under the Gun',
  HJ: 'Hijack',
  CO: 'Cutoff',
  BTN: 'Button',
  SB: 'Small Blind',
  BB: 'Big Blind',
};

/** Is hero in position postflop against villain? (BTN > CO > HJ > UTG > BB > SB) */
export function isInPositionPostflop(hero: Position, villain: Position): boolean {
  const postflop: Position[] = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];
  return postflop.indexOf(hero) > postflop.indexOf(villain);
}
