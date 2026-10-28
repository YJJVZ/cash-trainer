import { useEffect, type CSSProperties } from 'react';
import type { ActionOption, RangeSpot, Strategy } from '../ranges/types';
import { spotColors } from '../ui/colors';
import { cx } from '../ui/cx';

export interface ActionSelectorProps {
  spot: RangeSpot;
  onSelect: (actionId: string) => void;
  /** After answering: player's choice, expected actions, full strategy. */
  result?: { chosen: string; best: string[]; strategy: Strategy };
  /** Enables 1…n keyboard shortcuts. */
  hotkeys?: boolean;
}

/** "3-bet 7.5 BB" → { main: "3-bet", size: "7.5 BB" }. */
function splitLabel(a: ActionOption): { main: string; size?: string } {
  const m = a.label.match(/^(.*?)\s+([\d.]+\s*BB)$/i);
  return m ? { main: m[1]!, size: m[2]! } : { main: a.label };
}

export function ActionSelector({ spot, onSelect, result, hotkeys = true }: ActionSelectorProps) {
  const colors = spotColors(spot);
  const answered = !!result;

  useEffect(() => {
    if (!hotkeys || answered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, select')) return;
      const a = spot.actions[Number(e.key) - 1];
      if (a) {
        e.preventDefault();
        onSelect(a.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkeys, answered, spot, onSelect]);

  const n = spot.actions.length;
  return (
    <div
      className={cx('grid gap-2 sm:gap-3', n === 4 ? 'grid-cols-2 sm:grid-cols-4' : n === 3 ? 'grid-cols-3' : 'grid-cols-2')}
      role="group"
      aria-label="Available actions"
    >
      {spot.actions.map((a, i) => {
        const isChosen = result?.chosen === a.id;
        const isBest = result?.best.includes(a.id);
        const freq = result?.strategy[a.id] ?? 0;
        const { main, size } = splitLabel(a);
        return (
          <button
            key={a.id}
            type="button"
            disabled={answered}
            onClick={() => onSelect(a.id)}
            style={{ '--c': colors[a.id] } as CSSProperties}
            className={cx(
              'group relative flex flex-col items-center justify-center h-16 sm:h-[72px] px-2 rounded-game border-2 overflow-hidden',
              'bg-[color-mix(in_srgb,var(--c)_24%,var(--color-surface))] border-[color-mix(in_srgb,var(--c)_70%,transparent)]',
              'shadow-[inset_0_-3px_0_color-mix(in_srgb,var(--c)_55%,black)]',
              'transition-[background-color,transform,opacity,box-shadow] duration-100 ease-out disabled:cursor-default',
              !answered && 'hover:bg-[color-mix(in_srgb,var(--c)_38%,var(--color-surface))] hover:-translate-y-px active:translate-y-px active:shadow-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text',
              answered && !isChosen && !isBest && 'opacity-35',
              answered && isBest && 'ring-2 ring-ok ring-offset-2 ring-offset-bg',
              answered && isChosen && !isBest && 'ring-2 ring-err ring-offset-2 ring-offset-bg',
            )}
          >
            <span className="font-display font-extrabold text-[22px] sm:text-[26px] leading-none uppercase tracking-[0.05em] text-text truncate max-w-full">{main}</span>
            {size && <span className="num text-xs text-text/75 mt-1">{size}</span>}
            {!answered && hotkeys && (
              <kbd className="absolute top-1.5 right-2 num text-2xs text-text/50 hidden md:inline">{i + 1}</kbd>
            )}
            {answered && (
              <span className="absolute top-1.5 right-2 num text-2xs text-text/80">{Math.round(freq * 100)}%</span>
            )}
            {answered && (isBest || isChosen) && (
              <span className={cx('absolute top-1.5 left-2 text-2xs font-bold uppercase tracking-[0.06em]', isBest ? 'text-ok' : 'text-err')}>
                {isBest ? '✓' : '✕'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
