import type { PackHeader } from './types';

/**
 * The environment Cash Trainer targets. Official values provided by the project owner
 * (source: https://www.pokerstars.com/poker/room/rake/). NL10 USD: 1 BB = $0.10, so the $1 cap = 10 BB.
 */
export const TARGET_ENV = {
  site: 'PokerStars.com',
  game: 'NLHE',
  tableType: 'regular',
  stakes: 'NL10',
  currency: 'USD',
  tableSize: 6,
  stackBb: 100,
  rakePercent: 5,
  rakeCapBb: 10,
  noFlopNoDrop: true,
  rfiBb: 2.5,
  sbRfiBb: 3,
  reference: 'https://www.pokerstars.com/poker/room/rake/',
} as const;

export type ParamStatus = 'match' | 'mismatch' | 'unknown';
export type Compatibility = 'compatible' | 'unknown' | 'incompatible';

export interface CompatibilityItem {
  key: string;
  label: string;
  target: string;
  source: string;
  status: ParamStatus;
}

export interface CompatibilityReport {
  /** compatible = every parameter declared AND equal; any mismatch = incompatible; otherwise unknown. */
  overall: Compatibility;
  items: CompatibilityItem[];
}

const show = (v: unknown) => (v === null || v === undefined ? 'unknown' : String(v));

function item(key: string, label: string, target: unknown, source: unknown, equal = (a: unknown, b: unknown) => a === b): CompatibilityItem {
  const status: ParamStatus = source === null || source === undefined ? 'unknown' : equal(target, source) ? 'match' : 'mismatch';
  return { key, label, target: show(target), source: show(source), status };
}

const norm = (s: unknown) => (typeof s === 'string' ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : s);

/**
 * Compares the parameters a pack DECLARES against the target environment.
 * It is a parameter check only: "compatible" never means "optimized for" the target.
 */
export function assessCompatibility(h: Pick<PackHeader, 'format' | 'sizing' | 'sourceParameters'>): CompatibilityReport {
  const p = h.sourceParameters;
  const items = [
    item('site', 'Site', TARGET_ENV.site, p.site, (a, b) => norm(a) === norm(b)),
    item('stakes', 'Stakes', TARGET_ENV.stakes, p.stakes, (a, b) => norm(a) === norm(b)),
    item('tableSize', 'Table size', TARGET_ENV.tableSize, h.format.tableSize),
    item('stackBb', 'Effective stack (BB)', TARGET_ENV.stackBb, h.format.stackBb),
    item('rakePercent', 'Rake %', TARGET_ENV.rakePercent, p.rakePercent),
    item('rakeCapBb', 'Rake cap (BB)', TARGET_ENV.rakeCapBb, p.rakeCapBb),
    item('noFlopNoDrop', 'No flop, no drop', TARGET_ENV.noFlopNoDrop, p.noFlopNoDrop),
    item('rfiBb', 'Open size (BB)', TARGET_ENV.rfiBb, h.sizing.rfiBb ?? null),
    item('sbRfiBb', 'SB open size (BB)', TARGET_ENV.sbRfiBb, h.sizing.sbRfiBb ?? null),
  ];
  const overall: Compatibility = items.some((i) => i.status === 'mismatch')
    ? 'incompatible'
    : items.every((i) => i.status === 'match')
      ? 'compatible'
      : 'unknown';
  return { overall, items };
}

export const COMPATIBILITY_LABELS: Record<Compatibility, string> = {
  compatible: 'Declared parameters match the target',
  unknown: 'Some source parameters are unknown',
  incompatible: 'Source parameters differ from the target',
};
