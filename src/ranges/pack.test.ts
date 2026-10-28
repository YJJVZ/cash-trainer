import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALL_HANDS, type HandClass } from '../engine/hands';
import { POSITIONS, type Position } from '../engine/positions';
import { coveredDemoIds, trainingSpots } from './coverage';
import { DEMO_SPOTS } from './demo/demoRanges';
import { editableInPlace, userCopy } from './edit';
import { exportJson, importJson } from './io';
import { exportPack, validatePackFile } from './pack';
import { majorityAction } from './standard';
import { TARGET_ENV, assessCompatibility } from './target';
import { PACK_SCHEMA_ID, type HandMap, type PackHeader } from './types';

/*
 * TEST FIXTURES ONLY. The hands below are synthetic (pairs open, everything else folds)
 * and exist solely to exercise the validator. They are not ranges and are never shipped.
 */
const allFold = (): HandMap => Object.fromEntries(ALL_HANDS.map((h) => [h, { fold: 1 }]));
const fixtureHands = (): HandMap => ({ ...allFold(), AA: { raise: 1 }, KK: { raise: 1 } });

const HEROES: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

function rfiSpot(hero: Position, hands: HandMap = fixtureHands()) {
  const i = POSITIONS.indexOf(hero);
  return {
    id: `rfi-${hero.toLowerCase()}`,
    family: 'RFI',
    hero,
    villains: POSITIONS.slice(i + 1),
    history: POSITIONS.slice(0, i).map((position) => ({ position, kind: 'fold' })),
    actions: [
      { id: 'fold', kind: 'fold', label: 'Fold' },
      hero === 'SB'
        ? { id: 'raise', kind: 'raise', label: 'Raise 3 BB', sizeBb: 3 }
        : { id: 'raise', kind: 'raise', label: 'Open 2.5 BB', sizeBb: 2.5 },
    ],
    hands,
  };
}

function header(over: Partial<PackHeader> = {}): PackHeader {
  return {
    id: 'test-pack',
    version: 1,
    name: 'Test pack (synthetic fixture)',
    format: { game: 'NLHE', tableSize: 6, stackBb: 100, tableType: null },
    sizing: { profileId: 'rfi-2.5-sb3', rfiBb: 2.5, sbRfiBb: 3 },
    sourceParameters: { site: null, stakes: null, rakePercent: null, rakeCapBb: null, noFlopNoDrop: null },
    source: { kind: 'user', name: 'Unit test', proprietary: false },
    transcription: { status: 'unchecked', checkedBy: null, checkedAt: null, method: null },
    strategy: { standardRule: 'majority', tieBreak: null },
    ...over,
  };
}

const file = (h = header(), spots: unknown[] = HEROES.map((p) => rfiSpot(p))) => ({ schema: PACK_SCHEMA_ID, pack: h, spots });
const errorPaths = (raw: unknown) => validatePackFile(raw).errors.map((e) => e.path);

describe('v2 pack: structure', () => {
  it('accepts a complete five-spot RFI pack and expands it', () => {
    const r = validatePackFile(file());
    expect(r.errors).toEqual([]);
    expect(r.spots.map((s) => s.id)).toEqual(['test-pack:rfi-utg', 'test-pack:rfi-hj', 'test-pack:rfi-co', 'test-pack:rfi-btn', 'test-pack:rfi-sb']);
    for (const s of r.spots) {
      expect(s.mode).toBe('standard');
      expect(s.verification).toBe('unverified');
      expect(s.pack?.header.id).toBe('test-pack');
      expect(Object.keys(s.hands)).toHaveLength(169);
    }
  });

  it('rejects wrong schema, missing header, empty spot list', () => {
    expect(errorPaths({ ...file(), schema: 'nl10-range-trainer/v1' })).toContain('schema');
    expect(errorPaths({ schema: PACK_SCHEMA_ID, spots: [rfiSpot('UTG')] })).toContain('pack');
    expect(errorPaths(file(header(), []))).toContain('spots');
  });

  it('spots cannot override pack-level parameters', () => {
    const spot = { ...rfiSpot('UTG'), rake: { percent: 3 } };
    expect(errorPaths(file(header(), [spot]))).toContain('spots[0].rake');
  });

  it('rejects duplicate spot ids and duplicate situations', () => {
    expect(validatePackFile(file(header(), [rfiSpot('UTG'), rfiSpot('UTG')])).errors.some((e) => /duplicate spot id/.test(e.message))).toBe(true);
    const twin = { ...rfiSpot('UTG'), id: 'other' };
    expect(validatePackFile(file(header(), [rfiSpot('UTG'), twin])).errors.some((e) => /same situation/.test(e.message))).toBe(true);
  });

  it('demo sources are not allowed in packs', () => {
    expect(errorPaths(file(header({ source: { kind: 'demo', name: 'x', proprietary: false } })))).toContain('pack.source.kind');
  });

  it('an empty template is rejected: no hand is ever filled in for you', () => {
    const r = validatePackFile(file(header(), HEROES.map((p) => rfiSpot(p, {}))));
    expect(r.spots).toEqual([]);
    expect(r.errors.some((e) => /no hands provided/.test(e.message))).toBe(true);
  });
});

