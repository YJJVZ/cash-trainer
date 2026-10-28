import { ALL_HANDS } from '../engine/hands';
import { POSITIONS, isPosition, type Position } from '../engine/positions';
import { deriveStandard } from './standard';
import {
  PACK_SCHEMA_ID,
  SOURCE_KINDS,
  SPOT_FAMILIES,
  type ActionOption,
  type HandMap,
  type HistoryAction,
  type PackHeader,
  type RangeSpot,
} from './types';
import { validateSpot, type Issue } from './validation';

/** Separator between pack id and spot id in internal spot ids ("pack-id:rfi-utg"). */
export const PACK_ID_SEP = ':';

export interface PackValidation {
  header: PackHeader | null;
  /** Spots expanded to the internal format (Standard hands derived, source frequencies kept). */
  spots: RangeSpot[];
  errors: Issue[];
  warnings: Issue[];
  needsAuthorization: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/** null/undefined → null; anything else must pass the check. */
function nullable<T>(v: unknown, ok: (x: unknown) => x is T, path: string, errors: Issue[], what: string): T | null {
  if (v === null || v === undefined) return null;
  if (!ok(v)) {
    errors.push({ path, message: `${what} or null` });
    return null;
  }
  return v;
}

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isPercent = (v: unknown): v is number => isNum(v) && v >= 0 && v <= 100;
const isPositive = (v: unknown): v is number => isNum(v) && v >= 0;

function validateHeader(raw: Obj, errors: Issue[], warnings: Issue[]): PackHeader | null {
  const start = errors.length;
  const p = raw.pack;
  if (!isObj(p)) {
    errors.push({ path: 'pack', message: 'missing "pack" header' });
    return null;
  }
  if (!isStr(p.id) || !/^[a-z0-9][a-z0-9._-]*$/.test(p.id)) errors.push({ path: 'pack.id', message: 'lowercase id required (a-z, 0-9, . _ -)' });
  if (!Number.isInteger(p.version) || (p.version as number) < 1) errors.push({ path: 'pack.version', message: 'integer ≥ 1 required' });
  if (!isStr(p.name)) errors.push({ path: 'pack.name', message: 'missing name' });

  const f = p.format;
  if (!isObj(f) || f.game !== 'NLHE' || !isNum(f.tableSize) || !isNum(f.stackBb)) {
    errors.push({ path: 'pack.format', message: 'format { game: "NLHE", tableSize, stackBb } required' });
  }

  const s = p.sizing;
  if (!isObj(s) || !isStr(s.profileId)) errors.push({ path: 'pack.sizing.profileId', message: 'missing sizing profile id' });
  else {
    if (!isNum(s.rfiBb) || s.rfiBb <= 0) errors.push({ path: 'pack.sizing.rfiBb', message: 'open size in BB required' });
    if (!isNum(s.sbRfiBb) || s.sbRfiBb <= 0) errors.push({ path: 'pack.sizing.sbRfiBb', message: 'SB open size in BB required' });
  }

  const sp = isObj(p.sourceParameters) ? p.sourceParameters : null;
  if (!sp) errors.push({ path: 'pack.sourceParameters', message: 'missing sourceParameters (use null for unknown values)' });
  const sourceParameters = {
    site: nullable(sp?.site, isStr, 'pack.sourceParameters.site', errors, 'text'),
    stakes: nullable(sp?.stakes, isStr, 'pack.sourceParameters.stakes', errors, 'text'),
    rakePercent: nullable(sp?.rakePercent, isPercent, 'pack.sourceParameters.rakePercent', errors, 'percentage 0–100'),
    rakeCapBb: nullable(sp?.rakeCapBb, isPositive, 'pack.sourceParameters.rakeCapBb', errors, 'positive number'),
    noFlopNoDrop: nullable(sp?.noFlopNoDrop, isBool, 'pack.sourceParameters.noFlopNoDrop', errors, 'boolean'),
    notes: nullable(sp?.notes, isStr, 'pack.sourceParameters.notes', errors, 'text'),
  };
  for (const k of ['site', 'stakes', 'rakePercent', 'rakeCapBb', 'noFlopNoDrop'] as const) {
    if (sp && sourceParameters[k] === null) warnings.push({ path: `pack.sourceParameters.${k}`, message: 'unknown for this source' });
  }

  const src = p.source;
  if (!isObj(src)) errors.push({ path: 'pack.source', message: 'missing source' });
  else {
    if (!SOURCE_KINDS.includes(src.kind as never) || src.kind === 'demo') {
      errors.push({ path: 'pack.source.kind', message: 'solver, coach, book, user or other (demo is not allowed in packs)' });
    }
    if (!isStr(src.name)) errors.push({ path: 'pack.source.name', message: 'missing source name' });
    if (!isBool(src.proprietary)) errors.push({ path: 'pack.source.proprietary', message: 'true/false required' });
  }

  const t = p.transcription;
  if (!isObj(t) || (t.status !== 'unchecked' && t.status !== 'checked')) {
    errors.push({ path: 'pack.transcription.status', message: '"unchecked" or "checked" required' });
  } else if (t.status === 'checked') {
    if (!isStr(t.checkedBy)) errors.push({ path: 'pack.transcription.checkedBy', message: 'required when transcription is checked' });
    if (!isStr(t.checkedAt) || !ISO_DATE.test(t.checkedAt)) errors.push({ path: 'pack.transcription.checkedAt', message: 'ISO date (YYYY-MM-DD) required when checked' });
    if (!isStr(t.method)) errors.push({ path: 'pack.transcription.method', message: 'required when transcription is checked' });
    if (isObj(src) && !isStr(src.url) && !isStr(src.reference)) {
      errors.push({ path: 'pack.source', message: 'url or reference required when transcription is checked' });
    }
  } else warnings.push({ path: 'pack.transcription', message: 'transcription not checked against the source yet' });

  const st = p.strategy;
  if (!isObj(st) || st.standardRule !== 'majority') errors.push({ path: 'pack.strategy.standardRule', message: 'only "majority" is supported' });
  else if (st.tieBreak !== null && st.tieBreak !== undefined && (!Array.isArray(st.tieBreak) || !st.tieBreak.every(isStr))) {
    errors.push({ path: 'pack.strategy.tieBreak', message: 'array of action ids or null' });
  }

  if (errors.length > start) return null;
  const ff = f as Obj;
  const ss = s as Obj;
  const tt = t as Obj;
  const sr = src as Obj;
  return {
    id: p.id as string,
    version: p.version as number,
    name: p.name as string,
    format: { game: 'NLHE', tableSize: ff.tableSize as number, stackBb: ff.stackBb as number, tableType: isStr(ff.tableType) ? ff.tableType : null },
    sizing: { ...(ss as object), profileId: ss.profileId as string } as PackHeader['sizing'],
    sourceParameters,
    source: {
      kind: sr.kind as PackHeader['source']['kind'],
      name: sr.name as string,
      proprietary: sr.proprietary as boolean,
      ...(isStr(sr.author) ? { author: sr.author } : {}),
      ...(isStr(sr.url) ? { url: sr.url } : {}),
      ...(isStr(sr.reference) ? { reference: sr.reference } : {}),
      ...(isStr(sr.license) ? { license: sr.license } : {}),
      ...(isStr(sr.tool) ? { tool: sr.tool } : {}),
      ...(isStr(sr.producedAt) ? { producedAt: sr.producedAt } : {}),
      ...(isStr(sr.notes) ? { notes: sr.notes } : {}),
      ...(sr.authorizedByUser === true ? { authorizedByUser: true } : {}),
    },
    transcription: {
      status: tt.status as 'unchecked' | 'checked',
      checkedBy: isStr(tt.checkedBy) ? tt.checkedBy : null,
      checkedAt: isStr(tt.checkedAt) ? tt.checkedAt : null,
      method: isStr(tt.method) ? tt.method : null,
    },
    strategy: { standardRule: 'majority', tieBreak: Array.isArray((st as Obj).tieBreak) ? ((st as Obj).tieBreak as string[]) : null },
    ...(isStr(p.compatibilityNote) ? { compatibilityNote: p.compatibilityNote } : {}),
  };
}

/** Positions that act before hero preflop (they must all have folded in an RFI spot). */
function before(hero: Position): Position[] {
  return POSITIONS.slice(0, POSITIONS.indexOf(hero));
}

/** RFI-specific consistency checks against the pack sizing. */
function checkRfi(path: string, hero: Position, villains: unknown, history: unknown, actions: ActionOption[], h: PackHeader, errors: Issue[]) {
  const expectedHistory = before(hero);
  const hist = Array.isArray(history) ? (history as HistoryAction[]) : [];
  const ok = hist.length === expectedHistory.length && hist.every((a, i) => a.position === expectedHistory[i] && a.kind === 'fold');
  if (!ok) errors.push({ path: `${path}.history`, message: `RFI history must be folds from ${expectedHistory.join(', ') || '(nobody: first to act)'}` });

  const expectedVillains = POSITIONS.slice(POSITIONS.indexOf(hero) + 1);
  if (!Array.isArray(villains) || villains.length !== expectedVillains.length || !expectedVillains.every((v) => villains.includes(v))) {
    errors.push({ path: `${path}.villains`, message: `RFI villains must be ${expectedVillains.join(', ')}` });
  }
  if (hero === 'BB') errors.push({ path: `${path}.hero`, message: 'BB cannot open (RFI)' });

  if (!actions.some((a) => a.kind === 'fold')) errors.push({ path: `${path}.actions`, message: 'RFI spot needs a fold action' });
  const open = hero === 'SB' ? h.sizing.sbRfiBb : h.sizing.rfiBb;
  for (const a of actions) {
    if (a.kind === 'call' || a.kind === 'check') errors.push({ path: `${path}.actions.${a.id}`, message: `"${a.kind}" is not legal when nobody has opened` });
    if (a.kind === 'limp' && hero !== 'SB') errors.push({ path: `${path}.actions.${a.id}`, message: 'limp is only supported for the SB in RFI packs' });
    if (a.kind === 'raise' && a.sizeBb !== open) {
      errors.push({ path: `${path}.actions.${a.id}`, message: `open size ${a.sizeBb ?? '?'} BB does not match the pack sizing (${open} BB)` });
    }
  }
}

export function validatePackFile(raw: unknown): PackValidation {
  const out: PackValidation = { header: null, spots: [], errors: [], warnings: [], needsAuthorization: [] };
  if (!isObj(raw)) {
    out.errors.push({ path: '', message: 'file must contain a JSON object' });
    return out;
  }
  if (raw.schema !== PACK_SCHEMA_ID) {
    out.errors.push({ path: 'schema', message: `expected schema "${PACK_SCHEMA_ID}"` });
    return out;
  }
  const header = validateHeader(raw, out.errors, out.warnings);
  if (!Array.isArray(raw.spots) || raw.spots.length === 0) {
    out.errors.push({ path: 'spots', message: 'at least one spot required' });
    return out;
  }
  if (!header) return out;
  out.header = header;

  const ids = new Set<string>();
  const signatures = new Set<string>();
  raw.spots.forEach((s, i) => {
    const path = `spots[${i}]`;
    if (!isObj(s) || !isStr(s.id)) {
      out.errors.push({ path, message: 'spot with an id required' });
      return;
    }
    if (ids.has(s.id)) {
      out.errors.push({ path: `${path}.id`, message: `duplicate spot id "${s.id}"` });
      return;
    }
    ids.add(s.id);
    for (const k of ['format', 'sizing', 'rake', 'source', 'verification', 'mode']) {
      if (k in s) out.errors.push({ path: `${path}.${k}`, message: 'set at pack level only (spots inherit pack parameters)' });
    }
    if (!SPOT_FAMILIES.includes(s.family as never)) {
      out.errors.push({ path: `${path}.family`, message: `unknown family (${SPOT_FAMILIES.join(', ')})` });
      return;
    }
    if (!isPosition(s.hero)) {
      out.errors.push({ path: `${path}.hero`, message: 'invalid hero position' });
      return;
    }
    const signature = `${s.family}|${s.hero}|${JSON.stringify(s.history)}`;
    if (signatures.has(signature)) out.errors.push({ path, message: 'two spots describe the same situation' });
    signatures.add(signature);

    // Validate the raw (possibly mixed) frequencies with the existing spot rules, as a Pro spot.
    const rawHands = isObj(s.hands) ? (s.hands as HandMap) : {};
    const asPro = validateSpot(
      {
        id: `${header.id}${PACK_ID_SEP}${s.id}`,
        name: isStr(s.name) ? s.name : `${s.hero} — Open (RFI)`,
        family: s.family,
        mode: 'pro',
        format: { game: 'NLHE', tableSize: header.format.tableSize, stackBb: header.format.stackBb, ...(header.format.tableType ? { tableType: header.format.tableType } : {}) },
        hero: s.hero,
        villains: s.villains,
        history: s.history,
        sizing: header.sizing,
        rake: {
          modelId: `${header.id}@source`,
          percent: header.sourceParameters.rakePercent,
          capBb: header.sourceParameters.rakeCapBb,
          noFlopNoDrop: header.sourceParameters.noFlopNoDrop,
          description: 'Rake assumed by the source (null = unknown)',
        },
        source: header.source,
        verification: header.transcription.status === 'checked' ? 'verified' : 'unverified',
        actions: s.actions,
        hands: rawHands,
        ...(isStr(s.notes) ? { notes: s.notes } : {}),
      },
      `${path}.`,
    );
    // Pack-level concerns are reported once, on the header, not per spot.
    const perSpot = (i: Issue) => !/\.(rake\.|verification$)/.test(i.path);
    out.errors.push(...asPro.errors);
    out.warnings.push(...asPro.warnings.filter(perSpot));
    if (!asPro.spot) return;

    if (s.family === 'RFI') checkRfi(path, s.hero, s.villains, s.history, asPro.spot.actions, header, out.errors);

    const missing = ALL_HANDS.filter((h) => !asPro.spot!.hands[h]);
    if (header.transcription.status === 'checked' && missing.length > 0) {
      out.errors.push({ path: `${path}.hands`, message: `${missing.length} hand(s) missing: a checked transcription needs all 169 hands, folds included` });
    }

    const { hands, simplified } = deriveStandard(asPro.spot.hands, asPro.spot.actions, header.strategy.tieBreak);
    out.spots.push({
      ...asPro.spot,
      mode: 'standard',
      hands,
      pack: { header, spotId: s.id, sourceHands: asPro.spot.hands, simplifiedHands: simplified },
    });
  });

  if (out.errors.length) {
    out.spots = [];
    return out;
  }
  if (header.source.proprietary && !header.source.authorizedByUser) out.needsAuthorization.push(...out.spots.map((s) => s.id));
  return out;
}

/** Rebuilds the v2 pack file from its expanded spots (original frequencies, not the Standard view). */
export function exportPack(spots: readonly RangeSpot[]): string {
  // Stable, readable order: by family, then preflop position (UTG → BB).
  const packSpots = spots
    .filter((s) => s.pack)
    .sort((a, b) => SPOT_FAMILIES.indexOf(a.family) - SPOT_FAMILIES.indexOf(b.family) || POSITIONS.indexOf(a.hero) - POSITIONS.indexOf(b.hero));
  const header = packSpots[0]?.pack?.header;
  if (!header) throw new Error('No pack spot to export');
  if (packSpots.some((s) => s.pack!.header.id !== header.id)) throw new Error('Spots belong to different packs');
  return JSON.stringify(
    {
      schema: PACK_SCHEMA_ID,
      pack: header,
      spots: packSpots.map((s) => ({
        id: s.pack!.spotId,
        name: s.name,
        family: s.family,
        hero: s.hero,
        villains: s.villains,
        history: s.history,
        actions: s.actions,
        hands: s.pack!.sourceHands,
        ...(s.notes ? { notes: s.notes } : {}),
      })),
    },
    null,
    2,
  );
}

export function packIdOf(spot: RangeSpot): string | undefined {
  return spot.pack?.header.id;
}
