import { ALL_HANDS, normalizeHand } from '../engine/hands';
import { validatePackFile } from './pack';
import { toLibrary, validateLibrary, validateSpot, type Issue, type LibraryValidation } from './validation';
import { PACK_SCHEMA_ID, type RangeSpot } from './types';

// ---------- JSON ----------

export function exportJson(spots: RangeSpot[], name?: string): string {
  return JSON.stringify(toLibrary(spots, name), null, 2);
}

export function importJson(text: string): LibraryValidation {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return {
      spots: [],
      errors: [{ path: '', message: `Invalid JSON: ${(e as Error).message}` }],
      warnings: [],
      needsAuthorization: [],
    };
  }
  // v2 range pack, or v1 library snapshot (backward compatible).
  if (typeof raw === 'object' && raw !== null && (raw as { schema?: unknown }).schema === PACK_SCHEMA_ID) {
    const { spots, errors, warnings, needsAuthorization } = validatePackFile(raw);
    return { spots, errors, warnings, needsAuthorization };
  }
  return validateLibrary(raw);
}

// ---------- CSV ----------
// Format (one spot per file):
//   #meta,"{…spot JSON metadata, without hands…}"
//   hand,fold,call,raise
//   AA,0,0,1
// A hand missing from the table (or an entirely empty row) stays NOT PROVIDED.

const META_TAG = '#meta';

function csvEscape(v: string): string {
  return /[",;\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

function detectDelimiter(text: string): string {
  const header = text.split(/\r?\n/).find((l) => l.trim() && !l.startsWith(META_TAG)) ?? '';
  return header.includes(';') && !header.includes(',') ? ';' : ',';
}

export function exportCsv(spot: RangeSpot): string {
  // CSV is a loose single-spot format: pack provenance is only exported with the v2 pack file.
  const { hands, pack: _pack, ...meta } = spot;
  const ids = spot.actions.map((a) => a.id);
  const lines = [`${META_TAG},${csvEscape(JSON.stringify(meta))}`, ['hand', ...ids].join(',')];
  for (const hand of ALL_HANDS) {
    const s = hands[hand];
    if (!s) continue;
    lines.push([hand, ...ids.map((id) => String(s[id] ?? 0))].join(','));
  }
  return lines.join('\n') + '\n';
}

export interface CsvImportResult {
  spot: RangeSpot | null;
  errors: Issue[];
  warnings: Issue[];
  needsAuthorization: boolean;
}

export function importCsv(text: string): CsvImportResult {
  const fail = (message: string): CsvImportResult => ({
    spot: null,
    errors: [{ path: 'csv', message }],
    warnings: [],
    needsAuthorization: false,
  });
  const delimiter = detectDelimiter(text);
  const rows = parseCsvRows(text.replace(/^﻿/, ''), delimiter);

  const metaRow = rows.find((r) => r[0]?.trim() === META_TAG);
  if (!metaRow) return fail(`missing "${META_TAG}" line: spot metadata (format, sizings, rake, source…) is required`);
  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(metaRow.slice(1).join(delimiter));
  } catch {
    return fail('unreadable JSON metadata on the #meta line');
  }

  const dataRows = rows.filter((r) => r !== metaRow);
  const header = dataRows[0]?.map((h) => h.trim());
  if (!header || header[0]?.toLowerCase() !== 'hand') return fail('missing "hand,<action>,…" header');
  const actionIds = header.slice(1);

  const errors: Issue[] = [];
  const hands: Record<string, Record<string, number>> = {};
  dataRows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const hand = normalizeHand(r[0] ?? '');
    if (!hand) {
      errors.push({ path: `csv:line ${line}`, message: `unreadable hand "${r[0]}"` });
      return;
    }
    if (hands[hand]) {
      errors.push({ path: `csv:line ${line}`, message: `duplicate hand ${hand}` });
      return;
    }
    const cells = actionIds.map((_, j) => (r[j + 1] ?? '').trim());
    if (cells.every((c) => c === '')) return; // empty row = not provided
    const strat: Record<string, number> = {};
    cells.forEach((cell, j) => {
      const v = cell === '' ? 0 : Number(delimiter === ';' ? cell.replace(',', '.') : cell);
      if (Number.isNaN(v)) errors.push({ path: `csv:line ${line}`, message: `unreadable frequency "${cell}"` });
      else strat[actionIds[j]!] = v;
    });
    hands[hand] = strat;
  });
  if (errors.length) return { spot: null, errors, warnings: [], needsAuthorization: false };

  const r = validateSpot({ ...meta, hands });
  return {
    ...r,
    needsAuthorization: !!r.spot && r.spot.source.proprietary && !r.spot.source.authorizedByUser,
  };
}
