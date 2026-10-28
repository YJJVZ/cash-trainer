import type React from 'react';
import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from '../ui/cx';
import { Icon, type IconName } from './Icon';

/** Main "PLAY" button: yellow, 72 px, the dominant action. */
export function PlayButton({ hint, className, ...rest }: Omit<LinkProps, 'children'> & { hint?: ReactNode }) {
  return (
    <Link
      {...rest}
      className={cx(
        'group relative flex items-center justify-center gap-3 h-[72px] px-6 rounded-game select-none',
        'bg-brand text-brand-ink shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)]',
        'transition-[background-color,transform,box-shadow] duration-100 ease-out',
        'hover:bg-brand-hover hover:-translate-y-px',
        'active:translate-y-px active:bg-brand-active active:shadow-[inset_0_-1px_0_rgb(0_0_0/0.18)]',
        'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-text',
        className,
      )}
    >
      <Icon name="play" size={22} className="fill-current stroke-none transition-transform duration-100 group-hover:translate-x-0.5" />
      <span className="font-display font-extrabold text-[32px] leading-none tracking-[0.08em] uppercase pt-0.5">Play</span>
      {hint && <span className="absolute right-5 text-sm font-medium opacity-70 leading-tight">{hint}</span>}
    </Link>
  );
}

/** Secondary menu button: 56 px, dark, yellow accent on hover. */
export function MenuButton({ icon, label, detail, badge, className, ...rest }: Omit<LinkProps, 'children'> & {
  icon: IconName;
  label: string;
  detail?: ReactNode;
  badge?: number;
}) {
  return (
    <Link
      {...rest}
      className={cx(
        'group relative flex items-center gap-3 h-14 pl-4 pr-3 rounded-game overflow-hidden select-none',
        'bg-surface border border-border text-text',
        'transition-[background-color,border-color,transform] duration-100 ease-out',
        'hover:bg-surface-2 hover:border-border-strong',
        'active:translate-y-px active:bg-surface-3',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        className,
      )}
    >
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand scale-y-0 group-hover:scale-y-100 group-focus-visible:scale-y-100 transition-transform duration-150 origin-center" />
      <Icon name={icon} size={20} className="shrink-0 text-muted group-hover:text-brand transition-colors duration-100" />
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold text-[19px] leading-none tracking-[0.06em] uppercase pt-0.5 truncate">{label}</span>
        {detail && <span className="block text-xs text-faint truncate mt-1">{detail}</span>}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="num shrink-0 min-w-6 h-6 px-1.5 grid place-items-center rounded-[3px] bg-err text-white text-xs font-medium">{badge}</span>
      )}
    </Link>
  );
}

/** Big yellow action button (e.g. NEXT HAND) as a <button>. */
export function BigActionButton({ label, hint, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; hint?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'group relative inline-flex items-center justify-center gap-3 h-16 sm:h-[68px] px-8 rounded-game select-none',
        'bg-brand text-brand-ink shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)]',
        'transition-[background-color,transform,box-shadow] duration-100 ease-out',
        'hover:bg-brand-hover hover:-translate-y-px active:translate-y-px active:bg-brand-active active:shadow-[inset_0_-1px_0_rgb(0_0_0/0.18)]',
        'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-text disabled:opacity-40 disabled:pointer-events-none',
        className,
      )}
    >
      <span className="font-display font-extrabold text-[24px] sm:text-[26px] leading-none tracking-[0.08em] uppercase pt-0.5">{label}</span>
      {hint && <span className="text-sm font-medium opacity-60 hidden md:inline">{hint}</span>}
    </button>
  );
}

/** Secondary game-style button (dark, 48 px). */
export function GameButton({ className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 h-11 px-3.5 rounded-game border border-border bg-surface text-text',
        'font-display font-bold text-[16px] leading-none uppercase tracking-[0.06em]',
        'hover:bg-surface-2 hover:border-border-strong active:translate-y-px transition-[background-color,border-color,transform] duration-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40 disabled:pointer-events-none',
        className,
      )}
    >
      {children}
    </button>
  );
}