describe('v2 pack: missing data vs fold', () => {
  it('missing hands stay "not provided" (warning), never folds', () => {
    const partial = { AA: { raise: 1 }, '72o': { fold: 1 } };
    const r = validatePackFile(file(header(), [rfiSpot('UTG', partial)]));
    expect(r.errors).toEqual([]);
    const s = r.spots[0]!;
    expect(Object.keys(s.hands)).toEqual(['AA', '72o']);
    expect(s.hands.KK).toBeUndefined();
    expect(r.warnings.some((w) => /not provided/.test(w.message))).toBe(true);
  });
});

describe('v2 pack: RFI rules', () => {
  it('open size must match the pack sizing', () => {
    const bad = rfiSpot('CO');
    bad.actions[1] = { id: 'raise', kind: 'raise', label: 'Open 2.2 BB', sizeBb: 2.2 };
    expect(validatePackFile(file(header(), [bad])).errors.some((e) => /does not match the pack sizing \(2\.5 BB\)/.test(e.message))).toBe(true);
    const sb = rfiSpot('SB');
    sb.actions[1] = { id: 'raise', kind: 'raise', label: 'Raise 2.5 BB', sizeBb: 2.5 };
    expect(validatePackFile(file(header(), [sb])).errors.some((e) => /\(3 BB\)/.test(e.message))).toBe(true);
  });

  it('limp only for the SB; call/check are illegal unopened', () => {
    const hj = rfiSpot('HJ', { AA: { limp: 1 } });
    hj.actions.push({ id: 'limp', kind: 'limp', label: 'Limp' } as never);
    expect(validatePackFile(file(header(), [hj])).errors.some((e) => /only supported for the SB/.test(e.message))).toBe(true);

    const sb = rfiSpot('SB', { ...fixtureHands(), '72s': { limp: 1 } });
    sb.actions.push({ id: 'limp', kind: 'limp', label: 'Limp' } as never);
    expect(validatePackFile(file(header(), [sb])).errors).toEqual([]);

    const btn = rfiSpot('BTN');
    btn.actions.push({ id: 'call', kind: 'call', label: 'Call' } as never);
    expect(validatePackFile(file(header(), [btn])).errors.some((e) => /not legal when nobody has opened/.test(e.message))).toBe(true);
  });

  it('history and villains must describe an unopened pot', () => {
    const co = rfiSpot('CO');
    co.history = [{ position: 'UTG', kind: 'fold' }];
    expect(errorPaths(file(header(), [co]))).toContain('spots[0].history');
    const btn = rfiSpot('BTN');
    btn.villains = ['BB'];
    expect(errorPaths(file(header(), [btn]))).toContain('spots[0].villains');
  });
});

