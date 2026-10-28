import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card, Panel } from '../components/Card';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Layout';
import { VerificationBadge } from '../components/SpotMeta';
import { analyzeSpot } from '../ranges/analysis';
import { checkConsistency } from '../ranges/consistency';
import { DEMO_SPOTS } from '../ranges/demo/demoRanges';
import { exportCsv, exportJson, importCsv, importJson } from '../ranges/io';
import { exportPack } from '../ranges/pack';
import { FAMILY_LABELS, type RangeSpot } from '../ranges/types';
import type { Issue } from '../ranges/validation';
import { useStore } from '../state/store';
import { cx } from '../ui/cx';
import { downloadText } from '../ui/download';

interface Pending {
  fileName: string;
  spots: RangeSpot[];
  errors: Issue[];
  warnings: Issue[];
  needsAuthorization: string[];
}

function parseImport(fileName: string, text: string): Pending {
  const isCsv = /\.csv$/i.test(fileName) || text.trimStart().startsWith('#meta');
  if (isCsv) {
    const r = importCsv(text);
    return { fileName, spots: r.spot ? [r.spot] : [], errors: r.errors, warnings: r.warnings, needsAuthorization: r.needsAuthorization && r.spot ? [r.spot.id] : [] };
  }
  return { fileName, ...importJson(text) };
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Inline toolbar used when the library is embedded in the Settings screen. */
function Toolbar({ meta, children }: { title?: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 max-w-[1240px] mx-auto px-4 md:px-8 pt-5">
      <div className="text-sm text-muted mr-auto">{meta}</div>
      {children}
    </div>
  );
}

export function LibraryPage({ embedded = false }: { embedded?: boolean }) {
  const Header = embedded ? Toolbar : PageHeader;
  const { spots, saveSpots, deleteSpots, restoreDemo } = useStore();
  const [pending, setPending] = useState<Pending | null>(null);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const consistency = useMemo(() => checkConsistency(spots), [spots]);
  const demoMissing = DEMO_SPOTS.some((d) => !spots.some((s) => s.id === d.id));

  const onFile = async (file: File) => setPending(parseImport(file.name, await file.text()));
  const exportSel = selected.length ? spots.filter((s) => selected.includes(s.id)) : spots;

  return (
    <div>
      <Header title="Library" meta={<span className="num">{spots.length} spots</span>}>
        <Button size="sm" onClick={() => downloadText(`cash-trainer-${stamp()}.json`, exportJson(exportSel, 'Cash Trainer'), 'application/json')} disabled={!spots.length}>
          <Icon name="download" size={14} />
          Export {selected.length ? <span className="num text-muted">{selected.length}</span> : 'all'}
        </Button>
        <Button size="sm" variant="primary" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={14} />
          Import
        </Button>
        <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
      </Header>

      <div className="px-4 md:px-8 py-5 space-y-4 max-w-[1240px] mx-auto">
        {pending && <ImportReview pending={pending} existing={spots} onCancel={() => setPending(null)}
          onConfirm={async (toSave) => { await saveSpots(toSave); setPending(null); }} />}

        {consistency.length > 0 && (
          <Card className="px-3 py-2 border-warn/40 text-sm">
            {consistency.map((w) => (
              <div key={w.kind} className="text-warn">
                {w.message} <span className="text-muted num">{w.values.join(' / ')}</span>
              </div>
            ))}
            <div className="text-xs text-faint mt-1">The quiz shows the same warning if you select these spots together.</div>
          </Card>
        )}

        <Panel
          title="Spots"
          meta={selected.length ? `${selected.length} selected` : undefined}
          flush
          actions={
            <>
              {demoMissing && <Button size="sm" variant="ghost" onClick={() => void restoreDemo()}>Restore demo</Button>}
              {selected.length > 0 && (confirmDelete ? (
                <>
                  <Button size="sm" variant="danger" onClick={async () => { await deleteSpots(selected); setSelected([]); setConfirmDelete(false); }}>Confirm delete</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={14} />Delete</Button>
              ))}
            </>
          }
        >
          {spots.length === 0 ? (
            <p className="p-3 text-sm text-muted">Library is empty.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm sm:min-w-[720px]">
                <thead>
                  <tr className="text-xs text-muted text-left border-b border-border">
                    <th className="py-2 pl-3 w-8">
                      <input type="checkbox" aria-label="Select all" className="accent-[var(--color-brand)]"
                        checked={selected.length === spots.length} onChange={(e) => setSelected(e.target.checked ? spots.map((s) => s.id) : [])} />
                    </th>
                    <th className="py-2 px-3 font-medium">Spot</th>
                    <th className="py-2 px-3 font-medium hidden md:table-cell">Family</th>
                    <th className="py-2 px-3 font-medium">Coverage</th>
                    <th className="py-2 px-3 font-medium hidden md:table-cell">Source</th>
                    <th className="py-2 px-3 font-medium hidden sm:table-cell">Status</th>
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {spots.map((s) => {
                    const a = analyzeSpot(s);
                    const on = selected.includes(s.id);
                    return (
                      <tr key={s.id} className={cx('border-b border-border last:border-0', on && 'bg-surface-2')}>
                        <td className="py-2 pl-3">
                          <input type="checkbox" aria-label={`Select ${s.name}`} className="accent-[var(--color-brand)]" checked={on}
                            onChange={(e) => setSelected((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))} />
                        </td>
                        <td className="py-2 px-3">
                          <Link to={`/ranges?spot=${s.id}`} className="hover:text-brand">{s.name}</Link>
                          <div className="text-xs text-faint num">{s.id}{s.mode === 'pro' ? ' · pro' : ''}</div>
                        </td>
                        <td className="py-2 px-3 text-muted hidden md:table-cell">{FAMILY_LABELS[s.family]}</td>
                        <td className={cx('py-2 px-3 num', a.missingHands.length ? 'text-warn' : 'text-muted')}>{a.definedHands}/169</td>
                        <td className="py-2 px-3 text-muted max-w-[220px] truncate hidden md:table-cell" title={s.source.name}>
                          {s.source.proprietary && <span className="text-xs text-warn mr-1">proprietary</span>}
                          {s.source.name}
                        </td>
                        <td className="py-2 px-3 hidden sm:table-cell"><VerificationBadge spot={s} /></td>
                        <td className="py-2 px-3 text-right">
                          {s.pack && (
                            <Button size="sm" variant="ghost" title="Export the whole v2 pack with its original frequencies"
                              onClick={() => downloadText(`${s.pack!.header.id}.v${s.pack!.header.version}.json`, exportPack(spots.filter((x) => x.pack?.header.id === s.pack!.header.id)), 'application/json')}>
                              Pack
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => downloadText(`${s.id.replace(/[:/]/g, '_')}.csv`, exportCsv(s), 'text/csv')}>CSV</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Paste data" actions={<Button size="sm" variant="ghost" onClick={() => setShowPaste((v) => !v)}>{showPaste ? 'Hide' : 'Show'}</Button>}>
          {showPaste ? (
            <div className="space-y-2">
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} spellCheck={false}
                placeholder='{"schema": "nl10-range-trainer/v1", "spots": [...]}  or  CSV starting with #meta'
                className="w-full bg-bg border border-border rounded-btn p-2 num text-sm text-text placeholder:text-faint focus:border-border-strong outline-none" />
              <Button size="sm" disabled={!paste.trim()} onClick={() => setPending(parseImport('pasted', paste))}>Analyze</Button>
            </div>
          ) : (
            <p className="text-sm text-faint">Paste a library JSON or a spot CSV.</p>
          )}
        </Panel>

        <FormatHelp />
      </div>
    </div>
  );
}

function ImportReview({ pending, existing, onCancel, onConfirm }: {
  pending: Pending;
  existing: RangeSpot[];
  onCancel: () => void;
  onConfirm: (spots: RangeSpot[]) => void;
}) {
  const [authorized, setAuthorized] = useState<string[]>([]);
  const blocked = pending.needsAuthorization.filter((id) => !authorized.includes(id));
  const importable = pending.spots.filter((s) => !blocked.includes(s.id));
  const mixWarnings = checkConsistency([...existing.filter((e) => !pending.spots.some((p) => p.id === e.id)), ...pending.spots]);

  return (
    <Panel title="Import" meta={pending.fileName} className="border-border-strong"
      actions={<Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}>
      <div className="space-y-3">
        {pending.errors.length > 0 && (
          <div>
            <div className="text-sm text-err font-medium mb-1">{pending.errors.length} error{pending.errors.length > 1 ? 's' : ''}: data rejected</div>
            <IssueList issues={pending.errors} tone="err" />
          </div>
        )}
        {pending.warnings.length > 0 && (
          <div>
            <div className="text-sm text-warn font-medium mb-1">{pending.warnings.length} warning{pending.warnings.length > 1 ? 's' : ''}</div>
            <IssueList issues={pending.warnings} tone="warn" />
          </div>
        )}
        {mixWarnings.length > 0 && (
          <div className="text-sm text-warn">
            {mixWarnings.map((w) => <div key={w.kind}>After import: {w.message} <span className="text-muted num">{w.values.join(' / ')}</span></div>)}
          </div>
        )}

        {pending.spots.length > 0 && (
          <ul className="border border-border rounded-card divide-y divide-border">
            {pending.spots.map((s) => {
              const replaces = existing.some((e) => e.id === s.id);
              const needsAuth = pending.needsAuthorization.includes(s.id);
              return (
                <li key={s.id} className="px-3 py-2 text-sm space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <VerificationBadge spot={s} />
                    {replaces && <span className="text-xs text-warn">replaces the existing spot</span>}
                    <span className="ml-auto num text-xs text-muted">{analyzeSpot(s).definedHands}/169 hands</span>
                  </div>
                  {needsAuth && (
                    <label className="flex items-start gap-2 text-xs text-warn">
                      <input type="checkbox" className="mt-0.5 accent-[var(--color-brand)]" checked={authorized.includes(s.id)}
                        onChange={(e) => setAuthorized((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))} />
                      Proprietary range ({s.source.name}). I confirm I am authorized to use it in this app.
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={importable.length === 0}
            onClick={() => onConfirm(importable.map((s) => (authorized.includes(s.id) ? { ...s, source: { ...s.source, authorizedByUser: true } } : s)))}>
            Import {importable.length} spot{importable.length > 1 ? 's' : ''}
          </Button>
          {blocked.length > 0 && <span className="text-xs text-muted">{blocked.length} spot(s) awaiting authorization</span>}
        </div>
      </div>
    </Panel>
  );
}

function IssueList({ issues, tone }: { issues: Issue[]; tone: 'err' | 'warn' }) {
  const shown = issues.slice(0, 30);
  return (
    <ul className={cx('max-h-48 overflow-auto text-xs num space-y-0.5 bg-bg border border-border rounded-btn p-2', tone === 'err' ? 'text-err' : 'text-warn')}>
      {shown.map((i, k) => <li key={k}><span className="text-muted">{i.path || '—'}</span> {i.message}</li>)}
      {issues.length > shown.length && <li className="text-faint">… {issues.length - shown.length} more</li>}
    </ul>
  );
}

function FormatHelp() {
  return (
    <Panel title="Data format">
      <div className="grid gap-4 md:grid-cols-2 text-sm text-muted">
        <div className="space-y-2">
          <p><span className="text-text">JSON</span>: object <code className="num text-text">{'{ "schema": "nl10-range-trainer/v1", "spots": [...] }'}</code>. Each spot declares format, depth, positions, history, sizings, rake (including cap), source, verification status, legal actions and each hand's strategy.</p>
          <p><span className="text-text">CSV</span>: one spot per file. A <code className="num text-text">#meta,{'{…}'}</code> line (JSON metadata), then <code className="num text-text">hand,fold,call,…</code> and one row per hand with its frequencies. Separator <code className="num">,</code> or <code className="num">;</code>.</p>
        </div>
        <ul className="space-y-1.5 list-disc pl-4">
          <li>A missing hand stays <span className="text-text">not provided</span>: it is never treated as a fold or quizzed.</li>
          <li>A hand's frequencies must sum to 1. Mixed frequencies require <code className="num">"mode": "pro"</code>.</li>
          <li>Different sizings, rakes or depths across spots trigger a warning.</li>
          <li>A range marked <code className="num">"proprietary": true</code> is only imported after you confirm authorization.</li>
        </ul>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => downloadText('spot-template.csv', exportCsv(DEMO_SPOTS[0]!), 'text/csv')}>CSV template</Button>
        <Button size="sm" onClick={() => downloadText('library-template.json', exportJson([DEMO_SPOTS[0]!], 'Template'), 'application/json')}>JSON template</Button>
      </div>
    </Panel>
  );
}
