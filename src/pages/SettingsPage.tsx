import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Badge, Panel, Stat } from '../components/Card';
import { PageHeader } from '../components/Layout';
import { Tabs } from '../components/Tabs';
import { TrainingSetupForm, useTrainingConfig } from '../components/TrainingSetup';
import { analyzeSpot } from '../ranges/analysis';
import { checkConsistency } from '../ranges/consistency';
import { trainingSpots } from '../ranges/coverage';
import { DEMO_SPOTS, isDemoSpot } from '../ranges/demo/demoRanges';
import { exportJson } from '../ranges/io';
import { eligibleSpots } from '../quiz/engine';
import { useStore } from '../state/store';
import { downloadText } from '../ui/download';
import { LibraryPage } from './LibraryPage';

type TabId = 'training' | 'library' | 'data';

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('tab') === 'library' ? 'library' : params.get('tab') === 'data' ? 'data' : 'training';
  return (
    <div>
      <PageHeader title="Settings" />
      <Tabs<TabId>
        className="px-2 md:px-6"
        value={tab}
        onChange={(t) => setParams(t === 'training' ? {} : { tab: t }, { replace: true })}
        items={[
          { id: 'training', label: 'Training' },
          { id: 'library', label: 'Ranges' },
          { id: 'data', label: 'Data' },
        ]}
      />
      {tab === 'training' ? <TrainingTab /> : tab === 'library' ? <LibraryPage embedded /> : <DataTab />}
    </div>
  );
}

function TrainingTab() {
  const { spots } = useStore();
  const [config, setConfig] = useTrainingConfig();
  const pool = eligibleSpots(trainingSpots(spots, config.showCoveredDemos), config);
  return (
    <div className="max-w-[800px] mx-auto px-4 md:px-8 py-6">
      <Panel title="What to train" meta={`${pool.length} eligible spot${pool.length === 1 ? '' : 's'}`}>
        <TrainingSetupForm config={config} onChange={setConfig} />
      </Panel>
    </div>
  );
}

function DataTab() {
  const { spots, answers, srs, persistent, resetStats, restoreDemo } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const consistency = useMemo(() => checkConsistency(spots), [spots]);
  const demoCount = spots.filter(isDemoSpot).length;
  const incomplete = spots.filter((s) => analyzeSpot(s).missingHands.length > 0).length;
  const demoMissing = DEMO_SPOTS.some((d) => !spots.some((s) => s.id === d.id));

  return (
    <div className="max-w-[800px] mx-auto px-4 md:px-8 py-6 space-y-5">
      <Panel title="Library" meta={`${spots.length} spots`} flush>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
          <div className="bg-surface p-4"><Stat label="Spots" value={spots.length} /></div>
          <div className="bg-surface p-4"><Stat label="Fictional demo" value={demoCount} /></div>
          <div className="bg-surface p-4"><Stat label="Verified" value={spots.filter((s) => s.verification === 'verified').length} /></div>
          <div className="bg-surface p-4"><Stat label="Incomplete" value={incomplete} sub="hands not provided" /></div>
        </div>
        {consistency.length > 0 && (
          <div className="px-4 py-3 border-t border-border text-sm text-warn">
            {consistency.map((w) => <div key={w.kind}>{w.message}</div>)}
          </div>
        )}
        <div className="flex flex-wrap gap-2 p-4 border-t border-border">
          <Button disabled={!spots.length}
            onClick={() => downloadText(`cash-trainer-${new Date().toISOString().slice(0, 10)}.json`, exportJson(spots, 'Cash Trainer'), 'application/json')}>
            Export all ranges (JSON)
          </Button>
          {demoMissing && <Button onClick={() => void restoreDemo()}>Restore demo spots</Button>}
        </div>
      </Panel>

      <Panel title="Progress data" meta={`${answers.length} answers · ${srs.length} tracked hands`}>
        <p className="text-sm text-muted mb-4">
          Everything is stored locally in this browser{persistent ? '' : ' — but local storage is unavailable right now, so nothing will be kept'}.
        </p>
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-err mr-2">Erase all answers and memory boxes?</span>
            <Button variant="danger" onClick={() => { void resetStats(); setConfirmReset(false); }}>Erase all</Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="danger" disabled={!answers.length && !srs.length} onClick={() => setConfirmReset(true)}>Reset statistics</Button>
        )}
      </Panel>

      <Panel title="About" actions={demoCount > 0 ? <Badge tone="demo">Fictional demo</Badge> : undefined}>
        <p className="text-sm text-muted">
          Cash Trainer — preflop range training for NLHE 6-max, 100 BB. The bundled demo ranges are generated from the Chen formula
          with arbitrary thresholds: they are not GTO and must not be used in real games. Import ranges you have the rights to.
        </p>
      </Panel>
    </div>
  );
}
