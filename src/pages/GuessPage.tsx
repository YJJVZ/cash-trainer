import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '../components/Card';
import { BigActionButton, GameButton } from '../components/GameButton';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Layout';
import { Modal } from '../components/Modal';
import { PokerTable } from '../components/PokerTable';
import { Legend, RangeGrid } from '../components/RangeGrid';
import { ToggleGroup } from '../components/Tabs';
import { ALL_HANDS, type HandClass } from '../engine/hands';
import { POSITIONS, type Position } from '../engine/positions';
import { cryptoRng } from '../engine/random';
import { drawGuessSpot, guessableSpots, observerSpot, openAction, rangePct, scoreGuess, type GuessCell, type GuessResult } from '../quiz/rangeGuess';
import { formatPercent } from '../ranges/analysis';
import { potBeforeHero } from '../ranges/describe';
import type { ActionOption, RangeSpot } from '../ranges/types';
import { useStore } from '../state/store';
import { cx } from '../ui/cx';
import { useLocalSetting } from '../ui/useLocalSetting';

const OPENERS: Position[] = POSITIONS.filter((p) => p !== 'BB');

const PAINT_ACTIONS: ActionOption[] = [
  { id: 'fold', kind: 'fold', label: 'Fold' },
  { id: 'in', kind: 'raise', label: 'Your read' },
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

type Tone = 'ok' | 'warn' | 'err';
const matchTone = (m: number): Tone => (m >= 0.8 ? 'ok' : m >= 0.6 ? 'warn' : 'err');
const TONE_TEXT: Record<Tone, string> = { ok: 'text-ok', warn: 'text-warn', err: 'text-err' };
const TONE_STAMP: Record<Tone, string> = {
  ok: 'text-ok border-ok bg-ok/10',
  warn: 'text-warn border-warn bg-warn/10',
  err: 'text-err border-err bg-err/10',
};
const TONE_EDGE: Record<Tone, string> = { ok: 'border-l-ok', warn: 'border-l-warn', err: 'border-l-err' };

export function GuessPage() {
  const { spots } = useStore();
  const [heroes, setHeroes] = useLocalSetting<Position[]>('guess.heroes', OPENERS);
  const pool = useMemo(() => guessableSpots(spots, heroes), [spots, heroes]);
  const [spotId, setSpotId] = useState<string | null>(null);
  const [guess, setGuess] = useState<Set<HandClass>>(() => new Set());
  const [revealed, setRevealed] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [matches, setMatches] = useState<number[]>([]);

  const spot = pool.find((s) => s.id === spotId) ?? null;
  const table = useMemo(() => spot && observerSpot(spot), [spot]);

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

  const check = useCallback(() => {
    if (!spot || revealed) return;
    setRevealed(true);
    setMatches((m) => [...m, scoreGuess(spot, guess).match]);
  }, [spot, revealed, guess]);

  // Enter = check, then next spot.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSetup || e.key !== 'Enter' || (e.target as HTMLElement).closest('input, textarea, select, button, a')) return;
      // Otherwise the autofocused "Next spot" button would also receive this Enter and skip the result.
      e.preventDefault();
      if (revealed) next();
      else check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, next, check, showSetup]);

  const paintSpot = useMemo<RangeSpot | null>(
    () => spot && { ...spot, id: 'guess', actions: PAINT_ACTIONS, hands: Object.fromEntries(ALL_HANDS.map((h) => [h, { [guess.has(h) ? 'in' : 'fold']: 1 }])) },
    [spot, guess],
  );
  const diffSpot = useMemo<RangeSpot | null>(
    () => spot && result && { ...spot, id: 'guess-diff', actions: DIFF_ACTIONS, hands: Object.fromEntries(ALL_HANDS.map((h) => [h, { [result.cells[h]!]: 1 }])) },
    [spot, result],
  );
  const average = matches.length ? matches.reduce((a, b) => a + b, 0) / matches.length : 0;

  return (
    <div>
      <PageHeader title="Read the range" meta={<span className="num">{matches.length} spots · {Math.round(average * 100)}% avg match</span>}>
        <GameButton onClick={() => setShowSetup(true)} aria-label="Villain positions" className="px-3">
          <Icon name="settings" size={18} />
          <span className="hidden sm:inline">Setup</span>
        </GameButton>
      </PageHeader>

      {showSetup && (
        <Modal title="Villain positions" onClose={() => setShowSetup(false)}
          footer={
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted num">{pool.length} opening range{pool.length === 1 ? '' : 's'}</span>
              <BigActionButton label="Done" className="ml-auto h-12 sm:h-12 px-6" onClick={() => setShowSetup(false)} />
            </div>
          }>
          <ToggleGroup label="Villain opens from" items={OPENERS.map((p) => ({ id: p, label: p }))} value={heroes} onChange={setHeroes} />
        </Modal>
      )}

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-4 md:py-6">
        {!spot || !table || !paintSpot ? (
          <div className="py-16 text-center space-y-4">
            <p className="font-display font-bold text-2xl uppercase tracking-[0.04em]">No opening range to read</p>
            <p className="text-muted">Pick other villain positions, or import complete opening ranges.</p>
            <BigActionButton label="Open setup" onClick={() => setShowSetup(true)} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_480px] items-start">
            <section className="min-w-0 space-y-4" aria-label="Current spot">
              <PokerTable spot={table} pot={potBeforeHero(table)} center={result ? <MatchStamp match={result.match} /> : <ReadStamp />} />

              <div className="text-center -mt-1">
                <div className="font-display font-extrabold text-[32px] sm:text-[40px] leading-none tracking-[0.02em] uppercase">
                  {spot.hero} <span className="text-act-raise">{openAction(spot).label}</span>
                </div>
                <p className="mt-1.5 text-sm sm:text-md text-muted">
                  <span className="text-text">Folded to {spot.hero}, who raises</span> — {result ? 'here is how your read compares' : 'paint the range you put them on'}
                </p>
              </div>

              {result && <ResultPanel spot={spot} result={result} onNext={next} />}
            </section>

            <aside className="min-w-0 space-y-4">
              <Panel title={result ? 'Your read vs the range' : 'Your read'} meta={<span className="num">{formatPercent(rangePct(guess))} of hands</span>}>
                {result && diffSpot ? (
                  <>
                    <RangeGrid spot={diffSpot} colors={DIFF_COLORS} />
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                      {(['hit', 'missed', 'extra'] as const).map((id) => (
                        <li key={id} className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-[1px]" style={{ background: DIFF_COLORS[id] }} />
                          <span className="text-text">{DIFF_ACTIONS.find((a) => a.id === id)!.label}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <RangeGrid spot={paintSpot} onPaint={onPaint} />
                    <p className="mt-3 text-sm text-muted">Tap or drag to add hands; start on a painted hand to erase.</p>
                    <div className="mt-3 flex items-center gap-3">
                      <BigActionButton label="Check" hint="↵" className="flex-1" onClick={check} />
                      <GameButton onClick={() => setGuess(new Set())} disabled={!guess.size}>Clear</GameButton>
                    </div>
                  </>
                )}
              </Panel>
              {result && (
                <Panel title="Actual range" meta={<span className="num">{formatPercent(result.actualPct)} of hands</span>}>
                  <RangeGrid spot={spot} />
                  <div className="mt-3">
                    <Legend spot={spot} />
                  </div>
                </Panel>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function ReadStamp() {
  return (
    <div className="mt-2 font-display font-extrabold text-[22px] sm:text-[28px] leading-none uppercase tracking-[0.08em] text-muted" aria-hidden>
      Range ?
    </div>
  );
}

function MatchStamp({ match }: { match: number }) {
  return (
    <div className="pop-in mt-2" aria-hidden>
      <div className={cx('inline-block px-3 py-1 rounded-btn border-2 font-display font-extrabold text-[22px] sm:text-[28px] leading-none uppercase tracking-[0.08em] rotate-[-3deg]', TONE_STAMP[matchTone(match)])}>
        <span className="num">{Math.round(match * 100)}%</span> match
      </div>
    </div>
  );
}

function ResultPanel({ spot, result, onNext }: { spot: RangeSpot; result: GuessResult; onNext: () => void }) {
  const tone = matchTone(result.match);
  return (
    <div className="rise-in" aria-live="polite">
      <div className="max-lg:sticky max-lg:bottom-0 max-lg:z-30 max-lg:-mx-4 max-lg:px-4 max-lg:py-3 max-lg:bg-bg/95 max-lg:border-t max-lg:border-border flex items-center gap-4">
        <span className={cx('font-display font-extrabold text-[26px] uppercase tracking-[0.06em] leading-none', TONE_TEXT[tone])}>
          {tone === 'ok' ? 'Good read' : tone === 'warn' ? 'Close' : 'Off'}
        </span>
        <BigActionButton label="Next spot" hint="↵" className="ml-auto flex-1 sm:flex-none sm:min-w-[260px]" onClick={onNext} autoFocus />
      </div>
      <ul className={cx('mt-3 rounded-card border border-border bg-surface p-4 space-y-1.5 text-sm text-muted border-l-4', TONE_EDGE[tone])}>
        <li className="text-text font-medium">
          You read {spot.hero} on <span className="num">{formatPercent(result.guessedPct)}</span> of hands; they raise{' '}
          <span className="num">{formatPercent(result.actualPct)}</span>.
        </li>
        <li>
          <span className="text-warn num">{result.missedCombos}</span> combos missed · <span className="text-err num">{result.extraCombos}</span> combos too wide.
        </li>
        <li>Match = combos in both ranges ÷ combos in either. Mixed hands count with their most frequent action.</li>
      </ul>
    </div>
  );
}
