import { isActionKind } from '../engine/actions';
import { ALL_HANDS, isHandClass } from '../engine/hands';
import { isPosition } from '../engine/positions';
import {
  SCHEMA_ID,
  SOURCE_KINDS,
  SPOT_FAMILIES,
  VERIFICATION_STATUSES,
  type ActionOption,
  type HandMap,
  type HistoryAction,
  type RangeLibrary,
  type RangeSpot,
} from './types';

export interface Issue {
  path: string;
  message: string;
}

export interface SpotValidation {
  spot: RangeSpot | null;
  errors: Issue[];
  warnings: Issue[];
}

export interface LibraryValidation {
  spots: RangeSpot[];
  errors: Issue[];
  warnings: Issue[];
  /** Proprietary spots without confirmed authorization: must be confirmed before import. */
  needsAuthorization: string[];
}

export const FREQUENCY_TOLERANCE = 0.001;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

class Collector {
  errors: Issue[] = [];
  warnings: Issue[] = [];
  constructor(private prefix: string) {}
  err(path: string, message: string) {
    this.errors.push({ path: this.prefix + path, message });
  }
  warn(path: string, message: string) {
    this.warnings.push({ path: this.prefix + path, message });
  }
}

function optNum(o: Obj, key: string, c: Collector, path: string): number | undefined {
  const v = o[key];
  if (v === undefined || v === null) return undefined;
  if (!isNum(v) || v < 0) {
    c.err(`${path}.${key}`, 'must be a positive number');
    return undefined;
  }
  return v;
}

