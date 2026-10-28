import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALL_HANDS } from '../engine/hands';
import { csvToHands, diffPacks, formatCheck, mergeCsvIntoPack } from './packTools';

const template = JSON.parse(readFileSync(new URL('../../data/ranges/templates/rfi-pack.template.json', import.meta.url), 'utf8'));
const csvTemplate = readFileSync(new URL('../../data/ranges/templates/rfi-utg.template.csv', import.meta.url), 'utf8');

/* TEST FIXTURE ONLY: synthetic values to exercise the tooling, not a range. */
const fixtureCsv = (fill: (hand: string) => string) =>
  ['hand,fold,raise', ...ALL_HANDS.map((h) => `${h},${fill(h)}`)].join('\n');

describe('csvToHands', () => {
  it('the empty template yields no hands at all (nothing is invented)', () => {
    const r = csvToHands(csvTemplate);
    expect(r.errors).toEqual([]);
    expect(r.hands).toEqual({});
  });

  it('empty row = not provided, empty cell = 0, semicolons and decimal commas accepted', () => {
    const r = csvToHands('hand;fold;raise\nAA;;1\nKK;0,4;0,6\nQQ;;\n');
    expect(r.errors).toEqual([]);
    expect(r.hands).toEqual({ AA: { raise: 1 }, KK: { fold: 0.4, raise: 0.6 } });
  });

  it('a row of zeros is an error (leave it empty when unknown)', () => {
    expect(csvToHands('hand,fold,raise\nAA,0,0\n').errors[0]!.message).toMatch(/all frequencies are 0/);
  });

  it('rejects unreadable and duplicate hands', () => {
    expect(csvToHands('hand,fold,raise\nZZ,1,\n').errors).toHaveLength(1);
    expect(csvToHands('hand,fold,raise\nAA,,1\nAA,,1\n').errors).toHaveLength(1);
  });
});

describe('merge, check, diff', () => {
  const tables = Object.fromEntries(
    ['utg', 'hj', 'co', 'btn', 'sb'].map((p) => [`rfi-${p}`, fixtureCsv((h) => (h.length === 2 ? '0,1' : '1,0'))]),
  );

  it('merging all five CSVs into the template produces a valid pack', () => {
    const { pack, errors } = mergeCsvIntoPack(template, tables);
    expect(errors).toEqual([]);
    const r = formatCheck(pack);
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/rfi-utg: 169\/169 hands/);
    expect(r.text).toMatch(/Target fit: Some source parameters are unknown/);
    expect(template.spots[0].hands).toEqual({}); // input not mutated
  });

  it('a pack can hold a single position: spots without a table are left out', () => {
    const { pack, errors } = mergeCsvIntoPack(template, { 'rfi-utg': tables['rfi-utg']! });
    expect(errors).toEqual([]);
    expect((pack as { spots: { id: string }[] }).spots.map((s) => s.id)).toEqual(['rfi-utg']);
    expect(formatCheck(pack).ok).toBe(true);
  });

  it('the SB limp action is kept only when the table uses it', () => {
    const sbIds = (csv: string) =>
      (mergeCsvIntoPack(template, { 'rfi-sb': csv }).pack as { spots: { actions: { id: string }[] }[] }).spots[0]!.actions.map((a) => a.id);
    const withLimp = ['hand,fold,limp,raise', ...ALL_HANDS.map((h) => `${h},${h.length === 2 ? ',1,' : '1,,'}`)].join('\n');
    const noLimp = ['hand,fold,limp,raise', ...ALL_HANDS.map((h) => `${h},${h.length === 2 ? ',,1' : '1,,'}`)].join('\n');
    expect(sbIds(withLimp)).toEqual(['fold', 'limp', 'raise']);
    expect(sbIds(noLimp)).toEqual(['fold', 'raise']);
    expect(formatCheck(mergeCsvIntoPack(template, { 'rfi-sb': withLimp }).pack).ok).toBe(true);
  });

  it('unknown spot ids are reported', () => {
    expect(mergeCsvIntoPack(template, { nope: fixtureCsv(() => '1,0') }).errors[0]!.path).toBe('nope');
  });

  it('the check of the raw template fails because no hands are provided', () => {
    const r = formatCheck(template);
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/no hands provided/);
  });

  it('diff lists hand-level changes', () => {
    const a = mergeCsvIntoPack(template, tables).pack;
    const b = structuredClone(a) as { spots: { hands: Record<string, unknown> }[] };
    b.spots[0]!.hands.AA = { fold: 1 };
    delete b.spots[1]!.hands['72o'];
    const d = diffPacks(a, b);
    expect(d).toEqual([
      { spotId: 'rfi-utg', hand: 'AA', before: 'raise:1', after: 'fold:1' },
      { spotId: 'rfi-hj', hand: '72o', before: 'fold:1', after: 'not provided' },
    ]);
  });
});
