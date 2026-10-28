import { cx } from '../ui/cx';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
  disabled?: boolean;
}

export function Tabs<T extends string>({ items, value, onChange, className }: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cx('flex border-b border-border overflow-x-auto [scrollbar-width:none]', className)}>
      {items.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === value}
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
          className={cx(
            'relative h-12 px-4 font-display font-bold text-[16px] uppercase tracking-[0.06em] whitespace-nowrap -mb-px border-b-[3px] transition-colors duration-100',
            t.id === value ? 'text-text border-brand' : 'text-muted border-transparent hover:text-text',
            'disabled:opacity-40',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 num text-sm text-faint">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Compact multi-select (positions, families). */
export function ToggleGroup<T extends string>({ items, value, onChange, label }: {
  items: { id: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  label: string;
}) {
  const toggle = (id: T) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <fieldset className="min-w-0">
      <legend className="text-2xs uppercase tracking-[0.12em] text-muted mb-2">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const on = value.includes(it.id);
          return (
            <button
              key={it.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(it.id)}
              className={cx(
                'h-11 px-3.5 rounded-game border-2 font-display font-bold text-[15px] uppercase tracking-[0.05em] transition-colors duration-100',
                on ? 'bg-surface-3 border-brand text-text' : 'bg-transparent border-border text-faint hover:text-muted',
              )}
            >
              <span className={cx('inline-block w-1.5 h-1.5 mr-2 align-middle rounded-[1px]', on ? 'bg-brand' : 'bg-border-strong')} />
              {it.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
