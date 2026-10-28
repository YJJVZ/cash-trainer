import type { RangeSpot } from './types';

export interface ConsistencyWarning {
  kind: 'sizing' | 'rake' | 'stack' | 'format' | 'demo-mix' | 'pack';
  message: string;
  values: string[];
}

function distinct<T>(spots: RangeSpot[], key: (s: RangeSpot) => T): T[] {
  return [...new Set(spots.map(key))];
}

/**
 * Detects mixing of incompatible solutions (sizings, rake, depth, format).
 * Mixing is allowed but must be flagged to the user.
 */
export function checkConsistency(spots: RangeSpot[]): ConsistencyWarning[] {
  if (spots.length < 2) return [];
  const out: ConsistencyWarning[] = [];

  const sizings = distinct(spots, (s) => s.sizing.profileId);
  if (sizings.length > 1)
    out.push({ kind: 'sizing', message: 'These spots use different sizing profiles.', values: sizings });

  const packs = distinct(spots.filter((s) => s.pack), (s) => `${s.pack!.header.id} v${s.pack!.header.version}`);
  if (packs.length > 1 || (packs.length === 1 && spots.some((s) => !s.pack && s.verification !== 'demo')))
    out.push({ kind: 'pack', message: 'These spots come from different range sources.', values: packs.length ? packs : ['loose spots'] });

  const rakes = distinct(spots, (s) => `${s.rake.modelId} (${s.rake.percent ?? '?'} %, cap ${s.rake.capBb ?? '?'} BB)`);
  if (rakes.length > 1)
    out.push({ kind: 'rake', message: 'These spots are based on different rake models.', values: rakes });

  const stacks = distinct(spots, (s) => `${s.format.stackBb} BB`);
  if (stacks.length > 1) out.push({ kind: 'stack', message: 'Different stack depths.', values: stacks });

  const formats = distinct(spots, (s) => `${s.format.tableSize}-max ${s.format.site ?? ''} ${s.format.stakes ?? ''}`.trim());
  if (formats.length > 1) out.push({ kind: 'format', message: 'Different game formats.', values: formats });

  const demo = spots.some((s) => s.verification === 'demo');
  const real = spots.some((s) => s.verification !== 'demo');
  if (demo && real)
    out.push({
      kind: 'demo-mix',
      message: 'Fictional demo spots are mixed with real ranges.',
      values: ['demo', 'others'],
    });

  return out;
}
