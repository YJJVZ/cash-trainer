import { describe, expect, it } from 'vitest';
import { DEMO_SPOTS } from './demo/demoRanges';
import { clearAll, editableInPlace, fillMissing, paintHands, uniqueId, userCopy } from './edit';
import { analyzeSpot } from './analysis';
import { validateSpot } from './validation';

const demo = DEMO_SPOTS.find((s) => s.id === 'demo-btn-rfi')!;

describe('range editing', () => {
  it('paints hands with a single action', () => {
    const s = paintHands(demo, ['72o', 'AA'], 'raise');
    expect(s.hands['72o']).toEqual({ raise: 1 });
    expect(s.hands.AA).toEqual({ raise: 1 });
    expect(demo.hands['72o']).toEqual({ fold: 1 }); // original untouched
  });

  it('erasing makes a hand "not provided", never a fold', () => {
    const s = paintHands(demo, ['72o'], null);
    expect(s.hands['72o']).toBeUndefined();
    expect(analyzeSpot(s).missingHands).toEqual(['72o']);
  });

  it('rejects an unknown action', () => {
    expect(() => paintHands(demo, ['AA'], 'call')).toThrow(/Unknown action/);
  });

  it('fills only missing hands', () => {
    const s = fillMissing(paintHands(clearAll(demo), ['AA'], 'raise'), 'fold');
    expect(s.hands.AA).toEqual({ raise: 1 });
    expect(s.hands['72o']).toEqual({ fold: 1 });
    expect(analyzeSpot(s).missingHands).toHaveLength(0);
  });

  it('a copy of a demo spot is a user, unverified, valid spot with a fresh id', () => {
    const taken = new Set(DEMO_SPOTS.map((s) => s.id));
    const c = userCopy(demo, taken);
    expect(c.id).not.toBe(demo.id);
    expect(taken.has(c.id)).toBe(false);
    expect(c.verification).toBe('unverified');
    expect(c.source.kind).toBe('user');
    expect(c.name).not.toMatch(/DEMO/);
    expect(validateSpot(c).errors).toEqual([]);
    expect(editableInPlace(demo)).toBe(false);
    expect(editableInPlace(c)).toBe(true);
  });

  it('generates non-colliding ids', () => {
    expect(uniqueId('My BTN!', new Set())).toBe('my-btn');
    expect(uniqueId('my btn', new Set(['my-btn', 'my-btn-2']))).toBe('my-btn-3');
  });
});
