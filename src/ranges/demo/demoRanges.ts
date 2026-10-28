import { ALL_HANDS, type HandClass } from '../../engine/hands';
import type { Position } from '../../engine/positions';
import type { ActionOption, HandMap, HistoryAction, RangeSpot, SpotFamily, Strategy } from '../types';
import { chenScore } from './chen';

/**
 * ⚠️ FICTIONAL DEMO RANGES ⚠️
 * Generated automatically from the Chen formula and arbitrary thresholds.
 * They only exist to make the app work. They are not GTO, not solver output,
 * not verified, and must not be used in real games.
 */

export const DEMO_PREFIX = 'demo-';

/** Bump when demo content changes so stored copies are refreshed. */
export const DEMO_VERSION = 2;

const DEMO_COMMON = {
  format: { game: 'NLHE', tableSize: 6, stackBb: 100, site: 'PokerStars.com', stakes: 'NL10', tableType: 'regular' },
  sizing: {
    profileId: 'demo-2.5bb-3bb',
    description: 'Open 2.5 BB (SB 3 BB). 3-bet/4-bet sizings: demo values.',
    rfiBb: 2.5,
    sbRfiBb: 3,
    threeBetIpBb: 7.5,
    threeBetOopBb: 10,
    fourBetBb: 22,
  },
  rake: {
    modelId: 'demo-unverified',
    percent: 5,
    capBb: null,
    noFlopNoDrop: true,
    description: 'Indicative values, NOT verified — replace with the room\'s official rake table.',
  },
  source: {
    kind: 'demo',
    name: 'Generated fictional demo (Chen formula + arbitrary thresholds)',
    proprietary: false,
    notes: 'Do not use in real games. No GTO values.',
  },
  verification: 'demo',
} as const satisfies Partial<RangeSpot>;

const FOLD: ActionOption = { id: 'fold', kind: 'fold', label: 'Fold' };

const one = (id: string): Strategy => ({ [id]: 1 });

function folds(...positions: Position[]): HistoryAction[] {
  return positions.map((position) => ({ position, kind: 'fold' }));
}

function byScore(classify: (score: number, hand: HandClass) => Strategy | undefined): HandMap {
  const out: HandMap = {};
  for (const h of ALL_HANDS) {
    const s = classify(chenScore(h), h);
    if (s) out[h] = s;
  }
  return out;
}

function spot(
  id: string,
  name: string,
  family: SpotFamily,
  hero: Position,
  villains: Position[],
  history: HistoryAction[],
  actions: ActionOption[],
  hands: HandMap,
  extra: Partial<RangeSpot> = {},
): RangeSpot {
  return {
    id: DEMO_PREFIX + id,
    name: `[DEMO] ${name}`,
    family,
    mode: 'standard',
    hero,
    villains,
    history,
    actions,
    hands,
    ...DEMO_COMMON,
    format: { ...DEMO_COMMON.format },
    sizing: { ...DEMO_COMMON.sizing },
    rake: { ...DEMO_COMMON.rake },
    source: { ...DEMO_COMMON.source },
    ...extra,
  };
}

