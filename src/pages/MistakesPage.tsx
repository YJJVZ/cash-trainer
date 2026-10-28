import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Panel } from '../components/Card';
import { PageHeader } from '../components/Layout';
import { shortName } from '../ranges/describe';
import { useStore } from '../state/store';
import { errorHistory, worstHands } from '../stats/aggregate';
import { MAX_BOX, SRS_INTERVALS_MS, boxDistribution, dueItems } from '../stats/srs';
import { cx } from '../ui/cx';
import { recordLabels } from '../ui/records';

const interval = (ms: number) => (ms < 3_600_000 ? `${ms / 60_000} min` : ms < 86_400_000 ? `${ms / 3_600_000} h` : `${ms / 86_400_000} d`);

function bigLink(enabled: boolean, primary: boolean) {
  return cx(
    'inline-flex items-center justify-center gap-3 h-16 px-7 rounded-game select-none font-display font-extrabold text-[22px] sm:text-[24px] uppercase tracking-[0.07em] leading-none',
    'transition-[background-color,transform] duration-100 hover:-translate-y-px active:translate-y-px',
    'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-text',
    primary ? 'bg-brand text-brand-ink hover:bg-brand-hover shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)]' : 'bg-surface border border-border text-text hover:bg-surface-2',
    !enabled && 'opacity-40 pointer-events-none',
  );
}

export function MistakesPage() {
  const { answers, srs, spotById } = useStore();
  const now = Date.now();
  const due = dueItems(srs, now);
  const tracked = srs.filter((i) => i.box < MAX_BOX);
  const boxes = boxDistribution(srs);
  const worst = useMemo(() => worstHands(answers, 12), [answers]);
  const history = useMemo(() => errorHistory(answers, 100), [answers]);

  return (
    <div>
      <PageHeader title="My mistakes" meta={<span className="num">{history.length} recorded</span>} />

      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Call to action */}
        <section className="rounded-card border border-border bg-surface p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex-1 min-w-0">
            <div className="font-display font-extrabold text-[40px] sm:text-[48px] leading-none">{tracked.length}</div>
            <div className="mt-1 text-muted">
              hand{tracked.length === 1 ? '' : 's'} to work on{due.length ? <> · <span className="text-err">{due.length} due now</span></> : null}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/train?review=mistakes" className={bigLink(tracked.length > 0, true)} aria-disabled={!tracked.length}>
              Replay mistakes
            </Link>
            <Link to="/train?review=due" className={bigLink(due.length > 0, false)} aria-disabled={!due.length}>
              Due <span className="num text-lg text-muted">{due.length}</span>
            </Link>
          </div>
        </section>

        {/* Most missed hands, as cards */}
        <section>
          <h2 className="font-display font-bold text-xl uppercase tracking-[0.06em] mb-3">Most missed</h2>
          {worst.length === 0 ? (
            <p className="text-muted">No mistakes yet. <Link to="/train" className="text-text underline underline-offset-2">Play a few hands</Link>.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {worst.map((w) => {
                const spot = spotById(w.spotId);
                const strat = spot?.hands[w.hand];
                const best = spot && strat ? Object.entries(strat).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
                return (
                  <Link
                    key={`${w.spotId}|${w.hand}`}
                    to={spot ? `/ranges?spot=${w.spotId}` : '/mistakes'}
                    className="group rounded-card border border-border bg-surface p-4 hover:border-border-strong hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display font-extrabold text-[30px] leading-none">{w.hand}</span>
                      <span className="num text-xs text-err bg-err/10 border border-err/40 rounded-[3px] px-1.5 py-0.5">×{w.wrong + w.partial}</span>
                    </div>
                    <div className="mt-2 text-sm text-muted truncate">{shortName(spot?.name ?? w.spotId)}</div>
                    {spot && best && (
                      <div className="mt-2 text-xs text-faint">
                        Play: <span className="text-text font-medium">{spot.actions.find((a) => a.id === best)?.label}</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Spaced repetition boxes */}
        <Panel title="Memory boxes" meta="spaced repetition">
          <p className="text-sm text-muted mb-4">
            Every missed hand enters box 1. A correct answer moves it to the next box with a longer interval; a mistake sends it back to box 1.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {boxes.slice(1).map((count, i) => (
              <div key={i} className={cx('rounded-card border p-3 text-center', i + 1 === MAX_BOX ? 'border-ok/50' : 'border-border')}>
                <div className="text-2xs uppercase tracking-[0.12em] text-muted">{i + 1 === MAX_BOX ? 'Mastered' : `Box ${i + 1}`}</div>
                <div className="font-display font-extrabold text-[28px] leading-none mt-1.5">{count}</div>
                <div className="text-2xs text-faint num mt-1">{interval(SRS_INTERVALS_MS[i + 1]!)}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Full history */}
        <Panel title="History" meta={`${history.length} mistakes`} flush>
          {history.length === 0 ? (
            <p className="p-4 text-sm text-faint">Nothing here yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-2xs uppercase tracking-[0.1em] text-muted text-left border-b border-border">
                    <th className="font-medium py-2.5 px-4">Date</th>
                    <th className="font-medium py-2.5 px-4">Hand</th>
                    <th className="font-medium py-2.5 px-4">Spot</th>
                    <th className="font-medium py-2.5 px-4">Played</th>
                    <th className="font-medium py-2.5 px-4">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((e) => {
                    const l = recordLabels(e, spotById(e.spotId));
                    return (
                      <tr key={e.id} className="border-b border-border last:border-0">
                        <td className="py-2 px-4 num text-faint whitespace-nowrap">
                          {new Date(e.ts).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 px-4 num font-medium">{e.hand}</td>
                        <td className="py-2 px-4 text-muted">{l.spot}</td>
                        <td className="py-2 px-4 text-err">{l.chosen}</td>
                        <td className="py-2 px-4">{l.expected}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
