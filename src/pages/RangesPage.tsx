import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { buttonClass } from '../components/Button';
import { Card, Panel } from '../components/Card';
import { PageHeader } from '../components/Layout';
import { Legend, RangeGrid } from '../components/RangeGrid';
import { SpotMeta, VerificationBadge } from '../components/SpotMeta';
import { Tabs } from '../components/Tabs';
import { combosPerKind, handKind, type HandClass } from '../engine/hands';
import { POSITIONS } from '../engine/positions';
import { analyzeSpot } from '../ranges/analysis';
import { isBundledSpot } from '../ranges/bundled';
import { editableInPlace } from '../ranges/edit';
import { FAMILY_LABELS, SPOT_FAMILIES, type RangeSpot, type SpotFamily } from '../ranges/types';
import { validateSpot } from '../ranges/validation';
import { useStore } from '../state/store';
import { spotColors } from '../ui/colors';
import { cx } from '../ui/cx';

export function RangesPage() {
  const { spots } = useStore();
  const [params, setParams] = useSearchParams();
  const current = spots.find((s) => s.id === params.get('spot')) ?? spots[0];
  const [family, setFamily] = useState<SpotFamily>(current?.family ?? 'RFI');
  const [selected, setSelected] = useState<HandClass | undefined>();
  const [hover, setHover] = useState<HandClass | undefined>();

  const select = (s: RangeSpot) => {
    setParams({ spot: s.id }, { replace: true });
    setSelected(undefined);
  };

  const inFamily = spots.filter((s) => s.family === family);
  const spot = current && current.family === family ? current : inFamily[0];

  if (!spot) {
    return (
      <div>
        <PageHeader title="Ranges" />
        <Card className="m-4 md:m-6 p-4 text-muted">
          No range loaded. <Link to="/settings?tab=library" className="text-text underline">Import ranges in Settings</Link>.
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Ranges" meta={<span className="truncate">{spot.name}</span>}>
        <Link to={`/ranges/edit/${spot.id}`} className={buttonClass('secondary', 'md')}>{editableInPlace(spot) ? 'Edit' : 'Edit a copy'}</Link>
        <Link to="/train" className={buttonClass('primary', 'md')}>Play</Link>
      </PageHeader>
      <Tabs
        className="px-2 md:px-6"
        items={SPOT_FAMILIES.map((f) => ({ id: f, label: FAMILY_LABELS[f], count: spots.filter((s) => s.family === f).length }))}
        value={family}
        onChange={(f) => {
          setFamily(f);
          const first = spots.find((s) => s.family === f);
          if (first) select(first);
        }}
      />
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-6 grid gap-5 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] items-start">
        <div className="space-y-3 min-w-0">
          <SpotPicker spots={inFamily} value={spot} onChange={select} />
          <Card className="p-3 sm:p-4">
            <RangeGrid spot={spot} selected={selected} onSelect={setSelected} onHover={setHover} />
            <div className="mt-3">
              <Legend spot={spot} combos={analyzeSpot(spot).combosByAction} total={analyzeSpot(spot).definedCombos} />
            </div>
          </Card>
        </div>
        <SidePanels spot={spot} hand={hover ?? selected} />
      </div>
    </div>
  );
}