function rfi(hero: Position, threshold: number, prior: Position[]): RangeSpot {
  const open: ActionOption = { id: 'raise', kind: 'raise', label: 'Open 2.5 BB', sizeBb: 2.5 };
  const villains = (['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as Position[]).filter((p) => p !== hero && !prior.includes(p));
  return spot(`${hero.toLowerCase()}-rfi`, `${hero} — Open`, 'RFI', hero, villains, folds(...prior), [FOLD, open],
    byScore((s) => (s >= threshold ? one('raise') : one('fold'))));
}

function buildDemoSpots(): RangeSpot[] {
  const open = (p: Position): HistoryAction => ({ position: p, kind: 'raise', sizeBb: 2.5 });
  const call: ActionOption = { id: 'call', kind: 'call', label: 'Call' };
  const btnOpen = (s: number) => s >= 6;
  const bb3bet = (s: number) => s >= 10;

  return [
    rfi('UTG', 9, []),
    rfi('HJ', 8, ['UTG']),
    rfi('CO', 7, ['UTG', 'HJ']),
    rfi('BTN', 6, ['UTG', 'HJ', 'CO']),
    spot('sb-rfi', 'SB — Open or limp', 'RFI', 'SB', ['BB'], folds('UTG', 'HJ', 'CO', 'BTN'),
      [FOLD, { id: 'limp', kind: 'limp', label: 'Limp' }, { id: 'raise', kind: 'raise', label: 'Raise 3 BB', sizeBb: 3 }],
      byScore((s) => (s >= 8 ? one('raise') : s >= 5 ? one('limp') : one('fold')))),

    spot('bb-vs-btn', 'BB vs BTN open', 'VS_OPEN', 'BB', ['BTN'], [...folds('UTG', 'HJ', 'CO'), open('BTN'), ...folds('SB')],
      [FOLD, call, { id: '3bet', kind: 'raise', label: '3-bet 10 BB', sizeBb: 10 }],
      byScore((s) => (bb3bet(s) ? one('3bet') : s >= 4 ? one('call') : one('fold')))),
    spot('btn-vs-co', 'BTN vs CO open', 'VS_OPEN', 'BTN', ['CO'], [...folds('UTG', 'HJ'), open('CO')],
      [FOLD, call, { id: '3bet', kind: 'raise', label: '3-bet 7.5 BB', sizeBb: 7.5 }],
      byScore((s) => (s >= 10 ? one('3bet') : s >= 7 ? one('call') : one('fold')))),
    spot('sb-vs-btn', 'SB vs BTN open', 'VS_OPEN', 'SB', ['BTN'], [...folds('UTG', 'HJ', 'CO'), open('BTN')],
      [FOLD, { id: '3bet', kind: 'raise', label: '3-bet 10 BB', sizeBb: 10 }],
      byScore((s) => (s >= 9 ? one('3bet') : one('fold')))),

    // Only hands in the BTN opening range are provided: the rest are NOT PROVIDED (not folds).
    spot('btn-vs-bb-3bet', 'BTN open, vs BB 3-bet', 'VS_3BET', 'BTN', ['BB'],
      [...folds('UTG', 'HJ', 'CO'), open('BTN'), ...folds('SB'), { position: 'BB', kind: 'raise', sizeBb: 10 }],
      [FOLD, call, { id: '4bet', kind: 'raise', label: '4-bet 22 BB', sizeBb: 22 }],
      byScore((s) => (!btnOpen(s) ? undefined : s >= 12 ? one('4bet') : s >= 8 ? one('call') : one('fold'))),
      { notes: 'Only hands opened from the BTN in the demo are provided.' }),

    spot('bb-vs-btn-4bet', 'BB 3-bet, vs BTN 4-bet', 'VS_4BET', 'BB', ['BTN'],
      [...folds('UTG', 'HJ', 'CO'), open('BTN'), ...folds('SB'), { position: 'BB', kind: 'raise', sizeBb: 10 }, { position: 'BTN', kind: 'raise', sizeBb: 22 }],
      [FOLD, call, { id: 'allin', kind: 'allin', label: '5-bet all-in', sizeBb: 100 }],
      byScore((s, h) => (!bb3bet(s) ? undefined : s >= 14 || h === 'AKs' ? one('allin') : s >= 12 ? one('call') : one('fold'))),
      { notes: 'Only hands 3-bet by the BB in the demo are provided.' }),

    spot('bb-vs-sb-limp', 'BB vs SB limp', 'BVB_LIMP', 'BB', ['SB'], [...folds('UTG', 'HJ', 'CO', 'BTN'), { position: 'SB', kind: 'limp', sizeBb: 1 }],
      [{ id: 'check', kind: 'check', label: 'Check' }, { id: 'raise', kind: 'raise', label: 'Raise 4 BB', sizeBb: 4 }],
      byScore((s) => (s >= 8 ? one('raise') : one('check')))),

    // Example "Pro" spot (mixed frequencies): visible in the viewer, excluded from the Standard quiz.
    spot('btn-rfi-mixed', 'BTN — Open (mixed-frequency example)', 'RFI', 'BTN', ['SB', 'BB'], folds('UTG', 'HJ', 'CO'),
      [FOLD, { id: 'raise', kind: 'raise', label: 'Open 2.5 BB', sizeBb: 2.5 }],
      byScore((s) => (s >= 7 ? one('raise') : s >= 5 ? ({ raise: (s - 4) / 3, fold: 1 - (s - 4) / 3 } as Strategy) : one('fold'))),
      { mode: 'pro', notes: 'Arbitrary frequencies illustrating the future Pro mode.' }),
  ];
}

export const DEMO_SPOTS: readonly RangeSpot[] = buildDemoSpots();

export function isDemoSpot(spot: RangeSpot): boolean {
  return spot.verification === 'demo' || spot.source.kind === 'demo';
}
