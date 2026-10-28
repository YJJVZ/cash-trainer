import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Simple dialog: centered on desktop, bottom sheet on mobile. Closes on Escape or backdrop click. */
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pop-in w-full sm:max-w-[560px] max-h-[88dvh] overflow-auto bg-surface border border-border rounded-t-game sm:rounded-game shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-surface flex items-center h-14 px-5 border-b border-border">
          <h2 className="font-display font-bold text-xl uppercase tracking-[0.06em]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="ml-auto grid place-items-center w-11 h-11 -mr-2 rounded-btn text-muted hover:text-text hover:bg-surface-2">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="p-5">{children}</div>
        {footer && <footer className="sticky bottom-0 bg-surface px-5 py-4 border-t border-border pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}