function SpotPicker({ spots, value, onChange }: { spots: RangeSpot[]; value: RangeSpot; onChange: (s: RangeSpot) => void }) {
  const ordered = [...spots].sort((a, b) => POSITIONS.indexOf(a.hero) - POSITIONS.indexOf(b.hero) || a.name.localeCompare(b.name));
  return (
    <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Spots">
      {ordered.map((s) => {
        const on = s.id === value.id;
        // Same situation from several sources: show where each one comes from.
        const others = ordered.filter((o) => o.hero === s.hero && o.villains.join() === s.villains.join()).length > 1;
        return (
          <button
            key={s.id}
            role="option"
            aria-selected={on}
            onClick={() => onChange(s)}
            title={s.name}
            className={cx(
              'h-11 px-3.5 rounded-game border-2 font-display font-bold text-[16px] uppercase tracking-[0.05em] transition-colors duration-100',
              on ? 'bg-surface-3 border-brand text-text' : 'bg-surface border-border text-muted hover:text-text hover:border-border-strong',
            )}
          >
            {s.hero}
            {s.villains.length === 1 && s.family !== 'RFI' ? <span className="text-faint"> v {s.villains[0]}</span> : null}
            {others ? <span className="text-faint"> · {s.mode === 'pro' ? 'mixed' : isBundledSpot(s) ? 'estimate' : s.source.name.slice(0, 16)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function SidePanels({ spot, hand }: { spot: RangeSpot; hand?: HandClass }) {
  const a = useMemo(() => analyzeSpot(spot), [spot]);
  const warnings = useMemo(() => validateSpot(spot).warnings, [spot]);
  const colors = spotColors(spot);
  const strat = hand ? spot.hands[hand] : undefined;
  return (
    <div className="space-y-4 min-w-0">
      <Panel title="Hand" meta={hand ? `${hand} · ${combosPerKind(handKind(hand))} combos` : 'hover or tap a cell'}>
        {!hand ? (
          <p className="text-sm text-faint">No hand selected.</p>
        ) : !strat ? (
          <p className="text-sm text-muted">
            <span className="text-text font-medium">{hand}</span> is not provided in this spot. It is not a fold: the data is missing.
          </p>
        ) : (
          <ul className="space-y-2">
            {spot.actions.map((act) => {
              const f = strat[act.id] ?? 0;
              return (
                <li key={act.id} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-2">
                  <div className="min-w-0">
                    <div className={cx('text-sm', f > 0 ? 'text-text' : 'text-faint')}>{act.label}</div>
                    <div className="h-1.5 mt-1 bg-surface-2 rounded-[1px] overflow-hidden">
                      <div className="h-full" style={{ width: `${f * 100}%`, background: colors[act.id] }} />
                    </div>
                  </div>
                  <span className={cx('num text-sm text-right', f > 0 ? 'text-text' : 'text-faint')}>{Math.round(f * 100)}%</span>
                </li>
              );
            })}
          </ul>
        )}
        {hand && spot.pack?.simplifiedHands.includes(hand) && (
          <p className="mt-3 text-xs text-muted">
            Source frequencies:{' '}
            <span className="num text-text">
              {Object.entries(spot.pack.sourceHands[hand] ?? {}).map(([id, f]) => `${spot.actions.find((a) => a.id === id)?.label ?? id} ${Math.round(f * 1000) / 10}%`).join(' · ')}
            </span>{' '}
            (Standard keeps the majority action)
          </p>
        )}
      </Panel>

      <Panel title="Breakdown" meta={`${a.definedCombos} / 1326 combos`}>
        <table className="w-full text-sm">
          <tbody>
            {spot.actions.map((act) => {
              const c = a.combosByAction[act.id] ?? 0;
              return (
                <tr key={act.id} className="border-b border-border last:border-0">
                  <td className="py-1.5">
                    <span className="inline-block w-2 h-2 mr-2 rounded-[1px]" style={{ background: colors[act.id] }} />
                    {act.label}
                  </td>
                  <td className="py-1.5 text-right num text-muted">{c.toFixed(c % 1 ? 1 : 0)}</td>
                  <td className="py-1.5 pl-3 text-right num w-16">{a.definedCombos ? ((100 * c) / a.definedCombos).toFixed(1) : '0.0'}%</td>
                </tr>
              );
            })}
            {a.missingCombos > 0 && (
              <tr>
                <td className="py-1.5 text-muted">Not provided</td>
                <td className="py-1.5 text-right num text-faint">{a.missingCombos}</td>
                <td className="py-1.5 pl-3 text-right num text-faint whitespace-nowrap">{a.missingHands.length} hands</td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <Panel title="Spot" actions={<VerificationBadge spot={spot} />}>
        <SpotMeta spot={spot} />
        {warnings.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-warn">
            {warnings.map((w, i) => <li key={i}>{w.path} : {w.message}</li>)}
          </ul>
        )}
      </Panel>
    </div>
  );
}
