import { memo, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { GRID, type HandClass } from '../engine/hands';
import type { RangeSpot } from '../ranges/types';
import { spotColors, strategyBackground } from '../ui/colors';
import { cx } from '../ui/cx';

export interface RangeGridProps {
  spot: RangeSpot;
  /** Highlighted hand (the dealt hand in the quiz). */
  highlight?: HandClass;
  /** Hides the strategy (before answering in the quiz). */
  masked?: boolean;
  selected?: HandClass;
  onSelect?: (hand: HandClass) => void;
  onHover?: (hand: HandClass | undefined) => void;
  /** Paint mode: called for every cell touched while the pointer is down (tap or drag). */
  onPaint?: (hand: HandClass) => void;
  /** Overrides the color of each action id (default: by action kind). */
  colors?: Record<string, string>;
  className?: string;
}

function RangeGridImpl({ spot, highlight, masked, selected, onSelect, onHover, onPaint, colors: colorOverride, className }: RangeGridProps) {
  const colors = colorOverride ?? spotColors(spot);
  const interactive = !!onSelect;
  const painting = useRef(false);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!onPaint) return;
    const stop = () => {
      painting.current = false;
      last.current = null;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [onPaint]);

  // Works for mouse and touch: the cell under the pointer is found by position, not by enter events.
  const paintAt = (x: number, y: number) => {
    const hand = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-hand]')?.dataset.hand;
    if (hand && hand !== last.current) {
      last.current = hand;
      onPaint!(hand);
    }
  };
  const paintHandlers = onPaint
    ? {
        onPointerDown: (e: ReactPointerEvent) => {
          painting.current = true;
          last.current = null;
          paintAt(e.clientX, e.clientY);
        },
        onPointerMove: (e: ReactPointerEvent) => painting.current && paintAt(e.clientX, e.clientY),
      }
    : {};
  return (
    <div className={cx('@container w-full', className)} onMouseLeave={() => onHover?.(undefined)}>
      <div
        role="grid"
        aria-label={`Range ${spot.name}`}
        className={cx('grid grid-cols-13 gap-px bg-bg p-px rounded-card border border-border select-none', onPaint && 'touch-none cursor-crosshair')}
        style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
        {...paintHandlers}
      >
        {GRID.map((row) =>
          row.map((cell) => {
            const strat = spot.hands[cell.hand];
            const missing = !strat;
            const isHi = cell.hand === highlight;
            const isSel = cell.hand === selected;
            const folded = !!strat && !masked && Object.keys(strat).length === 1 && spot.actions.find((a) => a.id === Object.keys(strat)[0])?.kind === 'fold';
            const style = masked || missing ? undefined : { background: strategyBackground(spot, strat!, colors) };
            const Tag = interactive ? 'button' : 'div';
            return (
              <Tag
                key={cell.hand}
                data-hand={cell.hand}
                role="gridcell"
                aria-label={`${cell.hand}${missing ? ' (not provided)' : ''}`}
                aria-selected={isSel || undefined}
                onClick={interactive ? () => onSelect!(cell.hand) : undefined}
                onMouseEnter={onHover ? () => onHover(cell.hand) : undefined}
                className={cx(
                  'relative aspect-square flex items-center justify-center rounded-cell font-medium leading-none',
                  'text-[clamp(7px,2.55cqw,12px)] tracking-[-0.02em]',
                  masked ? 'bg-surface-2 text-faint' : missing ? 'cell-missing text-faint' : folded ? 'text-muted' : 'text-white',
                  interactive && 'cursor-pointer hover:brightness-125',
                  (isHi || isSel) && 'z-10 outline-2 outline-brand -outline-offset-1',
                  isHi && masked && 'bg-surface-3 text-text',
                )}
                style={style}
              >
                {cell.hand}
              </Tag>
            );
          }),
        )}
      </div>
    </div>
  );
}

export const RangeGrid = memo(RangeGridImpl);

export function Legend({ spot, combos, total }: { spot: RangeSpot; combos?: Record<string, number>; total?: number }) {
  const colors = spotColors(spot);
  const hasMissing = Object.keys(spot.hands).length < 169;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {spot.actions.map((a) => (
        <li key={a.id} className="flex items-center gap-1.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-[1px] shrink-0" style={{ background: colors[a.id] }} />
          <span className="text-text truncate">{a.label}</span>
          {combos && total ? (
            <span className="num text-muted">{((100 * (combos[a.id] ?? 0)) / total).toFixed(1)}%</span>
          ) : null}
        </li>
      ))}
      {hasMissing && (
        <li className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[1px] cell-missing border border-border" />
          <span className="text-muted">Not provided</span>
        </li>
      )}
    </ul>
  );
}
