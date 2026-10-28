import { describe, expect, it } from 'vitest';
import { ALL_HANDS } from '../engine/hands';
import { checkConsistency } from './consistency';
import { DEMO_SPOTS } from './demo/demoRanges';
import { analyzeSpot } from './analysis';
import { exportCsv, exportJson, importCsv, importJson } from './io';
import { validateLibrary, validateSpot } from './validation';
import { SCHEMA_ID, type RangeSpot } from './types';

const base = (): RangeSpot => structuredClone(DEMO_SPOTS.find((s) => s.id === 'demo-btn-rfi')!) as RangeSpot;

const userSpot = (over: Partial<RangeSpot> = {}): RangeSpot => ({
  ...base(),
  id: 'user-spot',
  name: 'User spot',
  verification: 'unverified',
  source: { kind: 'user', name: 'Me', proprietary: false },
  ...over,
});

describe('demo range', () => {
  it('all demo spots are valid', () => {
    for (const s of DEMO_SPOTS) {
      const r = validateSpot(s);
      expect(r.errors, s.id).toEqual([]);
    }
  });

  it('all demo spots are explicitly marked as fictional', () => {
    for (const s of DEMO_SPOTS) {
      expect(s.verification).toBe('demo');
      expect(s.source.kind).toBe('demo');
      expect(s.name).toMatch(/DEMO/);
      expect(s.source.name.toLowerCase()).toContain('fictional');
    }
  });

  it('demo ids are unique', () => {
    expect(new Set(DEMO_SPOTS.map((s) => s.id)).size).toBe(DEMO_SPOTS.length);
  });
});

describe('spot validation', () => {
  it('accepts a complete spot', () => {
    const r = validateSpot(userSpot());
    expect(r.errors).toEqual([]);
    expect(r.spot).not.toBeNull();
  });

  it('a missing hand is NOT converted into a fold', () => {
    const s = userSpot();
    delete s.hands['72o'];
    const r = validateSpot(s);
    expect(r.errors).toEqual([]);
    expect(r.spot!.hands['72o']).toBeUndefined();
    expect(r.warnings.some((w) => w.path === 'hands' && /not provided/.test(w.message))).toBe(true);
    const a = analyzeSpot(r.spot!);
    expect(a.missingHands).toEqual(['72o']);
    expect(a.missingCombos).toBe(12);
    expect(a.definedCombos + a.missingCombos).toBe(1326);
  });

  it('rejects a spot with no hands', () => {
    expect(validateSpot(userSpot({ hands: {} })).spot).toBeNull();
  });

  it('rejects frequencies not summing to 1', () => {
    const s = userSpot();
    s.hands.AA = { raise: 0.6 };
    const r = validateSpot(s);
    expect(r.spot).toBeNull();
    expect(r.errors[0]!.path).toBe('hands.AA');
  });

  it('rejects a frequency outside [0, 1]', () => {
    const s = userSpot({ mode: 'pro' });
    s.hands.AA = { raise: 1.5, fold: -0.5 };
    expect(validateSpot(s).spot).toBeNull();
  });

  it('rejects an undeclared action', () => {
    const s = userSpot();
    s.hands.AA = { '3bet': 1 };
    expect(validateSpot(s).errors.some((e) => /not declared/.test(e.message))).toBe(true);
  });

  it('rejects an unknown hand', () => {
    const s = userSpot();
    (s.hands as Record<string, unknown>)['KAs'] = { raise: 1 };
    expect(validateSpot(s).errors.some((e) => e.path === 'hands.KAs')).toBe(true);
  });

  it('rejects mixed frequencies in standard mode but accepts them in pro mode', () => {
    const s = userSpot();
    s.hands.A5s = { raise: 0.5, fold: 0.5 };
    expect(validateSpot(s).spot).toBeNull();
    expect(validateSpot({ ...s, mode: 'pro' }).spot).not.toBeNull();
  });

  it('requires metadata: format, sizing, rake, source', () => {
    for (const key of ['format', 'sizing', 'rake', 'source', 'history', 'verification'] as const) {
      const s = userSpot() as unknown as Record<string, unknown>;
      delete s[key];
      expect(validateSpot(s).spot, key).toBeNull();
    }
  });

  it('requires an explicit rake cap (null if unknown, with a warning)', () => {
    const s = userSpot();
    s.rake = { ...s.rake, capBb: undefined as unknown as null };
    expect(validateSpot(s).spot).toBeNull();
    const r = validateSpot(userSpot({ rake: { ...s.rake, capBb: null } }));
    expect(r.warnings.some((w) => w.path === 'rake.capBb')).toBe(true);
  });

  it('forbids marking a demo source as verified', () => {
    expect(validateSpot({ ...base(), verification: 'verified' }).spot).toBeNull();
    expect(validateSpot({ ...userSpot(), verification: 'demo' }).spot).toBeNull();
  });

  it('rejects hero among villains and invalid positions', () => {
    expect(validateSpot(userSpot({ villains: ['BTN'] })).spot).toBeNull();
    expect(validateSpot({ ...userSpot(), hero: 'MP' }).spot).toBeNull();
  });

  it('warns about unusual depth or format', () => {
    const r = validateSpot(userSpot({ format: { ...base().format, stackBb: 40 } }));
    expect(r.spot).not.toBeNull();
    expect(r.warnings.some((w) => w.path === 'format.stackBb')).toBe(true);
  });
});