describe('v2 pack: Standard derivation keeps source frequencies', () => {
  const mixed: HandMap = { ...fixtureHands(), A5s: { raise: 0.6, fold: 0.4 }, K9o: { raise: 0.5, fold: 0.5 } };

  it('majority action, deterministic ties by action order (fold declared first)', () => {
    const s = validatePackFile(file(header(), [rfiSpot('BTN', mixed)])).spots[0]!;
    expect(s.hands.A5s).toEqual({ raise: 1 });
    expect(s.hands.K9o).toEqual({ fold: 1 });
    expect(s.pack!.sourceHands.A5s).toEqual({ raise: 0.6, fold: 0.4 });
    expect(s.pack!.sourceHands.K9o).toEqual({ raise: 0.5, fold: 0.5 });
    expect([...s.pack!.simplifiedHands].sort()).toEqual(['A5s', 'K9o']);
  });

  it('an explicit tie-break order is honoured', () => {
    const h = header({ strategy: { standardRule: 'majority', tieBreak: ['raise', 'fold'] } });
    expect(validatePackFile(file(h, [rfiSpot('BTN', mixed)])).spots[0]!.hands.K9o).toEqual({ raise: 1 });
  });

  it('majorityAction is stable regardless of key order', () => {
    expect(majorityAction({ fold: 0.5, raise: 0.5 }, ['raise', 'fold'])).toBe('raise');
    expect(majorityAction({ raise: 0.5, fold: 0.5 }, ['fold', 'raise'])).toBe('fold');
    expect(majorityAction({ raise: 0.34, call: 0.33, fold: 0.33 }, ['fold', 'call', 'raise'])).toBe('raise');
  });

  it('frequencies are still validated (sum to 1)', () => {
    expect(validatePackFile(file(header(), [rfiSpot('BTN', { ...fixtureHands(), A5s: { raise: 0.6, fold: 0.3 } })])).errors.length).toBeGreaterThan(0);
  });
});

describe('v2 pack: transcription check is separate and strict', () => {
  const checked = { status: 'checked' as const, checkedBy: 'Reviewer', checkedAt: '2026-10-27', method: 'cell-by-cell comparison with the source' };

  it('checked transcription requires who/when/how and a source url or reference', () => {
    const paths = errorPaths(file(header({ transcription: { status: 'checked', checkedBy: null, checkedAt: 'yesterday', method: null } })));
    expect(paths).toEqual(expect.arrayContaining(['pack.transcription.checkedBy', 'pack.transcription.checkedAt', 'pack.transcription.method', 'pack.source']));
  });

  it('checked transcription requires all 169 hands, folds included', () => {
    const h = header({ transcription: checked, source: { kind: 'user', name: 'x', url: 'https://example.com', proprietary: false } });
    expect(validatePackFile(file(h, [rfiSpot('UTG', { AA: { raise: 1 } })])).errors.some((e) => /all 169 hands/.test(e.message))).toBe(true);
    const ok = validatePackFile(file(h));
    expect(ok.errors).toEqual([]);
    expect(ok.spots.every((s) => s.verification === 'verified')).toBe(true);
  });

  it('a checked transcription says nothing about target compatibility', () => {
    const h = header({ transcription: checked, source: { kind: 'user', name: 'x', url: 'https://example.com', proprietary: false } });
    expect(assessCompatibility(h).overall).toBe('unknown');
  });
});

describe('target compatibility (PokerStars NL10)', () => {
  it('unknown source parameters stay unknown', () => {
    const r = assessCompatibility(header());
    expect(r.overall).toBe('unknown');
    expect(r.items.filter((i) => i.status === 'unknown').map((i) => i.key)).toEqual(['site', 'stakes', 'rakePercent', 'rakeCapBb', 'noFlopNoDrop']);
  });

  it('compatible only when every parameter is declared and equal', () => {
    const h = header({
      sourceParameters: { site: 'PokerStars.com', stakes: 'NL10', rakePercent: 5, rakeCapBb: 10, noFlopNoDrop: true },
    });
    expect(assessCompatibility(h).overall).toBe('compatible');
    expect(TARGET_ENV.rakeCapBb).toBe(10);
  });

  it('any differing parameter makes it incompatible', () => {
    const h = header({ sourceParameters: { site: 'PokerStars.com', stakes: 'NL10', rakePercent: 4.5, rakeCapBb: 10, noFlopNoDrop: true } });
    const r = assessCompatibility(h);
    expect(r.overall).toBe('incompatible');
    expect(r.items.find((i) => i.key === 'rakePercent')?.status).toBe('mismatch');
  });

  it('invalid source parameters are rejected, null is accepted', () => {
    const h = header({ sourceParameters: { site: null, stakes: null, rakePercent: 140, rakeCapBb: -1, noFlopNoDrop: null } });
    expect(errorPaths(file(h))).toEqual(expect.arrayContaining(['pack.sourceParameters.rakePercent', 'pack.sourceParameters.rakeCapBb']));
  });
});

