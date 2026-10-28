import type { CSSProperties, ReactNode } from 'react';
import { POSITIONS, type Position } from '../engine/positions';
import { describeHistoryAction } from '../ranges/describe';
import type { RangeSpot } from '../ranges/types';
import { cx } from '../ui/cx';

type Tone = 'fold' | 'aggr' | 'passive' | 'idle' | 'hero';

interface Seat {
  position: Position;
  /** Action bubble text ("open", "3-bet", "limp"…); undefined = no bubble. */
  action?: string;
  tone: Tone;
  /** Hero's own earlier action (e.g. their open before facing a 3-bet). */
  heroPrior?: string;
  /** Chips currently in front of the seat, in BB (0 when folded / nothing posted). */
  bet: number;
}

function seats(spot: RangeSpot): Seat[] {
  const last = new Map<Position, { kind: string; text: string; size?: number }>();
  let raises = 0;
  for (const h of spot.history) {
    const text = describeHistoryAction({ ...h, sizeBb: undefined }, raises).replace(`${h.position} `, '');
    if (h.kind === 'raise') raises++;
    last.set(h.position, { kind: h.kind, text, size: h.sizeBb });
  }
  return POSITIONS.map((p) => {
    const l = last.get(p);
    const blind = p === 'SB' ? 0.5 : p === 'BB' ? 1 : 0;
    const bet = l?.kind === 'fold' ? 0 : (l?.size ?? blind);
    if (p === spot.hero) return { position: p, tone: 'hero', heroPrior: l?.text, bet };
    if (!l) return { position: p, tone: 'idle', bet };
    const tone: Tone = l.kind === 'fold' ? 'fold' : l.kind === 'raise' || l.kind === 'allin' ? 'aggr' : 'passive';
    return { position: p, action: l.text, tone, bet };
  });
}

/** Seat slots relative to hero (0 = hero at the bottom); next to act sits on hero's left. */
const SLOTS: { x: number; y: number }[] = [
  { x: 50, y: 83 },
  { x: 8, y: 66 },
  { x: 15, y: 22 },
  { x: 50, y: 13 },
  { x: 85, y: 22 },
  { x: 92, y: 66 },
];

const toward = (a: { x: number; y: number }, t: number) => ({ x: a.x + (50 - a.x) * t, y: a.y + (50 - a.y) * t });
/** In front of the seat, shifted sideways so it does not cover the cards or chips. */
function dealerSpot(slot: { x: number; y: number }, isHero: boolean) {
  if (isHero) return { x: 29, y: 73 };
  const p = toward(slot, 0.3);
  return Math.abs(slot.x - 50) < 10 ? { x: p.x + 9, y: p.y } : { x: p.x, y: p.y + (slot.y < 50 ? 9 : -9) };
}

const at = (p: { x: number; y: number }): CSSProperties => ({ left: `${p.x}%`, top: `${p.y}%` });

/** Stack of 1–4 chips, taller for bigger bets. */
function Chips({ amount }: { amount: number }) {
  const n = amount >= 20 ? 4 : amount >= 6 ? 3 : amount >= 2 ? 2 : 1;
  const colors = ['#e6e7ea', '#d6453d', '#3b7dd8', '#1d2025'];
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-5 h-5" aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            className="absolute left-0 w-5 h-3 rounded-[50%] border-2 border-dashed border-white/70"
            style={{ bottom: i * 3, background: colors[i % colors.length], boxShadow: '0 1px 0 rgb(0 0 0 / 0.5)' }}
          />
        ))}
      </div>
      <span className="num text-xs font-medium text-text bg-black/40 rounded-[3px] px-1">{amount}</span>
    </div>
  );
}

function CardBacks() {
  return (
    <div className="flex -space-x-2" aria-hidden>
      {[-8, 8].map((r) => (
        <span
          key={r}
          className="w-[18px] h-[26px] sm:w-[22px] sm:h-[31px] rounded-[3px] border border-black/40 bg-[repeating-linear-gradient(45deg,#c8302a_0_3px,#a52620_3px_6px)] shadow-[0_1px_2px_rgb(0_0_0/0.5)]"
          style={{ transform: `rotate(${r}deg)` }}
        />
      ))}
    </div>
  );
}

