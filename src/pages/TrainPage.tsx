import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ActionSelector } from '../components/ActionSelector';
import { Badge, Panel } from '../components/Card';
import { BigActionButton, GameButton } from '../components/GameButton';
import { HoleCards } from '../components/HoleCards';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Layout';
import { Modal } from '../components/Modal';
import { PokerTable } from '../components/PokerTable';
import { Legend, RangeGrid } from '../components/RangeGrid';
import { TrainingSetupForm, useTrainingConfig } from '../components/TrainingSetup';
import { cryptoRng } from '../engine/random';
import {
  buildReviewQueue, drawNext, isPlayable, questionFor, eligibleSpots, evaluateAnswer, sameItem, type Evaluation, type Question, type QuizItemRef,
} from '../quiz/engine';
import { explain } from '../quiz/explain';
import { analyzeSpot } from '../ranges/analysis';
import { checkConsistency } from '../ranges/consistency';
import { trainingSpots } from '../ranges/coverage';
import { describeHistory, potBeforeHero, shortName } from '../ranges/describe';
import { isDemoSpot } from '../ranges/demo/demoRanges';
import { FAMILY_LABELS, type RangeSpot } from '../ranges/types';
import { useStore } from '../state/store';
import { MAX_BOX, dueItems } from '../stats/srs';
import { cx } from '../ui/cx';

interface Turn {
  q: Question;
  ev: Evaluation;
}

/** "CO open 2.5 BB" style headline of what happened before hero. */
function headline(spot: RangeSpot): string {
  const acted = describeHistory(spot.history).filter((t) => !t.endsWith(' fold'));
  if (acted.length) return acted.join(' · ');
  return spot.history.length ? 'Folded to you' : 'First to act';
}

