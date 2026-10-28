import { ALL_HANDS, combosPerKind, handKind, normalizeHand, TOTAL_COMBOS } from '../engine/hands';
import { parseCsvRows } from './io';
import { validatePackFile, type PackValidation } from './pack';
import { assessCompatibility, COMPATIBILITY_LABELS } from './target';
import type { HandMap } from './types';
import type { Issue } from './validation';

/**
 * Reads a hand table ("hand,<actionId>,…" + one row per hand) into a hand map.
 * Empty row = not provided; empty cell in a filled row = 0. Accepts "," or ";" and decimal commas.
 */
export function csvToHands(text: string): { hands: HandMap; errors: Issue[] } {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#')) ?? '';
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows = parseCsvRows(clean, delimiter).filter((r) => !r[0]?.trim().startsWith('#'));
  const errors: Issue[] = [];
  const head = rows[0]?.map((h) => h.trim());
  if (!head || head[0]?.toLowerCase() !== 'hand') return { hands: {}, errors: [{ path: 'csv', message: 'missing "hand,<action>,…" header' }] };
  const ids = head.slice(1);
  const hands: HandMap = {};
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const hand = normalizeHand(r[0] ?? '');
    if (!hand) return void errors.push({ path: `csv:line ${line}`, message: `unreadable hand "${r[0]}"` });
    if (hands[hand]) return void errors.push({ path: `csv:line ${line}`, message: `duplicate hand ${hand}` });
    const cells = ids.map((_, j) => (r[j + 1] ?? '').trim());
    if (cells.every((c) => c === '')) return;
    const strat: Record<string, number> = {};
    cells.forEach((c, j) => {
      const v = c === '' ? 0 : Number(c.replace(',', '.'));
      if (Number.isNaN(v)) errors.push({ path: `csv:line ${line}`, message: `unreadable frequency "${c}"` });
      else if (v > 0) strat[ids[j]!] = v;
    });
    if (Object.keys(strat).length === 0) errors.push({ path: `csv:line ${line}`, message: `${hand}: all frequencies are 0 (leave the row empty if unknown)` });
    else hands[hand] = strat;
  });
  return { hands, errors };
}

/**
 * Fills spots of a raw pack file with CSV hand tables, by pack spot id. Returns a new object.
 * Only the spots given a table are kept, so a pack can hold a single position. A `limp` action no hand uses is dropped.
 */
export function mergeCsvIntoPack(rawPack: unknown, tables: Record<string, string>): { pack: unknown; errors: Issue[] } {
  const pack = structuredClone(rawPack) as { spots?: { id: string; actions?: { id: string; kind: string }[]; hands: HandMap }[] };
  const errors: Issue[] = [];
  for (const [spotId, csv] of Object.entries(tables)) {
    const spot = pack.spots?.find((s) => s.id === spotId);
    if (!spot) {
      errors.push({ path: spotId, message: 'no spot with this id in the pack' });
      continue;
    }
    const r = csvToHands(csv);
    errors.push(...r.errors.map((e) => ({ ...e, path: `${spotId} ${e.path}` })));
    spot.hands = r.hands;
    const used = new Set(Object.values(r.hands).flatMap((s) => Object.keys(s ?? {})));
    if (spot.actions) spot.actions = spot.actions.filter((a) => a.kind !== 'limp' || used.has(a.id));
  }
  if (pack.spots) pack.spots = pack.spots.filter((s) => s.id in tables);
  return { pack, errors };
}

export interface SpotReport {
  id: string;
  hero: string;
  provided: number;
  missing: number;
  simplified: number;
  /** % of the 1,326 combos per action: Standard view and original source frequencies. */
  standardPct: Record<string, number>;
  sourcePct: Record<string, number>;
}

function pct(hands: HandMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of ALL_HANDS) {
    const s = hands[h];
    if (!s) continue;
    for (const [id, f] of Object.entries(s)) out[id] = (out[id] ?? 0) + (f * combosPerKind(handKind(h))) / TOTAL_COMBOS;
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v * 1000) / 10]));
}

export function packReport(v: PackValidation): SpotReport[] {
  return v.spots.map((s) => ({
    id: s.id,
    hero: s.hero,
    provided: Object.keys(s.hands).length,
    missing: 169 - Object.keys(s.hands).length,
    simplified: s.pack?.simplifiedHands.length ?? 0,
    standardPct: pct(s.hands),
    sourcePct: pct(s.pack?.sourceHands ?? {}),
  }));
}

/** Human-readable check report (used by `npm run ranges -- check`). */
export function formatCheck(raw: unknown): { text: string; ok: boolean } {
  const v = validatePackFile(raw);
  const lines: string[] = [];
  if (v.header) {
    const h = v.header;
    const c = assessCompatibility(h);
    lines.push(`Pack ${h.id} v${h.version} — ${h.name}`);
    lines.push(`Source: ${h.source.name} (${h.source.kind}${h.source.proprietary ? ', proprietary' : ''})`);
    lines.push(`Transcription: ${h.transcription.status}${h.transcription.status === 'checked' ? ` by ${h.transcription.checkedBy} on ${h.transcription.checkedAt}` : ''}`);
    lines.push(`Target fit: ${COMPATIBILITY_LABELS[c.overall]} (parameter check only)`);
    for (const i of c.items) lines.push(`  ${i.status.padEnd(8)} ${i.label}: ${i.source} (target ${i.target})`);
  }
  for (const r of packReport(v)) {
    const fmt = (p: Record<string, number>) => Object.entries(p).map(([k, x]) => `${k} ${x}%`).join(', ');
    lines.push(`${r.id}: ${r.provided}/169 hands${r.missing ? `, ${r.missing} not provided` : ''}${r.simplified ? `, ${r.simplified} mixed simplified` : ''}`);
    lines.push(`  standard: ${fmt(r.standardPct)}${r.simplified ? `\n  source:   ${fmt(r.sourcePct)}` : ''}`);
  }
  for (const e of v.errors) lines.push(`ERROR   ${e.path}: ${e.message}`);
  for (const w of v.warnings) lines.push(`warning ${w.path}: ${w.message}`);
  if (v.needsAuthorization.length) lines.push('warning: proprietary pack — authorization must be confirmed at import');
  lines.push(v.errors.length ? `✗ ${v.errors.length} error(s)` : '✓ valid');
  return { text: lines.join('\n'), ok: v.errors.length === 0 };
}

export interface HandChange {
  spotId: string;
  hand: string;
  before: string;
  after: string;
}

/** Hand-level differences between two pack files (original frequencies). */
export function diffPacks(oldRaw: unknown, newRaw: unknown): HandChange[] {
  const get = (raw: unknown) =>
    new Map(((raw as { spots?: { id: string; hands?: HandMap }[] }).spots ?? []).map((s) => [s.id, s.hands ?? {}]));
  const a = get(oldRaw);
  const b = get(newRaw);
  const show = (s: HandMap[string]) => (s ? Object.entries(s).map(([k, v]) => `${k}:${v}`).join(' ') : 'not provided');
  const out: HandChange[] = [];
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id) ?? {};
    const y = b.get(id) ?? {};
    for (const h of ALL_HANDS) {
      if (JSON.stringify(x[h] ?? null) !== JSON.stringify(y[h] ?? null)) out.push({ spotId: id, hand: h, before: show(x[h]), after: show(y[h]) });
    }
  }
  return out;
}
