import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel } from '../components/Card';
import { BigActionButton, GameButton } from '../components/GameButton';
import { PageHeader } from '../components/Layout';
import { Legend, RangeGrid } from '../components/RangeGrid';
import { ToggleGroup } from '../components/Tabs';
import { ALL_HANDS, type HandClass } from '../engine/hands';
import { POSITIONS, POSITION_NAMES, type Position } from '../engine/positions';
import { cryptoRng } from '../engine/random';
import { drawGuessSpot, guessableSpots, rangePct, scoreGuess, type GuessCell } from '../quiz/rangeGuess';
import { formatPercent } from '../ranges/analysis';
import type { ActionOption, RangeSpot } from '../ranges/types';
import { useStore } from '../state/store';
import { useLocalSetting } from '../ui/useLocalSetting';

const OPENERS: Position[] = POSITIONS.filter((p) => p !== 'BB');

const PAINT_ACTIONS: ActionOption[] = [
  { id: 'fold', kind: 'fold', label: 'Fold' },
  { id: 'in', kind: 'raise', label: 'Your range' },
];

const DIFF_ACTIONS: ActionOption[] = [
  { id: 'hit', kind: 'raise', label: 'Correct' },
  { id: 'missed', kind: 'raise', label: 'Missed' },
  { id: 'extra', kind: 'raise', label: 'Too wide' },
  { id: 'fold', kind: 'fold', label: 'Fold' },
];
const DIFF_COLORS: Record<GuessCell, string> = {
  hit: 'var(--color-ok)',
  missed: 'var(--color-warn)',
  extra: 'var(--color-err)',
  fold: 'var(--color-act-fold)',
};

/** What the villain does with the hands to paint ("Open 2.5 BB", "Limp / Raise 3 BB"). */
function openText(spot: RangeSpot): string {
  return spot.actions.filter((a) => a.kind !== 'fold').map((a) => a.label).join(' / ');
}

