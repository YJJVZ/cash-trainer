import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Card, Panel, Stat } from '../components/Card';
import { PageHeader } from '../components/Layout';
import { Meter } from '../components/Meter';
import { Tabs } from '../components/Tabs';
import { POSITIONS } from '../engine/positions';
import { shortName } from '../ranges/describe';
import { FAMILY_LABELS, SPOT_FAMILIES } from '../ranges/types';
import { useStore } from '../state/store';
import { byFamily, byPosition, bySpot, currentStreak, dailyActivity, tally, type Tally } from '../stats/aggregate';
import { MAX_BOX, boxDistribution, dueItems } from '../stats/srs';

type TabId = 'positions' | 'spots' | 'families';

const pct = (x: number) => `${Math.round(x * 100)}%`;

function TallyTable({ rows, label }: { rows: { key: string; name: string; t?: Tally; link?: string }[]; label: string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-2xs uppercase tracking-[0.1em] text-muted text-left border-b border-border">
          <th className="font-medium py-2.5 px-4">{label}</th>
          <th className="font-medium py-2.5 px-4 text-right w-16">Hands</th>
          <th className="font-medium py-2.5 px-4 text-right w-20 hidden sm:table-cell">Mistakes</th>
          <th className="font-medium py-2.5 px-4 w-[40%]">Accuracy</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, name, t, link }) => (
          <tr key={key} className="border-b border-border last:border-0">
            <td className="py-2.5 px-4 min-w-0">{link ? <Link to={link} className="hover:text-brand">{name}</Link> : name}</td>
            <td className="py-2.5 px-4 text-right num text-muted">{t?.total ?? 0}</td>
            <td className="py-2.5 px-4 text-right num text-muted hidden sm:table-cell">{t ? t.wrong + t.partial : 0}</td>
            <td className="py-2.5 px-4">
              {t && t.total > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="num w-10 text-right">{pct(t.accuracy)}</span>
                  <Meter value={t.accuracy} />
                </div>
              ) : (
                <span className="text-faint">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StatsPage() {
  const { answers, srs, spotById } = useStore();
  const [params] = useSearchParams();
  const initialTab = params.get('tab');
  const [tab, setTab] = useState<TabId>(initialTab === 'spots' || initialTab === 'families' ? initialTab : 'positions');
  const total = useMemo(() => tally(answers), [answers]);
  const days = useMemo(() => dailyActivity(answers, 14), [answers]);
  const maxDay = Math.max(1, ...days.map((d) => d.total));
  const due = dueItems(srs, Date.now());
  const boxes = boxDistribution(srs);

  // Mistake history and memory boxes now live on the "My mistakes" screen.
  if (initialTab === 'errors' || initialTab === 'srs') return <Navigate to="/mistakes" replace />;

  return (
    <div>
      <PageHeader title="Progress" meta={<span className="num">{answers.length} answers recorded</span>} />

      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-6 space-y-5">
        <Card className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border overflow-hidden">
          <div className="bg-surface p-4"><Stat label="Hands" value={total.total} /></div>
          <div className="bg-surface p-4"><Stat label="Accuracy" value={total.total ? pct(total.accuracy) : '—'} sub={`${total.correct} right · ${total.wrong} wrong`} /></div>
          <div className="bg-surface p-4"><Stat label="Current streak" value={currentStreak(answers)} /></div>
          <Link to="/mistakes" className="bg-surface p-4 hover:bg-surface-2 transition-colors">
            <Stat label="Due for review" value={due.length} sub={`${srs.length} tracked · ${boxes[MAX_BOX]} mastered`} tone={due.length ? 'err' : undefined} />
          </Link>
        </Card>

        <Panel title="Activity" meta="last 14 days">
          <div className="flex items-end gap-1 sm:gap-1.5 h-28" role="img" aria-label="Answers per day over 14 days">
            {days.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end h-full" title={`${d.total} answers · ${Math.round(d.accuracy * 100)}%`}>
                <div className="rounded-t-[3px] overflow-hidden flex flex-col justify-end" style={{ height: `${(d.total / maxDay) * 100}%`, minHeight: d.total ? 3 : 0 }}>
                  <div className="bg-err/80" style={{ height: `${d.total ? ((d.total - d.correct) / d.total) * 100 : 0}%` }} />
                  <div className="bg-ok flex-1" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1.5 text-2xs text-faint num"><span>D-13</span><span>today</span></div>
          <div className="flex gap-4 mt-2 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px] bg-ok" />Correct</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px] bg-err/80" />Wrong</span>
          </div>
        </Panel>

        <Card>
          <Tabs<TabId>
            className="px-1"
            value={tab}
            onChange={setTab}
            items={[
              { id: 'positions', label: 'Positions' },
              { id: 'spots', label: 'Spots' },
              { id: 'families', label: 'Families' },
            ]}
          />
          {answers.length === 0 ? (
            <p className="p-4 text-sm text-muted">No answers yet. <Link to="/train" className="text-text underline">Play a few hands</Link>.</p>
          ) : tab === 'positions' ? (
            <TallyTable label="Position" rows={POSITIONS.map((p) => ({ key: p, name: p, t: byPosition(answers).get(p) }))} />
          ) : tab === 'spots' ? (
            <TallyTable
              label="Spot"
              rows={[...bySpot(answers)].map(([id, t]) => ({
                key: id,
                name: spotById(id) ? shortName(spotById(id)!.name) : `${id} (deleted)`,
                t,
                link: spotById(id) ? `/ranges?spot=${id}` : undefined,
              }))}
            />
          ) : (
            <TallyTable label="Family" rows={SPOT_FAMILIES.map((f) => ({ key: f, name: FAMILY_LABELS[f], t: byFamily(answers).get(f) }))} />
          )}
        </Card>
      </div>
    </div>
  );
}
