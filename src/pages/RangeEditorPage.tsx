import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Panel } from '../components/Card';
import { BigActionButton, GameButton } from '../components/GameButton';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Layout';
import { Legend, RangeGrid } from '../components/RangeGrid';
import { SpotMeta } from '../components/SpotMeta';
import type { HandClass } from '../engine/hands';
import { analyzeSpot } from '../ranges/analysis';
import { editableInPlace, fillMissing, clearAll, paintHands, userCopy } from '../ranges/edit';
import { VERIFICATION_LABELS, type RangeSpot, type VerificationStatus } from '../ranges/types';
import { validateSpot } from '../ranges/validation';
import { useStore } from '../state/store';
import { spotColors } from '../ui/colors';
import { cx } from '../ui/cx';

const ERASE = '__erase__';
const EDITABLE_STATUSES: VerificationStatus[] = ['unverified', 'community', 'verified'];

export function RangeEditorPage() {
  const { id } = useParams();
  const { spots, spotById } = useStore();
  const original = id ? spotById(id) : undefined;
  if (!original) return <Navigate to="/ranges" replace />;
  // Re-mount when the source spot changes so the draft is rebuilt.
  return <Editor key={original.id} original={original} takenIds={new Set(spots.map((s) => s.id))} />;
}

function Editor({ original, takenIds }: { original: RangeSpot; takenIds: Set<string> }) {
  const { saveSpots } = useStore();
  const navigate = useNavigate();
  const isCopy = !editableInPlace(original);
  const [draft, setDraft] = useState<RangeSpot>(() => (isCopy ? userCopy(original, takenIds) : structuredClone(original)));
  const [brush, setBrush] = useState<string>(() => original.actions.find((a) => a.kind !== 'fold')?.id ?? original.actions[0]!.id);
  const [authorized, setAuthorized] = useState(!!original.source.authorizedByUser);
  const undo = useRef<RangeSpot[]>([]);
  const [, force] = useState(0);
  const stroke = useRef(false);

  const colors = spotColors(draft);
  const analysis = useMemo(() => analyzeSpot(draft), [draft]);
  const validation = useMemo(() => validateSpot({ ...draft, source: { ...draft.source, authorizedByUser: draft.source.proprietary ? authorized : undefined } }), [draft, authorized]);
  const blockedByAuth = draft.source.proprietary && !authorized;
  const foldId = draft.actions.find((a) => a.kind === 'fold')?.id;

  const commit = useCallback((next: RangeSpot, pushUndo = true) => {
    setDraft((cur) => {
      if (pushUndo) undo.current = [...undo.current.slice(-49), cur];
      return next;
    });
    force((n) => n + 1);
  }, []);

  // One undo step per stroke (tap or drag), not per cell.
  const onPaint = useCallback(
    (hand: HandClass) => {
      setDraft((cur) => {
        if (!stroke.current) {
          undo.current = [...undo.current.slice(-49), cur];
          stroke.current = true;
        }
        return paintHands(cur, [hand], brush === ERASE ? null : brush);
      });
    },
    [brush],
  );
  useEffect(() => {
    const end = () => {
      stroke.current = false;
      force((n) => n + 1);
    };
    window.addEventListener('pointerup', end);
    return () => window.removeEventListener('pointerup', end);
  }, []);

  const doUndo = useCallback(() => {
    const prev = undo.current.pop();
    if (prev) commit(prev, false);
  }, [commit]);

  // Shortcuts: 1…n pick a brush, 0 or E = erase, Ctrl/Cmd+Z = undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        doUndo();
        return;
      }
      if (e.key === '0' || e.key.toLowerCase() === 'e') setBrush(ERASE);
      const a = draft.actions[Number(e.key) - 1];
      if (a) setBrush(a.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft.actions, doUndo]);

  const set = <K extends keyof RangeSpot>(key: K, value: RangeSpot[K]) => commit({ ...draft, [key]: value });
  const setSource = (patch: Partial<RangeSpot['source']>) => commit({ ...draft, source: { ...draft.source, ...patch } });

  const save = async () => {
    if (!validation.spot || blockedByAuth) return;
    await saveSpots([validation.spot]);
    navigate(`/ranges?spot=${validation.spot.id}`);
  };

  return (
    <div data-block-esc>
      <PageHeader title="Edit range" meta={<span className="truncate">{draft.name}</span>}>
        <Link to={`/ranges?spot=${original.id}`} className="hidden sm:inline-flex items-center h-11 px-3.5 rounded-game border border-border bg-surface font-display font-bold text-[16px] uppercase tracking-[0.06em] hover:bg-surface-2">
          Cancel
        </Link>
        <BigActionButton label="Save" className="h-11 sm:h-11 px-5 [&>span]:text-[18px]" disabled={!validation.spot || blockedByAuth} onClick={() => void save()} />
      </PageHeader>

      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-5 grid gap-5 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] items-start">
        <div className="space-y-4 min-w-0">
          {isCopy && (
            <p className="text-sm text-muted rounded-card border border-border bg-surface px-4 py-2.5">
              Default and imported pack spots are never modified: you are editing <span className="text-text">your own copy</span>, saved as a new unverified spot.
            </p>
          )}

          {/* Brushes */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${draft.actions.length + 1}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Brush">
            {draft.actions.map((a, i) => (
              <Brush key={a.id} active={brush === a.id} color={colors[a.id]!} onClick={() => setBrush(a.id)} hotkey={String(i + 1)}>
                {a.label}
              </Brush>
            ))}
            <Brush active={brush === ERASE} color="var(--color-act-missing)" hatched onClick={() => setBrush(ERASE)} hotkey="0">
              Erase
            </Brush>
          </div>

          <div className="rounded-card border border-border bg-surface p-3 sm:p-4">
            <RangeGrid spot={draft} onPaint={onPaint} />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Legend spot={draft} combos={analysis.combosByAction} total={analysis.definedCombos || 1} />
              <span className={cx('ml-auto num text-sm', analysis.missingHands.length ? 'text-warn' : 'text-ok')}>{analysis.definedHands}/169 hands</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <GameButton onClick={doUndo} disabled={undo.current.length === 0}>
              <Icon name="refresh" size={16} className="-scale-x-100" /> Undo
            </GameButton>
            {foldId && (
              <GameButton onClick={() => commit(fillMissing(draft, foldId))} disabled={analysis.missingHands.length === 0}>
                Fill empty with fold
              </GameButton>
            )}
            <GameButton onClick={() => commit(clearAll(draft))} disabled={analysis.definedHands === 0} className="text-err">
              Clear all
            </GameButton>
          </div>
          <p className="text-xs text-faint">
            Tap or drag across cells to paint. Keys <span className="num">1</span>–<span className="num">{draft.actions.length}</span> pick a brush,
            <span className="num"> 0</span> erases, <span className="num">Ctrl/⌘ Z</span> undoes. Erased hands are <span className="text-muted">not provided</span>, never folds.
          </p>
        </div>

        <div className="space-y-4 min-w-0">
          <Panel title="Details">
            <div className="space-y-3">
              <Field label="Name">
                <input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Source">
                  <input className={inputClass} value={draft.source.name} onChange={(e) => setSource({ name: e.target.value })} />
                </Field>
                <Field label="Author">
                  <input className={inputClass} value={draft.source.author ?? ''} onChange={(e) => setSource({ author: e.target.value || undefined })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <select className={inputClass} value={draft.verification} onChange={(e) => set('verification', e.target.value as VerificationStatus)}>
                    {EDITABLE_STATUSES.map((v) => <option key={v} value={v}>{VERIFICATION_LABELS[v]}</option>)}
                  </select>
                </Field>
                <Field label="License">
                  <input className={inputClass} value={draft.source.license ?? ''} onChange={(e) => setSource({ license: e.target.value || undefined })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rake % (empty = unknown)">
                  <input className={inputClass} type="number" min={0} max={100} step={0.1} value={draft.rake.percent ?? ''}
                    onChange={(e) => set('rake', { ...draft.rake, percent: e.target.value === '' ? null : Number(e.target.value) })} />
                </Field>
                <Field label="Rake cap (BB, empty = unknown)">
                  <input className={inputClass} type="number" min={0} step={0.1} value={draft.rake.capBb ?? ''}
                    onChange={(e) => set('rake', { ...draft.rake, capBb: e.target.value === '' ? null : Number(e.target.value) })} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted min-h-11">
                <input type="checkbox" className="accent-[var(--color-brand)] w-4 h-4" checked={draft.source.proprietary}
                  onChange={(e) => setSource({ proprietary: e.target.checked })} />
                Proprietary range (coach, paid software…)
              </label>
              {draft.source.proprietary && (
                <label className="flex items-start gap-2 text-sm text-warn">
                  <input type="checkbox" className="mt-0.5 accent-[var(--color-brand)] w-4 h-4" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />
                  I confirm I am authorized to use this range in this app.
                </label>
              )}
              <Field label="Notes">
                <textarea className={cx(inputClass, 'h-20 py-2')} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
              </Field>
            </div>
          </Panel>

          <Panel title="Check" meta={validation.errors.length ? `${validation.errors.length} error(s)` : 'ready to save'}>
            {validation.errors.length === 0 && validation.warnings.length === 0 && <p className="text-sm text-ok">All good.</p>}
            <ul className="space-y-1 text-xs num">
              {validation.errors.map((i, k) => <li key={`e${k}`} className="text-err"><span className="text-muted">{i.path}</span> {i.message}</li>)}
              {validation.warnings.map((i, k) => <li key={`w${k}`} className="text-warn"><span className="text-muted">{i.path}</span> {i.message}</li>)}
              {blockedByAuth && <li className="text-err">confirm authorization to save a proprietary range</li>}
            </ul>
          </Panel>

          <Panel title="Spot setup" meta="from the original spot">
            <SpotMeta spot={draft} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full h-11 px-3 rounded-btn bg-bg border border-border text-text text-sm outline-none focus:border-brand placeholder:text-faint';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-2xs uppercase tracking-[0.1em] text-muted mb-1.5 truncate">{label}</span>
      {children}
    </label>
  );
}

function Brush({ active, color, hatched, onClick, hotkey, children }: {
  active: boolean;
  color: string;
  hatched?: boolean;
  onClick: () => void;
  hotkey: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      style={{ '--c': color } as CSSProperties}
      className={cx(
        'relative h-14 px-2 rounded-game border-2 font-display font-bold text-[15px] sm:text-[17px] uppercase tracking-[0.04em] leading-tight truncate',
        'transition-[transform,background-color] duration-100 active:translate-y-px',
        hatched ? 'cell-missing border-border text-muted' : 'bg-[color-mix(in_srgb,var(--c)_30%,var(--color-surface))] border-[color-mix(in_srgb,var(--c)_70%,transparent)] text-text',
        active && 'ring-2 ring-brand ring-offset-2 ring-offset-bg',
      )}
    >
      {children}
      <kbd className="absolute top-1 right-1.5 num text-2xs text-text/50 hidden md:inline">{hotkey}</kbd>
    </button>
  );
}
