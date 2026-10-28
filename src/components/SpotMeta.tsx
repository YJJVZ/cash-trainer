import type { ReactNode } from 'react';
import { describeHistory } from '../ranges/describe';
import { COMPATIBILITY_LABELS, TARGET_ENV, assessCompatibility } from '../ranges/target';
import { VERIFICATION_LABELS, type RangeSpot } from '../ranges/types';
import { Badge } from './Card';

const n = (x: number | undefined | null, unit = ' BB') => (x === undefined || x === null ? '—' : `${x}${unit}`);

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 py-1.5 border-b border-border last:border-0">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="text-sm min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function VerificationBadge({ spot }: { spot: RangeSpot }) {
  const tone = spot.verification === 'demo' ? 'demo' : spot.verification === 'verified' ? 'ok' : spot.verification === 'unverified' ? 'warn' : 'neutral';
  return <Badge tone={tone}>{VERIFICATION_LABELS[spot.verification]}</Badge>;
}

/** Full spot metadata: format, positions, history, sizings, rake, source. */
export function SpotMeta({ spot }: { spot: RangeSpot }) {
  const f = spot.format;
  return (
    <dl>
      <Row k="Format">
        <span className="num">{f.game} {f.tableSize}-max · {f.stackBb} BB</span>
        {(f.site || f.stakes) && <div className="text-xs text-muted">{[f.site, f.stakes, f.tableType].filter(Boolean).join(' · ')}</div>}
      </Row>
      <Row k="Positions">
        <span className="num">{spot.hero}</span> <span className="text-muted">vs</span> <span className="num">{spot.villains.join(', ')}</span>
      </Row>
      <Row k="History">
        <span className="text-muted">{describeHistory(spot.history).join(' · ') || 'First to act'}</span>
      </Row>
      <Row k="Sizings">
        <span className="num text-xs">
          RFI {n(spot.sizing.rfiBb)} · SB {n(spot.sizing.sbRfiBb)} · 3b IP {n(spot.sizing.threeBetIpBb)} · 3b OOP {n(spot.sizing.threeBetOopBb)} · 4b {n(spot.sizing.fourBetBb)}
        </span>
        <div className="text-xs text-faint num">{spot.sizing.profileId}</div>
      </Row>
      <Row k="Rake">
        <span className="num">{n(spot.rake.percent, '%')} · cap {n(spot.rake.capBb)}</span>
        <span className="text-muted text-xs"> · {spot.rake.noFlopNoDrop === null ? 'no-flop-no-drop unknown' : spot.rake.noFlopNoDrop ? 'no flop no drop' : 'preflop rake'}</span>
        {spot.rake.description && <div className="text-xs text-faint">{spot.rake.description}</div>}
      </Row>
      <Row k="Source">
        {spot.source.name}
        <div className="text-xs text-faint">
          {[spot.source.author, spot.source.license, spot.source.proprietary ? 'proprietary' : null].filter(Boolean).join(' · ')}
        </div>
      </Row>
      <Row k="Status"><VerificationBadge spot={spot} /> <span className="text-xs text-faint ml-1">{spot.mode === 'pro' ? 'Pro mode' : 'Standard mode'}</span></Row>
      {spot.notes && <Row k="Notes"><span className="text-muted">{spot.notes}</span></Row>}
      {spot.pack && <PackRows spot={spot} />}
    </dl>
  );
}

/** Pack provenance: transcription check and target compatibility are reported separately. */
function PackRows({ spot }: { spot: RangeSpot }) {
  const { header, simplifiedHands } = spot.pack!;
  const t = header.transcription;
  const compat = assessCompatibility(header);
  const tone = { match: 'text-ok', mismatch: 'text-err', unknown: 'text-faint' } as const;
  return (
    <>
      <Row k="Pack">
        {header.name} <span className="text-faint num">v{header.version}</span>
        <div className="text-xs text-faint num">{header.id}</div>
      </Row>
      <Row k="Transcription">
        {t.status === 'checked' ? (
          <span className="text-ok">Checked against the source</span>
        ) : (
          <span className="text-warn">Not checked against the source</span>
        )}
        {t.status === 'checked' && <div className="text-xs text-faint">{[t.checkedBy, t.checkedAt, t.method].filter(Boolean).join(' · ')}</div>}
      </Row>
      <Row k="Target fit">
        <span className={compat.overall === 'compatible' ? 'text-ok' : compat.overall === 'incompatible' ? 'text-err' : 'text-warn'}>
          {COMPATIBILITY_LABELS[compat.overall]}
        </span>
        <div className="text-xs text-faint">Parameter check vs {TARGET_ENV.site} {TARGET_ENV.stakes}, not a claim of optimality.</div>
        <ul className="mt-1 text-xs num space-y-0.5">
          {compat.items.map((i) => (
            <li key={i.key} className={tone[i.status]}>
              {i.label}: {i.source} <span className="text-faint">(target {i.target})</span>
            </li>
          ))}
        </ul>
        {header.compatibilityNote && <div className="mt-1 text-xs text-muted">{header.compatibilityNote}</div>}
      </Row>
      <Row k="Standard">
        <span className="text-muted">Majority action{header.strategy.tieBreak ? `, ties: ${header.strategy.tieBreak.join(' > ')}` : ', ties: action order'}</span>
        <div className="text-xs text-faint">{simplifiedHands.length} mixed hand(s) simplified · source frequencies kept</div>
      </Row>
    </>
  );
}