export function GuessPage() {
  const { spots } = useStore();
  const [heroes, setHeroes] = useLocalSetting<Position[]>('guess.heroes', OPENERS);
  const pool = useMemo(() => guessableSpots(spots, heroes), [spots, heroes]);
  const [spotId, setSpotId] = useState<string | null>(null);
  const [guess, setGuess] = useState<Set<HandClass>>(() => new Set());
  const [revealed, setRevealed] = useState(false);

  const spot = pool.find((s) => s.id === spotId) ?? null;

  const next = useCallback(() => {
    if (!pool.length) return;
    setSpotId(drawGuessSpot(pool, cryptoRng, spotId ?? undefined).id);
    setGuess(new Set());
    setRevealed(false);
  }, [pool, spotId]);

  // Deal a first spot, or a new one when the position filter excludes the current one.
  useEffect(() => {
    if (!spot && pool.length) next();
  }, [spot, pool, next]);

  // Drag painting: the first cell of a stroke decides whether the stroke adds or removes hands.
  const strokeAdds = useRef<boolean | null>(null);
  useEffect(() => {
    const end = () => (strokeAdds.current = null);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);
  const onPaint = useCallback((hand: HandClass) => {
    setGuess((cur) => {
      if (strokeAdds.current === null) strokeAdds.current = !cur.has(hand);
      const out = new Set(cur);
      if (strokeAdds.current) out.add(hand);
      else out.delete(hand);
      return out;
    });
  }, []);

  const result = useMemo(() => (spot && revealed ? scoreGuess(spot, guess) : null), [spot, revealed, guess]);

  // Enter = check, then next spot.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || (e.target as HTMLElement).closest('input, textarea, select, button, a')) return;
      if (revealed) next();
      else setRevealed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, next]);

  const paintSpot = useMemo<RangeSpot | null>(
    () => spot && { ...spot, id: 'guess', actions: PAINT_ACTIONS, hands: Object.fromEntries(ALL_HANDS.map((h) => [h, { [guess.has(h) ? 'in' : 'fold']: 1 }])) },
    [spot, guess],
  );
  const diffSpot = useMemo<RangeSpot | null>(
    () => spot && result && { ...spot, id: 'guess-diff', actions: DIFF_ACTIONS, hands: Object.fromEntries(ALL_HANDS.map((h) => [h, { [result.cells[h]!]: 1 }])) },
    [spot, result],
  );

  return (
    <div>
      <PageHeader title="Read the range" meta="Villain opens: paint the range you put them on" />
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-5 space-y-5">
        <ToggleGroup label="Villain position" items={OPENERS.map((p) => ({ id: p, label: p }))} value={heroes} onChange={setHeroes} />

        {!spot || !paintSpot ? (
          <p className="text-sm text-muted">
            No complete opening range for these positions.{' '}
            <Link to="/settings?tab=library" className="underline underline-offset-2 hover:text-text">Manage ranges</Link>
          </p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] items-start">
            <section className="min-w-0 space-y-3" aria-label="Your estimate">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display font-bold text-xl uppercase tracking-[0.04em]">Villain {spot.hero}</h2>
                <span className="text-sm text-muted">
                  {spot.history.length ? 'Folded to the' : 'First to act,'} {POSITION_NAMES[spot.hero]}, who plays: {openText(spot)}
                </span>
              </div>
              {result && diffSpot ? (
                <>
                  <RangeGrid spot={diffSpot} colors={DIFF_COLORS} />
                  <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                    {DIFF_ACTIONS.filter((a) => a.id !== 'fold').map((a) => (
                      <li key={a.id} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-[1px]" style={{ background: DIFF_COLORS[a.id as GuessCell] }} />
                        <span className="text-text">{a.label}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <RangeGrid spot={paintSpot} onPaint={onPaint} />
                  <p className="text-sm text-muted">Tap or drag over the grid to add hands; start on a selected hand to remove.</p>
                </>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {revealed ? (
                  <BigActionButton label="Next spot" hint="↵" onClick={next} />
                ) : (
                  <>
                    <BigActionButton label="Check" hint="↵" onClick={() => setRevealed(true)} />
                    <GameButton onClick={() => setGuess(new Set())} disabled={!guess.size}>Clear</GameButton>
                  </>
                )}
                <span className="num text-sm text-muted">Your range {formatPercent(rangePct(guess))}</span>
              </div>
            </section>

            <div className="space-y-4 min-w-0">
              {result ? (
                <>
                  <Panel title="Result">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-2xs uppercase tracking-[0.12em] text-faint">Match</div>
                        <div className="num text-3xl text-text mt-0.5">{Math.round(result.match * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-2xs uppercase tracking-[0.12em] text-faint">Missed</div>
                        <div className="num text-lg text-warn mt-1">{result.missedCombos} combos</div>
                      </div>
                      <div>
                        <div className="text-2xs uppercase tracking-[0.12em] text-faint">Too wide</div>
                        <div className="num text-lg text-err mt-1">{result.extraCombos} combos</div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted">
                      You put {spot.hero} on <span className="num text-text">{formatPercent(result.guessedPct)}</span> of hands; the range plays{' '}
                      <span className="num text-text">{formatPercent(result.actualPct)}</span>. Match = combos in both ranges ÷ combos in either.
                    </p>
                  </Panel>
                  <Panel title="Actual range" meta={formatPercent(result.actualPct)}>
                    <RangeGrid spot={spot} />
                    <div className="mt-3">
                      <Legend spot={spot} />
                    </div>
                    <p className="mt-2 text-xs text-faint">Mixed hands count with their most frequent action.</p>
                  </Panel>
                </>
              ) : (
                <Panel title="How it works">
                  <p className="text-sm text-muted">
                    Paint every hand {spot.hero} puts in the pot here{spot.hero === 'SB' ? ' (raises and limps)' : ''}, then check. The comparison shows hands
                    you got right, hands you missed and hands that are too wide.
                  </p>
                </Panel>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
