import { useEffect, useMemo, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MenuButton, PlayButton } from '../components/GameButton';
import { GRID } from '../engine/hands';
import { isBundledSpot } from '../ranges/bundled';
import type { RangeSpot } from '../ranges/types';
import { useStore } from '../state/store';
import { currentStreak, tally } from '../stats/aggregate';
import { MAX_BOX, dueItems } from '../stats/srs';
import { strategyBackground } from '../ui/colors';

const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

/** 13×13 grid in perspective as a decorative backdrop (colors from a real library spot). */
function BackdropGrid({ spot }: { spot?: RangeSpot }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ maskImage: 'radial-gradient(ellipse at center, black 10%, transparent 68%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 10%, transparent 68%)' }}
    >
      <div
        className="absolute top-[56%] left-1/2 w-[min(118vh,1100px)] max-lg:w-[150vw] aspect-square opacity-[0.11] max-lg:opacity-[0.07]"
        style={{ transform: 'translate(-50%, -50%) perspective(1200px) rotateX(52deg) rotateZ(-8deg)' }}
      >
        <div className="grid gap-[3px] w-full h-full" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
          {GRID.flat().map((c) => {
            const s = spot?.hands[c.hand];
            return <div key={c.hand} className="rounded-[2px] bg-surface-3" style={s && spot ? { background: strategyBackground(spot, s) } : undefined} />;
          })}
        </div>
      </div>
    </div>
  );
}

export function MainMenuPage() {
  const { spots, answers, srs } = useStore();
  const navigate = useNavigate();
  const total = useMemo(() => tally(answers), [answers]);
  const streak = useMemo(() => currentStreak(answers), [answers]);
  const due = dueItems(srs, Date.now()).length;
  const toRework = srs.filter((i) => i.box < MAX_BOX).length;
  const defaultsOnly = spots.length > 0 && spots.every(isBundledSpot);
  const backdrop = spots.find((s) => s.family === 'RFI' && s.hero === 'BTN' && s.mode === 'standard') ?? spots[0];

  // Enter = Play (when no button has focus)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.target === document.body || e.target === document.documentElement)) navigate('/train');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg">
      <BackdropGrid spot={backdrop} />
      <div className="absolute inset-x-0 top-0 h-px bg-brand/60" aria-hidden />

      <div className="relative z-10 min-h-dvh flex flex-col items-center px-5 sm:px-10 pt-[max(20px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))]">
        <main className="flex-1 flex flex-col justify-center w-full max-w-[440px] mx-auto text-center py-8 [@media(max-height:780px)]:py-3">
          {/* Title */}
          <div className="menu-in" style={stagger(0)}>
            <div className="flex items-center justify-center gap-2 mb-4 [@media(max-height:780px)]:mb-3">
              <span className="grid grid-cols-2 gap-[3px] w-5 h-5" aria-hidden>
                <span className="bg-brand rounded-[1px]" />
                <span className="bg-act-raise rounded-[1px]" />
                <span className="bg-act-call rounded-[1px]" />
                <span className="bg-act-fold rounded-[1px]" />
              </span>
              <span className="font-display font-semibold text-sm tracking-[0.22em] uppercase text-brand">Preflop training</span>
            </div>
            <h1 className="font-display font-extrabold uppercase leading-[0.84] tracking-[0.01em] text-[clamp(64px,17vw,112px)] [@media(max-height:780px)]:text-[clamp(56px,15vw,96px)]">
              Cash
              <br />
              Trainer
            </h1>
            <p className="mt-4 num text-sm text-muted">NLHE 6-max · 100 BB · PokerStars NL10</p>
          </div>

          {/* Actions */}
          <nav className="mt-10 [@media(max-height:780px)]:mt-7 space-y-3 text-left" aria-label="Main menu">
            <div className="menu-in" style={stagger(1)}>
              <PlayButton to="/train" hint={<span className="hidden sm:inline num">↵ Enter</span>} />
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5">
              <MenuButton className="menu-in" style={stagger(2)} to="/ranges" icon="grid" label="Ranges" detail={`${spots.length} spots`} />
              <MenuButton className="menu-in" style={stagger(3)} to="/stats" icon="stats" label="Progress"
                detail={total.total ? `${Math.round(total.accuracy * 100)}% accuracy` : 'No hands played yet'} />
              <MenuButton className="menu-in" style={stagger(4)} to="/mistakes" icon="target" label="My mistakes"
                detail={toRework ? `${toRework} hand${toRework > 1 ? 's' : ''} to work on` : 'Nothing to review'} badge={due} />
              <MenuButton className="menu-in" style={stagger(5)} to="/settings" icon="settings" label="Settings" detail="Ranges, import, data" />
            </div>
          </nav>

          {/* Subtle progress preview */}
          <Link
            to="/stats"
            className="menu-in group mt-8 [@media(max-height:780px)]:mt-5 grid grid-cols-3 border-t border-border pt-4 hover:border-border-strong transition-colors"
            style={stagger(6)}
            aria-label="View detailed progress"
          >
            {[
              ['Hands', total.total],
              ['Accuracy', total.total ? `${Math.round(total.accuracy * 100)}%` : '—'],
              ['Streak', streak],
            ].map(([k, v]) => (
              <div key={k as string}>
                <div className="text-2xs uppercase tracking-[0.12em] text-faint group-hover:text-muted transition-colors">{k}</div>
                <div className="num text-lg text-text mt-0.5">{v}</div>
              </div>
            ))}
            <div className="col-span-3 mt-3 h-1 bg-surface-3 rounded-[1px] overflow-hidden">
              <div className="h-full bg-brand/80" style={{ width: `${Math.round(total.accuracy * 100)}%` }} />
            </div>
          </Link>
        </main>

        <footer className="menu-in w-full max-w-[440px] mx-auto text-center text-xs text-faint" style={stagger(7)}>
          {defaultsOnly ? (
            <p>
              <span className="text-warn">Estimated default ranges.</span>{' '}
              <Link to="/settings?tab=library" className="underline underline-offset-2 hover:text-muted">Import your ranges</Link>
            </p>
          ) : (
            <p>{spots.filter((s) => !isBundledSpot(s)).length} personal spots · saved locally</p>
          )}
        </footer>
      </div>
    </div>
  );
}
