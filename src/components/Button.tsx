import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../ui/cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink border-brand hover:bg-brand-hover active:bg-brand-active font-semibold',
  secondary: 'bg-surface-2 text-text border-border hover:bg-surface-3 hover:border-border-strong',
  ghost: 'bg-transparent text-muted border-transparent hover:text-text hover:bg-surface-2',
  danger: 'bg-surface-2 text-err border-border hover:border-err',
};

const SIZES: Record<Size, string> = {
  md: 'h-11 md:h-10 px-4 text-base',
  sm: 'h-11 md:h-8 px-3 text-sm',
};

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', block = false): string {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-btn border font-medium whitespace-nowrap select-none',
    'transition-colors duration-100 disabled:opacity-40 disabled:pointer-events-none',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
  );
}

export function Button({ variant = 'secondary', size = 'md', block, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx(buttonClass(variant, size, block), className)} {...rest} />;
}