export function TrainPage() {
  const { spots, srs, recordAnswer, spotById } = useStore();
  const [config, setConfig] = useTrainingConfig();
  const [showSetup, setShowSetup] = useState(false);
  // Review queues opened by link: "?review=due" (spaced repetition) or "?review=mistakes" (all tracked mistakes)
  const [params, setParams] = useSearchParams();
  const [initialReview] = useState(() => {
    const mode = params.get('review');
    if (mode !== 'due' && mode !== 'mistakes') return null;
    const items = mode === 'due' ? dueItems(srs, Date.now()) : [...srs].filter((i) => i.box < MAX_BOX).sort((a, b) => b.lapses - a.lapses);
    const queue = items
      .filter((d) => isPlayable(spotById(d.spotId), d.hand))
      .map((d) => questionFor(spotById(d.spotId)!, d.hand, cryptoRng, mode === 'due' ? 'srs' : 'review'));
    return queue.length ? queue : null;
  });
  useEffect(() => {
    if (params.has('review')) setParams({}, { replace: true });
  }, [params, setParams]);
  const [question, setQuestion] = useState<Question | null>(initialReview?.[0] ?? null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [mistakes, setMistakes] = useState<QuizItemRef[]>([]);
  const [review, setReview] = useState<Question[] | null>(initialReview ? initialReview.slice(1) : null);
  const [notice, setNotice] = useState<string | null>(null);

  const pool = useMemo(() => eligibleSpots(trainingSpots(spots, config.showCoveredDemos), config), [spots, config]);
  const warnings = useMemo(() => checkConsistency(pool), [pool]);

  const draw = useCallback(
    (previous?: QuizItemRef) => {
      if (pool.length === 0) return null;
      const due = config.srs ? dueItems(srs, Date.now()) : [];
      return drawNext(pool, { rng: cryptoRng, due, srsRatio: 0.3, previous });
    },
    [pool, srs, config.srs],
  );

  // First question / configuration change
  useEffect(() => {
    if (review) return;
    if (!question || !pool.some((s) => s.id === question.spotId)) {
      setQuestion(draw());
      setEvaluation(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  const spot = question ? spotById(question.spotId) : undefined;

  const answer = useCallback(
    (actionId: string) => {
      if (!question || !spot || evaluation) return;
      const ev = evaluateAnswer(spot, question.hand, actionId);
      setEvaluation(ev);
      setTurns((t) => [...t, { q: question, ev }]);
      setMistakes((m) =>
        ev.verdict === 'correct' ? m.filter((x) => !sameItem(x, question)) : m.some((x) => sameItem(x, question)) ? m : [...m, question],
      );
      void recordAnswer(question, spot, ev);
    },
    [question, spot, evaluation, recordAnswer],
  );

  const next = useCallback(() => {
    setEvaluation(null);
    setNotice(null);
    if (review) {
      const [head, ...rest] = review;
      if (head) {
        setReview(rest);
        setQuestion(head);
        return;
      }
      setReview(null);
      setNotice('Review complete. Back to random deals.');
    }
    setQuestion(draw(question ?? undefined));
  }, [review, draw, question]);

  const startReview = () => {
    const queue = buildReviewQueue(mistakes, spots, cryptoRng);
    if (queue.length === 0) return;
    const [head, ...rest] = queue;
    setReview(rest);
    setQuestion(head!);
    setEvaluation(null);
    setNotice(null);
  };

  useEffect(() => {
    if (!evaluation) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [evaluation, next]);

  const correct = turns.filter((t) => t.ev.verdict === 'correct').length;
  const streak = (() => {
    let n = 0;
    for (let i = turns.length - 1; i >= 0 && turns[i]!.ev.verdict === 'correct'; i--) n++;
    return n;
  })();

  return (
    <div>
      <PageHeader
        title="Play"
        meta={
          <span className="num">
            {turns.length} hands · {turns.length ? Math.round((100 * correct) / turns.length) : 0}%<span className="hidden sm:inline"> · streak {streak}</span>
          </span>
        }
      >
        <GameButton disabled={mistakes.length === 0 || !!review} onClick={startReview} aria-label="Review this session's mistakes">
          <Icon name="target" size={16} />
          <span className="hidden sm:inline">Mistakes</span>
          <span className="num text-sm text-muted">{mistakes.length}</span>
        </GameButton>
        <GameButton onClick={() => setShowSetup(true)} aria-label="Training settings" className="px-3">
          <Icon name="settings" size={18} />
          <span className="hidden sm:inline">Setup</span>
        </GameButton>
      </PageHeader>

      {showSetup && (
        <Modal title="Training setup" onClose={() => setShowSetup(false)}
          footer={
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted num">{pool.length} eligible spot{pool.length === 1 ? '' : 's'}</span>
              <BigActionButton label="Done" className="ml-auto h-12 sm:h-12 px-6" onClick={() => setShowSetup(false)} />
            </div>
          }>
          <TrainingSetupForm config={config} onChange={setConfig} />
        </Modal>
      )}

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-4 md:py-6">
        {warnings.length > 0 && (
          <div className="mb-4 px-3 py-2 rounded-card border border-warn/40 text-sm text-warn">
            {warnings.map((w) => (
              <div key={w.kind}>
                {w.message} <span className="text-muted num">{w.values.join(' / ')}</span>
              </div>
            ))}
          </div>
        )}

        {!question || !spot ? (
          <div className="py-16 text-center space-y-4">
            <p className="font-display font-bold text-2xl uppercase tracking-[0.04em]">No playable spot</p>
            <p className="text-muted">Pick other spot families or positions, or import ranges.</p>
            <BigActionButton label="Open setup" onClick={() => setShowSetup(true)} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
            <section className="min-w-0 space-y-4" aria-label="Current hand">
              {/* Spot strip */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h2 className="font-display font-bold text-xl uppercase tracking-[0.04em]">{shortName(spot.name)}</h2>
                <span className="text-sm text-faint">{FAMILY_LABELS[spot.family]}</span>
                <div className="ml-auto flex gap-1.5">
                  {question.origin === 'srs' && <Badge>Repetition</Badge>}
                  {(review || question.origin === 'review') && <Badge>Review{review ? ` · ${review.length} left` : ''}</Badge>}
                  {isDemoSpot(spot) && <Badge tone="demo">Fictional demo</Badge>}
                </div>
              </div>
              {notice && <p className="text-sm text-muted">{notice}</p>}

              <PokerTable
                spot={spot}
                pot={potBeforeHero(spot)}
                heroCards={<HoleCards combo={question.combo} size="lg" dealKey={question.id} />}
                center={evaluation && <VerdictStamp verdict={evaluation.verdict} streak={streak} />}
              />

              <div className="text-center -mt-1">
                <div className="font-display font-extrabold text-[32px] sm:text-[40px] leading-none tracking-[0.02em]">{question.hand}</div>
                <p className="mt-1.5 text-sm sm:text-md text-muted">
                  <span className="text-text">{headline(spot)}</span> — {evaluation ? 'here is the range answer' : 'your move'}
                </p>
              </div>

              <ActionSelector
                spot={spot}
                onSelect={answer}
                result={evaluation ? { chosen: evaluation.chosen, best: evaluation.bestActions, strategy: evaluation.strategy } : undefined}
              />

              {evaluation && <ResultPanel lines={explain(spot, question.hand, evaluation)} verdict={evaluation.verdict} onNext={next} />}
            </section>

            <aside className="min-w-0 space-y-4">
              <Panel
                title="Range"
                meta={evaluation ? `${analyzeSpot(spot).definedCombos} combos` : 'hidden until you answer'}
                className={cx(!evaluation && 'hidden lg:block')}
              >
                <RangeGrid spot={spot} highlight={question.hand} masked={!evaluation} />
                {evaluation && (
                  <div className="mt-3">
                    <Legend spot={spot} combos={analyzeSpot(spot).combosByAction} total={analyzeSpot(spot).definedCombos} />
                  </div>
                )}
              </Panel>
              {turns.length > 0 && <SessionLog turns={turns} />}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function VerdictStamp({ verdict, streak }: { verdict: Evaluation['verdict']; streak: number }) {
  const ok = verdict === 'correct';
  return (
    <div className="pop-in mt-2" aria-hidden>
      <div className={cx('inline-block px-3 py-1 rounded-btn border-2 font-display font-extrabold text-[22px] sm:text-[28px] leading-none uppercase tracking-[0.08em] rotate-[-3deg]',
        ok ? 'text-ok border-ok bg-ok/10' : 'text-err border-err bg-err/10')}>
        {ok ? 'Correct' : verdict === 'partial' ? 'Partial' : 'Wrong'}
      </div>
      {ok && streak >= 3 && <div className="mt-1.5 font-display font-bold text-sm uppercase tracking-[0.1em] text-brand">Streak ×{streak}</div>}
    </div>
  );
}

function ResultPanel({ lines, verdict, onNext }: { lines: string[]; verdict: Evaluation['verdict']; onNext: () => void }) {
  const ok = verdict === 'correct';
  return (
    <div className="rise-in" aria-live="polite">
      <div className="max-lg:sticky max-lg:bottom-0 max-lg:z-30 max-lg:-mx-4 max-lg:px-4 max-lg:py-3 max-lg:bg-bg/95 max-lg:border-t max-lg:border-border flex items-center gap-4">
        <span className={cx('font-display font-extrabold text-[26px] uppercase tracking-[0.06em] leading-none', ok ? 'text-ok' : 'text-err')}>
          {ok ? 'Correct' : verdict === 'partial' ? 'Partial' : 'Wrong'}
        </span>
        <BigActionButton label="Next hand" hint="↵" className="ml-auto flex-1 sm:flex-none sm:min-w-[260px]" onClick={onNext} autoFocus />
      </div>
      <ul className={cx('mt-3 rounded-card border bg-surface p-4 space-y-1.5 text-sm text-muted border-l-4', ok ? 'border-border border-l-ok' : 'border-border border-l-err')}>
        {lines.map((l, i) => (
          <li key={i} className={i === 1 ? 'text-text font-medium' : undefined}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

function SessionLog({ turns }: { turns: Turn[] }) {
  const { spotById } = useStore();
  const recent = turns.slice(-8).reverse();
  return (
    <Panel title="This session" meta={`${turns.length} hands`} flush className="hidden lg:block">
      <table className="w-full text-sm">
        <tbody>
          {recent.map(({ q, ev }) => {
            const s = spotById(q.spotId);
            return (
              <tr key={q.id} className="border-b border-border last:border-0">
                <td className="pl-3 py-1.5 w-1">
                  <span className={cx('block w-2 h-2 rounded-full', ev.verdict === 'correct' ? 'bg-ok' : 'bg-err')} />
                </td>
                <td className="px-3 py-1.5 num font-medium w-14">{q.hand}</td>
                <td className="py-1.5 text-muted truncate max-w-0 w-full">{shortName(s?.name ?? '')}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  {ev.verdict === 'correct' ? (
                    <span className="text-muted">{s?.actions.find((a) => a.id === ev.chosen)?.label}</span>
                  ) : (
                    <>
                      <span className="text-err line-through decoration-1">{s?.actions.find((a) => a.id === ev.chosen)?.label}</span>
                      <span className="text-text ml-2">{s?.actions.find((a) => a.id === ev.bestActions[0])?.label}</span>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
