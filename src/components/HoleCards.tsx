import type { CSSProperties } from 'react';
import { SUIT_SYMBOLS, type Card } from '../engine/cards';
import { cx } from '../ui/cx';

const SUIT_CLASS = { s: 'text-suit-s', h: 'text-suit-h', d: 'text-suit-d', c: 'text-suit-c' } as const;

const SIZES = {
  sm: { box: 'w-8 h-11', rank: 'text-md', suit: 'text-xs' },
  md: { box: 'w-[52px] h-[72px] md:w-[60px] md:h-[84px]', rank: 'text-[26px] md:text-[30px]', suit: 'text-[20px] md:text-[22px] mt-0.5' },
  lg: { box: 'w-[58px] h-[80px] sm:w-[76px] sm:h-[106px]', rank: 'text-[30px] sm:text-[40px]', suit: 'text-[22px] sm:text-[30px] mt-0.5' },
};

export function PlayingCard({ card, size = 'md', style, className }: { card: Card; size?: keyof typeof SIZES; style?: CSSProperties; className?: string }) {
  const s = SIZES[size];
  return (
    <div
      className={cx(
        'bg-card-face rounded-card flex flex-col items-center justify-center leading-none font-semibold border border-black/20 shadow-float',
        SUIT_CLASS[card.suit],
        s.box,
        className,
      )}
      style={style}
      aria-label={`${card.rank}${card.suit}`}
    >
      <span className={cx('font-display font-extrabold', s.rank)}>{card.rank === 'T' ? '10' : card.rank}</span>
      <span className={s.suit}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}

/** Hero's two cards; `dealKey` replays the deal animation for each new hand. */
export function HoleCards({ combo, size = 'md', dealKey }: { combo: readonly [Card, Card]; size?: keyof typeof SIZES; dealKey?: string }) {
  return (
    <div className={cx('flex', size === 'lg' ? '-space-x-2' : 'gap-1.5')} key={dealKey}>
      <PlayingCard card={combo[0]} size={size} className={dealKey ? 'deal-in' : undefined} style={{ '--r': size === 'lg' ? '-5deg' : '0deg', '--i': 0 } as CSSProperties} />
      <PlayingCard card={combo[1]} size={size} className={dealKey ? 'deal-in' : undefined} style={{ '--r': size === 'lg' ? '5deg' : '0deg', '--i': 1 } as CSSProperties} />
    </div>
  );
}
