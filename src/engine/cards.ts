/** Ranks from strongest to weakest: row/column order of the 13×13 grid. */
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export type Rank = (typeof RANKS)[number];

export const SUITS = ['s', 'h', 'd', 'c'] as const;
export type Suit = (typeof SUITS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUIT_SYMBOLS: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

/** Strength index: 0 = Ace, 12 = Deuce. */
export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}

export function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value);
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function parseCard(text: string): Card {
  const rank = text[0];
  const suit = text[1];
  if (text.length !== 2 || !rank || !suit || !isRank(rank) || !(SUITS as readonly string[]).includes(suit)) {
    throw new Error(`Invalid card: "${text}"`);
  }
  return { rank, suit: suit as Suit };
}

export function fullDeck(): Card[] {
  return RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })));
}
