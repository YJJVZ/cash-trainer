import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../ui/cx';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('bg-surface border border-border rounded-card', className)} {...rest} />;
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
}

/** Card with a compact header (title, meta, actions). */
export function Panel({ title, meta, actions, flush, className, children, ...rest }: PanelProps) {
  return (
    <section className={cx('bg-surface border border-border rounded-card min-w-0', className)} {...rest}>
      <header className="flex items-center gap-3 h-12 px-4 border-b border-border">
        <h2 className="font-display font-bold text-[16px] uppercase tracking-[0.08em] text-text truncate pt-0.5">{title}</h2>
        {meta && <div className="text-xs text-faint num truncate">{meta}</div>}
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      </header>
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'err' }) {
  return (
    <div className="min-w-0">
      <div className="text-2xs uppercase tracking-[0.12em] text-muted truncate">{label}</div>
      <div className={cx('font-display font-extrabold text-[34px] leading-none mt-1.5', tone === 'ok' && 'text-ok', tone === 'err' && 'text-err')}>{value}</div>
      {sub && <div className="text-xs text-faint num truncate mt-1">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'demo' | 'warn' | 'ok' | 'err' }) {
  const tones = {
    neutral: 'text-muted border-border',
    demo: 'text-warn border-warn/50',
    warn: 'text-warn border-warn/50',
    ok: 'text-ok border-ok/50',
    err: 'text-err border-err/50',
  };
  return (
    <span className={cx('inline-flex items-center h-5 px-1.5 rounded-[2px] border text-2xs font-semibold uppercase tracking-[0.05em] whitespace-nowrap', tones[tone])}>
      {children}
    </span>
  );
}
