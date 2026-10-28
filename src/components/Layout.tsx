import { useEffect, type ReactNode } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../state/store';
import { Icon } from './Icon';

/**
 * Game-style shell: the main menu is the hub; every screen only has a slim top bar
 * with a big "MENU" back button. Esc also goes back to the menu.
 */
export function Layout() {
  const { persistent } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // No Esc-to-menu inside dialogs, form fields or screens holding unsaved work (data-block-esc).
      if (document.querySelector('[role="dialog"], [data-block-esc]') || (e.target as HTMLElement).closest('input, textarea, select')) return;
      navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="h-px bg-brand/60" aria-hidden />
      <main className="flex-1 min-w-0 pb-[env(safe-area-inset-bottom)]">
        <Outlet />
      </main>
      {!persistent && <p className="px-4 py-2 text-xs text-warn text-center">Local storage unavailable: progress will not be saved.</p>}
    </div>
  );
}

export function BackToMenu() {
  return (
    <Link
      to="/"
      aria-label="Back to main menu"
      className="group shrink-0 inline-flex items-center gap-1.5 h-11 pl-2.5 pr-3.5 rounded-game border border-border bg-surface hover:bg-surface-2 hover:border-border-strong active:translate-y-px transition-[background-color,border-color,transform] duration-100"
    >
      <Icon name="back" size={18} className="text-muted group-hover:text-brand transition-colors duration-100" />
      <span className="font-display font-bold text-[17px] leading-none uppercase tracking-[0.08em] pt-0.5">Menu</span>
    </Link>
  );
}

/** Screen top bar: MENU button, big title, optional meta, actions on the right. */
export function PageHeader({ title, meta, children }: { title?: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 min-h-16 px-4 md:px-8 py-2.5 border-b border-border">
      <BackToMenu />
      <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
        {title && <h1 className="font-display font-extrabold text-[24px] sm:text-[28px] leading-none uppercase tracking-[0.03em] truncate pt-0.5">{title}</h1>}
        {meta && <div className="text-xs sm:text-sm text-muted truncate mt-1 sm:mt-0">{meta}</div>}
      </div>
      {children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </div>
  );
}