describe('v2 pack: rights, export, backward compatibility', () => {
  it('proprietary packs need explicit authorization', () => {
    const r = validatePackFile(file(header({ source: { kind: 'coach', name: 'Coach', proprietary: true } })));
    expect(r.needsAuthorization).toHaveLength(5);
  });

  it('exportPack → validatePackFile round trip is lossless (original frequencies)', () => {
    const mixed = { ...fixtureHands(), A5s: { raise: 0.6, fold: 0.4 } };
    const first = validatePackFile(file(header(), [rfiSpot('BTN', mixed), rfiSpot('SB')]));
    const again = validatePackFile(JSON.parse(exportPack(first.spots)));
    expect(again.errors).toEqual([]);
    expect(again.spots).toEqual(first.spots);
  });

  it('importJson accepts v2 packs and v1 libraries', () => {
    expect(importJson(JSON.stringify(file())).spots).toHaveLength(5);
    expect(importJson(exportJson([...DEMO_SPOTS])).spots).toEqual(DEMO_SPOTS);
  });

  it('a v1 snapshot keeps pack provenance and source frequencies', () => {
    const mixed = { ...fixtureHands(), A5s: { raise: 0.6, fold: 0.4 } };
    const spots = validatePackFile(file(header(), [rfiSpot('BTN', mixed)])).spots;
    const back = importJson(exportJson(spots));
    expect(back.errors).toEqual([]);
    expect(back.spots).toEqual(spots);
  });

  it('editing a pack spot always creates a detached user copy', () => {
    const s = validatePackFile(file()).spots[0]!;
    expect(editableInPlace(s)).toBe(false);
    const c = userCopy(s, new Set([s.id]));
    expect(c.pack).toBeUndefined();
    expect(c.source.kind).toBe('user');
    expect(c.verification).toBe('unverified');
  });
});

describe('demo spots covered by a real pack', () => {
  const pack = validatePackFile(file()).spots;
  const all = [...DEMO_SPOTS, ...pack];

  it('are hidden from training by default, nothing is deleted', () => {
    const hidden = coveredDemoIds(all);
    expect([...hidden].sort()).toEqual(['demo-btn-rfi', 'demo-btn-rfi-mixed', 'demo-co-rfi', 'demo-hj-rfi', 'demo-sb-rfi', 'demo-utg-rfi']);
    const train = trainingSpots(all);
    expect(train.some((s) => hidden.has(s.id))).toBe(false);
    expect(train.some((s) => s.id === 'demo-bb-vs-btn')).toBe(true); // not covered: still trained
    expect(all).toHaveLength(DEMO_SPOTS.length + 5);
  });

  it('can be shown again with the option', () => {
    expect(trainingSpots(all, true)).toHaveLength(all.length);
  });

  it('nothing is hidden without a real pack', () => {
    expect(trainingSpots([...DEMO_SPOTS])).toHaveLength(DEMO_SPOTS.length);
  });
});

describe('shipped templates', () => {
  const dir = new URL('../../data/ranges/templates/', import.meta.url);

  it('the RFI pack template declares the five spots and contains no hands', () => {
    const t = JSON.parse(readFileSync(new URL('rfi-pack.template.json', dir), 'utf8'));
    expect(t.schema).toBe(PACK_SCHEMA_ID);
    expect(t.spots.map((s: { hero: string }) => s.hero)).toEqual(HEROES);
    for (const s of t.spots) expect(Object.keys(s.hands)).toHaveLength(0);
    // Structure is valid; only the missing hands are reported.
    const r = validatePackFile(t);
    expect(r.errors.every((e) => /no hands provided/.test(e.message))).toBe(true);
    // Filling hands (here: synthetic fixture) makes it valid.
    const filled = { ...t, spots: t.spots.map((s: object) => ({ ...s, hands: fixtureHands() })) };
    expect(validatePackFile(filled).errors).toEqual([]);
  });

  it('CSV templates list the 169 hands with empty cells', () => {
    for (const p of HEROES) {
      const lines = readFileSync(new URL(`rfi-${p.toLowerCase()}.template.csv`, dir), 'utf8').trim().split('\n');
      const header = lines[0]!.split(',');
      expect(header[0]).toBe('hand');
      const hands = lines.slice(1).map((l) => l.split(',')[0] as HandClass);
      expect(hands).toEqual([...ALL_HANDS]);
      expect(lines.slice(1).every((l) => l.split(',').slice(1).every((c) => c === ''))).toBe(true);
    }
  });
});