export function PokerTable({ spot, pot, center, heroCards }: { spot: RangeSpot; pot: number; center?: ReactNode; heroCards?: ReactNode }) {
  const list = seats(spot);
  const heroIdx = POSITIONS.indexOf(spot.hero);
  return (
    <div className="relative w-full aspect-[10/9] min-[480px]:aspect-[4/3] sm:aspect-[16/9] max-h-[460px] mx-auto select-none" role="img"
      aria-label={`Table: ${list.map((s) => `${s.position} ${s.tone === 'hero' ? 'you' : (s.action ?? 'to act')}`).join(', ')}`}>
      {/* Rail + felt */}
      <div className="absolute inset-x-[6%] top-[18%] bottom-[22%] rounded-[999px] bg-[#0c0e11] p-[1.4%] shadow-[0_10px_40px_rgb(0_0_0/0.5)]">
        <div className="w-full h-full rounded-[999px] border border-[#3a3f47] bg-[radial-gradient(ellipse_at_center,#2a2f36_0%,#1e2228_55%,#171a1f_100%)] shadow-[inset_0_0_40px_rgb(0_0_0/0.45)]" />
      </div>

      {/* Pot + center content */}
      <div className="absolute inset-x-0 top-[18%] bottom-[22%] grid place-items-center pointer-events-none">
        <div className="text-center -mt-[12%]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/35 border border-white/5">
            <span className="text-2xs uppercase tracking-[0.18em] text-muted">Pot</span>
            <span className="num text-md sm:text-lg text-brand">{pot.toFixed(1)} BB</span>
          </div>
          {center}
        </div>
      </div>

      {list.map((s, i) => {
        const slot = SLOTS[(i - heroIdx + 6) % 6]!;
        const isHero = s.tone === 'hero';
        const folded = s.tone === 'fold';
        const inHand = !folded && !isHero;
        return (
          <div key={s.position}>
            {/* Face-down cards for players still in the hand */}
            {inHand && (
              <div className="absolute -translate-x-1/2 -translate-y-1/2" style={at(toward(slot, 0.2))}>
                <CardBacks />
              </div>
            )}
            {/* Dealer button, on the felt in front of the BTN seat */}
            {s.position === 'BTN' && (
              <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={at(dealerSpot(slot, isHero))}>
                <span className="grid place-items-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#f4f4f5] text-[#111316] font-display font-extrabold text-[13px] sm:text-[15px] leading-none border-2 border-[#c9ccd2] shadow-[0_2px_4px_rgb(0_0_0/0.6)]" aria-label="Dealer button">D</span>
              </div>
            )}
            {/* Chips */}
            {s.bet > 0 && (
              <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={at(isHero ? { x: 64, y: 84 } : toward(slot, 0.44))}>
                <Chips amount={s.bet} />
              </div>
            )}
            {/* Seat avatar */}
            <div className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center" style={at(slot)}>
              {s.action && (
                <span className={cx(
                  'pop-in mb-1 px-2 py-0.5 rounded-[4px] font-display font-bold text-[13px] sm:text-[15px] leading-none uppercase tracking-[0.06em] whitespace-nowrap',
                  s.tone === 'aggr' && 'bg-act-raise text-white',
                  s.tone === 'passive' && 'bg-act-call text-white',
                  folded && 'bg-[#f4f4f5] text-[#111316] shadow-[0_1px_3px_rgb(0_0_0/0.6)]',
                )}>
                  {s.action}
                </span>
              )}
              <div className={cx(
                'relative grid place-items-center rounded-full border-[3px] font-display font-extrabold leading-none tracking-[0.04em]',
                isHero ? 'w-14 h-14 sm:w-16 sm:h-16 text-[18px] sm:text-[20px] border-brand bg-[#2b2a1c] text-brand' : 'w-11 h-11 sm:w-14 sm:h-14 text-[15px] sm:text-[17px] bg-surface-3 text-text',
                !isHero && (s.tone === 'aggr' ? 'border-act-raise' : s.tone === 'passive' ? 'border-act-call' : 'border-border-strong'),
                folded && 'opacity-35 grayscale',
              )}>
                {s.position}
              </div>
              {isHero && (
                <span className="mt-1 px-2 py-0.5 rounded-[4px] bg-brand text-brand-ink font-display font-extrabold text-[12px] leading-none uppercase tracking-[0.1em]">
                  You{s.heroPrior ? ` · ${s.heroPrior}` : ''}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {heroCards && <div className="absolute left-1/2 top-[61%] -translate-x-1/2 -translate-y-1/2 z-30">{heroCards}</div>}
    </div>
  );
}