function optStr(o: Obj, key: string): string | undefined {
  const v = o[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function validateSpot(raw: unknown, prefix = ''): SpotValidation {
  const c = new Collector(prefix);
  if (!isObj(raw)) {
    c.err('', 'spot must be an object');
    return { spot: null, errors: c.errors, warnings: c.warnings };
  }

  // Identity
  if (!isStr(raw.id)) c.err('id', 'missing id');
  if (!isStr(raw.name)) c.err('name', 'missing name');
  if (!SPOT_FAMILIES.includes(raw.family as never)) c.err('family', `unknown family (${SPOT_FAMILIES.join(', ')})`);
  const mode = raw.mode ?? 'standard';
  if (mode !== 'standard' && mode !== 'pro') c.err('mode', 'must be "standard" or "pro"');

  // Format
  const format = raw.format;
  if (!isObj(format)) c.err('format', 'missing format');
  else {
    if (format.game !== 'NLHE') c.err('format.game', 'only "NLHE" is supported');
    if (!isNum(format.tableSize)) c.err('format.tableSize', 'missing table size');
    else if (format.tableSize !== 6) c.warn('format.tableSize', `${format.tableSize}-max table: the app targets 6-max`);
    if (!isNum(format.stackBb)) c.err('format.stackBb', 'missing stack depth');
    else if (format.stackBb !== 100) c.warn('format.stackBb', `${format.stackBb} BB depth: the app targets 100 BB`);
  }

  // Positions
  if (!isPosition(raw.hero)) c.err('hero', 'invalid hero position');
  const villains = Array.isArray(raw.villains) ? raw.villains : null;
  if (!villains) c.err('villains', 'missing villains list');
  else {
    villains.forEach((v, i) => {
      if (!isPosition(v)) c.err(`villains[${i}]`, 'invalid position');
      else if (v === raw.hero) c.err(`villains[${i}]`, 'hero cannot be their own villain');
    });
  }

  // History
  const history: HistoryAction[] = [];
  if (!Array.isArray(raw.history)) c.err('history', 'missing action history (array, may be empty)');
  else {
    raw.history.forEach((h, i) => {
      if (!isObj(h) || !isPosition(h.position) || !isActionKind(h.kind)) {
        c.err(`history[${i}]`, 'invalid action (position + kind required)');
        return;
      }
      const sizeBb = optNum(h, 'sizeBb', c, `history[${i}]`);
      history.push({ position: h.position, kind: h.kind, ...(sizeBb !== undefined ? { sizeBb } : {}) });
    });
  }

  // Sizings
  const sizing = raw.sizing;
  if (!isObj(sizing) || !isStr(sizing.profileId)) c.err('sizing.profileId', 'missing sizing profile');
  else for (const k of ['rfiBb', 'sbRfiBb', 'threeBetIpBb', 'threeBetOopBb', 'fourBetBb']) optNum(sizing, k, c, 'sizing');

  // Rake
  const rake = raw.rake;
  if (!isObj(rake)) c.err('rake', 'missing rake model');
  else {
    if (!isStr(rake.modelId)) c.err('rake.modelId', 'missing rake model id');
    if (rake.percent === undefined) c.err('rake.percent', 'missing percentage (null if unknown)');
    else if (rake.percent === null) c.warn('rake.percent', 'rake percentage unknown');
    else if (!isNum(rake.percent) || rake.percent < 0 || rake.percent > 100) c.err('rake.percent', 'invalid percentage');
    if (rake.capBb === undefined) c.err('rake.capBb', 'missing cap (null if unknown)');
    else if (rake.capBb === null) c.warn('rake.capBb', 'rake cap not provided');
    else if (!isNum(rake.capBb) || rake.capBb < 0) c.err('rake.capBb', 'invalid cap');
    if (rake.noFlopNoDrop === null) c.warn('rake.noFlopNoDrop', 'no-flop-no-drop rule unknown');
    else if (typeof rake.noFlopNoDrop !== 'boolean') c.err('rake.noFlopNoDrop', 'boolean or null required');
  }

  // Source
  const source = raw.source;
  if (!isObj(source)) c.err('source', 'missing data source');
  else {
    if (!SOURCE_KINDS.includes(source.kind as never)) c.err('source.kind', `unknown source kind (${SOURCE_KINDS.join(', ')})`);
    if (!isStr(source.name)) c.err('source.name', 'missing source name');
    if (typeof source.proprietary !== 'boolean') c.err('source.proprietary', 'specify whether the range is proprietary (true/false)');
  }

  // Verification
  if (!VERIFICATION_STATUSES.includes(raw.verification as never)) {
    c.err('verification', `unknown status (${VERIFICATION_STATUSES.join(', ')})`);
  } else {
    if (raw.verification === 'demo' && isObj(source) && source.kind !== 'demo')
      c.err('verification', '"demo" status is reserved for demo sources');
    if (isObj(source) && source.kind === 'demo' && raw.verification !== 'demo')
      c.err('verification', 'a demo source cannot be marked as verified');
    if (raw.verification === 'unverified') c.warn('verification', 'unverified range');
  }

  // Legal actions
  const actions: ActionOption[] = [];
  if (!Array.isArray(raw.actions) || raw.actions.length < 2) c.err('actions', 'at least two legal actions required');
  else {
    const ids = new Set<string>();
    raw.actions.forEach((a, i) => {
      if (!isObj(a) || !isStr(a.id) || !isActionKind(a.kind) || !isStr(a.label)) {
        c.err(`actions[${i}]`, 'invalid action (id, kind, label required)');
        return;
      }
      if (ids.has(a.id)) c.err(`actions[${i}].id`, `duplicate id "${a.id}"`);
      ids.add(a.id);
      const sizeBb = optNum(a, 'sizeBb', c, `actions[${i}]`);
      actions.push({ id: a.id, kind: a.kind, label: a.label, ...(sizeBb !== undefined ? { sizeBb } : {}) });
    });
  }
  const actionIds = new Set(actions.map((a) => a.id));

  // Hands
  const hands: HandMap = {};
  if (!isObj(raw.hands)) c.err('hands', 'missing hands object');
  else {
    for (const [key, strat] of Object.entries(raw.hands)) {
      if (!isHandClass(key)) {
        c.err(`hands.${key}`, 'unknown hand (expected notation: AA, AKs, AKo…)');
        continue;
      }
      if (!isObj(strat)) {
        c.err(`hands.${key}`, 'invalid strategy');
        continue;
      }
      let sum = 0;
      let ok = true;
      const clean: Record<string, number> = {};
      for (const [id, f] of Object.entries(strat)) {
        if (!actionIds.has(id)) {
          c.err(`hands.${key}.${id}`, `action "${id}" not declared in actions`);
          ok = false;
        } else if (!isNum(f) || f < 0 || f > 1) {
          c.err(`hands.${key}.${id}`, 'frequency outside [0, 1]');
          ok = false;
        } else {
          sum += f;
          if (f > 0) clean[id] = f;
        }
      }
      if (!ok) continue;
      if (Math.abs(sum - 1) > FREQUENCY_TOLERANCE) {
        c.err(`hands.${key}`, `frequencies sum to ${sum.toFixed(3)} instead of 1`);
        continue;
      }
      if (mode === 'standard' && Object.keys(clean).length !== 1) {
        c.err(`hands.${key}`, 'mixed frequencies in a "standard" spot (use mode "pro")');
        continue;
      }
      hands[key] = clean;
    }
    const missing = ALL_HANDS.filter((h) => !(h in (raw.hands as Obj)));
    if (missing.length === ALL_HANDS.length) c.err('hands', 'no hands provided');
    else if (missing.length > 0)
      c.warn('hands', `${missing.length} hand(s) not provided: they will neither be shown as folds nor quizzed`);
  }

  // Pack provenance (spots expanded from a v2 pack, re-imported from a v1 snapshot)
  let packInfo: RangeSpot['pack'];
  if (raw.pack !== undefined) {
    const p = raw.pack;
    if (!isObj(p) || !isObj(p.header) || !isStr(p.header.id) || !isStr(p.spotId) || !isObj(p.sourceHands) || !Array.isArray(p.simplifiedHands)) {
      c.err('pack', 'invalid pack provenance');
    } else {
      packInfo = structuredClone(p) as unknown as RangeSpot['pack'];
    }
  }

  if (c.errors.length > 0) return { spot: null, errors: c.errors, warnings: c.warnings };

  const f = format as Obj;
  const sz = sizing as Obj;
  const rk = rake as Obj;
  const src = source as Obj;
  const spot: RangeSpot = {
    id: raw.id as string,
    name: raw.name as string,
    family: raw.family as RangeSpot['family'],
    mode: mode as RangeSpot['mode'],
    format: {
      game: 'NLHE',
      tableSize: f.tableSize as number,
      stackBb: f.stackBb as number,
      ...(optStr(f, 'site') ? { site: optStr(f, 'site') } : {}),
      ...(optStr(f, 'stakes') ? { stakes: optStr(f, 'stakes') } : {}),
      ...(optStr(f, 'tableType') ? { tableType: optStr(f, 'tableType') } : {}),
    },
    hero: raw.hero as RangeSpot['hero'],
    villains: villains as RangeSpot['villains'],
    history,
    sizing: { ...(sz as object), profileId: sz.profileId as string } as RangeSpot['sizing'],
    rake: {
      modelId: rk.modelId as string,
      percent: rk.percent as number | null,
      capBb: rk.capBb as number | null,
      noFlopNoDrop: rk.noFlopNoDrop as boolean | null,
      ...(optStr(rk, 'description') ? { description: optStr(rk, 'description') } : {}),
    },
    source: { ...(src as object) } as RangeSpot['source'],
    verification: raw.verification as RangeSpot['verification'],
    actions,
    hands,
    ...(optStr(raw, 'notes') ? { notes: optStr(raw, 'notes') } : {}),
    ...(optStr(raw, 'updatedAt') ? { updatedAt: optStr(raw, 'updatedAt') } : {}),
    ...(packInfo ? { pack: packInfo } : {}),
  };
  return { spot, errors: c.errors, warnings: c.warnings };
}

export function validateLibrary(raw: unknown): LibraryValidation {
  const out: LibraryValidation = { spots: [], errors: [], warnings: [], needsAuthorization: [] };
  if (!isObj(raw)) {
    out.errors.push({ path: '', message: 'file must contain a JSON object' });
    return out;
  }
  if (raw.schema !== SCHEMA_ID) {
    out.errors.push({ path: 'schema', message: `expected schema "${SCHEMA_ID}"` });
    return out;
  }
  if (!Array.isArray(raw.spots)) {
    out.errors.push({ path: 'spots', message: 'missing "spots" array' });
    return out;
  }
  const ids = new Set<string>();
  raw.spots.forEach((s, i) => {
    const r = validateSpot(s, `spots[${i}].`);
    out.errors.push(...r.errors);
    out.warnings.push(...r.warnings);
    if (!r.spot) return;
    if (ids.has(r.spot.id)) {
      out.errors.push({ path: `spots[${i}].id`, message: `duplicate id "${r.spot.id}"` });
      return;
    }
    ids.add(r.spot.id);
    if (r.spot.source.proprietary && !r.spot.source.authorizedByUser) out.needsAuthorization.push(r.spot.id);
    out.spots.push(r.spot);
  });
  return out;
}

export function toLibrary(spots: RangeSpot[], name?: string): RangeLibrary {
  return { schema: SCHEMA_ID, ...(name ? { name } : {}), exportedAt: new Date().toISOString(), spots };
}
