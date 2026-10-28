import { describe, expect, it } from 'vitest';
import { fullDeck, cardToString, parseCard } from './cards';
import {
  ALL_HANDS, GRID, TOTAL_COMBOS, allCombos, combosOf, gridPosition, handAt, handClassOf, handKind, isHandClass, normalizeHand,
} from './hands';

describe('13×13 grid', () => {
  it('has 13 rows of 13 cells', () => {
    expect(GRID).toHaveLength(13);
    for (const row of GRID) expect(row).toHaveLength(13);
  });

  it('contains 169 unique hands', () => {
    expect(ALL_HANDS).toHaveLength(169);
    expect(new Set(ALL_HANDS).size).toBe(169);
  });

  it('counts 13 pairs, 78 suited and 78 offsuit', () => {
    const kinds = ALL_HANDS.map(handKind);
    expect(kinds.filter((k) => k === 'pair')).toHaveLength(13);
    expect(kinds.filter((k) => k === 'suited')).toHaveLength(78);
    expect(kinds.filter((k) => k === 'offsuit')).toHaveLength(78);
  });

  it('puts pairs on the diagonal, suited above, offsuit below', () => {
    for (const row of GRID)
      for (const cell of row) {
        if (cell.row === cell.col) expect(cell.kind).toBe('pair');
        else if (cell.col > cell.row) expect(cell.kind).toBe('suited');
        else expect(cell.kind).toBe('offsuit');
      }
  });

  it('matches the expected corners', () => {
    expect(handAt(0, 0)).toBe('AA');
    expect(handAt(0, 1)).toBe('AKs');
    expect(handAt(1, 0)).toBe('AKo');
    expect(handAt(12, 12)).toBe('22');
    expect(handAt(0, 12)).toBe('A2s');
    expect(handAt(12, 0)).toBe('A2o');
    expect(handAt(11, 12)).toBe('32s');
  });

  it('gridPosition is the inverse of handAt', () => {
    for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) expect(gridPosition(handAt(r, c))).toEqual({ row: r, col: c });
  });

  it('rejects cells outside the grid', () => {
    expect(() => handAt(13, 0)).toThrow();
  });
});

describe('1,326 combos', () => {
  const combos = allCombos();

  it('generates exactly 1,326 combos', () => {
    expect(combos).toHaveLength(TOTAL_COMBOS);
    expect(TOTAL_COMBOS).toBe(1326);
  });

  it('combos are unique (regardless of card order)', () => {
    const keys = combos.map(([a, b]) => [cardToString(a), cardToString(b)].sort().join(''));
    expect(new Set(keys).size).toBe(1326);
  });

  it('matches C(52, 2) distinct card pairs from the deck', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    let n = 0;
    for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) n++;
    expect(n).toBe(combos.length);
  });

  it('6 combos per pair, 4 per suited, 12 per offsuit', () => {
    expect(combosOf('AA')).toHaveLength(6);
    expect(combosOf('AKs')).toHaveLength(4);
    expect(combosOf('AKo')).toHaveLength(12);
  });

  it('every combo maps to its class, in any order', () => {
    for (const hand of ALL_HANDS)
      for (const [a, b] of combosOf(hand)) {
        expect(handClassOf(a, b)).toBe(hand);
        expect(handClassOf(b, a)).toBe(hand);
      }
  });

  it('no combo contains the same card twice', () => {
    for (const [a, b] of combos) expect(cardToString(a)).not.toBe(cardToString(b));
    expect(() => handClassOf(parseCard('As'), parseCard('As'))).toThrow();
  });
});

describe('hand notation', () => {
  it('normalizes input', () => {
    expect(normalizeHand('kas')).toBe('AKs');
    expect(normalizeHand('AK o')).toBe('AKo');
    expect(normalizeHand('tt')).toBe('TT');
    expect(normalizeHand('AK')).toBeNull();
    expect(normalizeHand('AAs')).toBeNull();
    expect(normalizeHand('1Ks')).toBeNull();
  });

  it('recognizes valid classes', () => {
    expect(isHandClass('AKs')).toBe(true);
    expect(isHandClass('KAs')).toBe(false);
    expect(isHandClass('AKx')).toBe(false);
  });
});