describe('library', () => {
  it('flags proprietary ranges without authorization', () => {
    const lib = {
      schema: SCHEMA_ID,
      spots: [userSpot({ source: { kind: 'coach', name: 'Coach X', proprietary: true } })],
    };
    expect(validateLibrary(lib).needsAuthorization).toEqual(['user-spot']);
    lib.spots[0]!.source.authorizedByUser = true;
    expect(validateLibrary(lib).needsAuthorization).toEqual([]);
  });

  it('rejects duplicate ids and a wrong schema', () => {
    expect(validateLibrary({ schema: SCHEMA_ID, spots: [userSpot(), userSpot()] }).errors.length).toBeGreaterThan(0);
    expect(validateLibrary({ schema: 'autre', spots: [] }).errors.length).toBeGreaterThan(0);
  });
});

describe('import / export', () => {
  it('lossless JSON round trip', () => {
    const r = importJson(exportJson([...DEMO_SPOTS]));
    expect(r.errors).toEqual([]);
    expect(r.spots).toEqual(DEMO_SPOTS);
  });

  it('unreadable JSON → clear error', () => {
    expect(importJson('{not json').errors[0]!.message).toMatch(/Invalid JSON/);
  });

  it('lossless CSV round trip, including missing hands', () => {
    const s = structuredClone(DEMO_SPOTS.find((x) => x.id === 'demo-btn-vs-bb-3bet')!) as RangeSpot;
    const r = importCsv(exportCsv(s));
    expect(r.errors).toEqual([]);
    expect(r.spot).toEqual(s);
    expect(Object.keys(r.spot!.hands).length).toBeLessThan(ALL_HANDS.length);
  });

  it('CSV: empty row = not provided, empty cell = 0', () => {
    const s = base();
    const csv = exportCsv(s).replace(/\n72o,[^\n]*/, '\n72o,,').replace(/\nAA,0,1/, '\nAA,,1');
    const r = importCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.spot!.hands['72o']).toBeUndefined();
    expect(r.spot!.hands.AA).toEqual({ raise: 1 });
  });

  it('CSV: accepts semicolons and decimal commas', () => {
    const s = structuredClone(DEMO_SPOTS.find((x) => x.mode === 'pro')!) as RangeSpot;
    const csv = exportCsv(s)
      .split('\n')
      .map((l) => (l.startsWith('#meta') ? l.replace(/^#meta,/, '#meta;') : l.replace(/,/g, ';').replace(/(\d)\.(\d)/g, '$1,$2')))
      .join('\n');
    const r = importCsv(csv);
    expect(r.errors).toEqual([]);
    expect(Object.keys(r.spot!.hands)).toHaveLength(Object.keys(s.hands).length);
  });

  it('CSV without metadata → rejected', () => {
    const r = importCsv('hand,fold,raise\nAA,0,1\n');
    expect(r.spot).toBeNull();
    expect(r.errors[0]!.message).toMatch(/#meta/);
  });

  it('CSV: unreadable or duplicate hand → rejected', () => {
    const csv = exportCsv(base());
    expect(importCsv(csv + 'ZZ,0,1\n').spot).toBeNull();
    expect(importCsv(csv + 'AA,0,1\n').spot).toBeNull();
  });
});

describe('cross-spot consistency', () => {
  it('no warning for the demo alone', () => {
    expect(checkConsistency([...DEMO_SPOTS])).toEqual([]);
  });

  it('flags different sizings, rakes and depths', () => {
    const other = userSpot({
      sizing: { profileId: 'autre', rfiBb: 2.2 },
      rake: { modelId: 'zoom', percent: 4.5, capBb: 3, noFlopNoDrop: true },
      format: { ...base().format, stackBb: 200 },
    });
    const kinds = checkConsistency([base(), other]).map((w) => w.kind);
    expect(kinds).toEqual(expect.arrayContaining(['sizing', 'rake', 'stack', 'demo-mix']));
  });
});
