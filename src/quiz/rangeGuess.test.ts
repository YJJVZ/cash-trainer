import { describe, expect, it } from 'vitest';
import { seededRng } from '../engine/random';
import { BUNDLED_SPOTS } from '../ranges/bundled';
import { drawGuessSpot, guessableSpots, observerSpot, playedHands, rangePct, scoreGuess } from './rangeGuess';

const byHero = (hero: string) => guessableSpots(BUNDLED_SPOTS).find((s) => s.hero === hero)!;

describe('read the range', () => {
  it('only offers complete RFI spots, filtered by position', () => {
    expect(guessableSpots(BUNDLED_SPOTS).map((s) => s.hero).sort()).toEqual(['BTN', 'CO', 'HJ', 'SB', 'UTG']);
    expect(guessableSpots(BUNDLED_SPOTS, ['CO']).map((s) => s.hero)).toEqual(['CO']);
  });

  it('the SB range is its raising range, limps excluded', () => {
    const sb = playedHands(byHero('SB'));
    expect(sb.has('AA')).toBe(true); // raise
    expect(sb.has('K9o')).toBe(false); // limp
    expect(sb.has('72o')).toBe(false);
  });

  it('the table is seen from the BB, after the villain open and folds behind', () => {
    const t = observerSpot(byHero('CO'));
    expect(t.hero).toBe('BB');
    expect(t.history.map((h) => `${h.position}:${h.kind}`)).toEqual(['UTG:fold', 'HJ:fold', 'CO:raise', 'BTN:fold', 'SB:fold']);
    expect(t.history[2]!.sizeBb).toBe(2.5);
  });

  it('a perfect guess scores 1', () => {
    const spot = byHero('UTG');
    const r = scoreGuess(spot, playedHands(spot));
    expect(r.match).toBe(1);
    expect(r.missedCombos + r.extraCombos).toBe(0);
    expect(r.guessedPct).toBeCloseTo(r.actualPct);
  });

  it('counts missed and extra hands in combos', () => {
    const spot = byHero('UTG');
    const guess = new Set(playedHands(spot));
    guess.delete('AA'); // 6 combos missed
    guess.add('72o'); // 12 combos extra
    const r = scoreGuess(spot, guess);
    expect(r.cells.AA).toBe('missed');
    expect(r.cells['72o']).toBe('extra');
    expect(r.cells.KK).toBe('hit');
    expect(r.cells['32o']).toBe('fold');
    expect(r.missedCombos).toBe(6);
    expect(r.extraCombos).toBe(12);
    expect(r.match).toBeCloseTo(r.hitCombos / (r.hitCombos + 18));
  });

  it('an empty guess scores 0', () => {
    expect(scoreGuess(byHero('BTN'), new Set()).match).toBe(0);
    expect(rangePct(new Set(['AA']))).toBeCloseTo(6 / 1326);
  });

  it('does not repeat the previous spot when another exists', () => {
    const spots = guessableSpots(BUNDLED_SPOTS);
    const rng = seededRng(4);
    for (let i = 0; i < 50; i++) expect(drawGuessSpot(spots, rng, spots[0]!.id).id).not.toBe(spots[0]!.id);
  });
});
