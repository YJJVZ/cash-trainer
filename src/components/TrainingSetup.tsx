import { POSITIONS, type Position } from '../engine/positions';
import { FAMILY_LABELS, SPOT_FAMILIES, type SpotFamily } from '../ranges/types';
import { useLocalSetting } from '../ui/useLocalSetting';
import { ToggleGroup } from './Tabs';

export interface TrainingConfig {
  families: SpotFamily[];
  heroes: Position[];
  srs: boolean;
  /** Show default spots even when an imported range pack covers the same situation (default: hidden). */
  showCoveredDefaults?: boolean;
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = { families: ['RFI', 'VS_OPEN'], heroes: [...POSITIONS], srs: true };

/** Training settings shared by the game screen and the Settings screen. */
export function useTrainingConfig() {
  return useLocalSetting<TrainingConfig>('train.config', DEFAULT_TRAINING_CONFIG);
}

export function TrainingSetupForm({ config, onChange }: { config: TrainingConfig; onChange: (c: TrainingConfig) => void }) {
  return (
    <div className="space-y-5">
      <ToggleGroup label="Spot families" items={SPOT_FAMILIES.map((f) => ({ id: f, label: FAMILY_LABELS[f] }))}
        value={config.families} onChange={(families) => onChange({ ...config, families })} />
      <ToggleGroup label="Hero position" items={POSITIONS.map((p) => ({ id: p, label: p }))}
        value={config.heroes} onChange={(heroes) => onChange({ ...config, heroes })} />
      <label className="flex items-center gap-3 text-sm text-muted min-h-11">
        <input type="checkbox" className="accent-[var(--color-brand)] w-4 h-4" checked={config.srs}
          onChange={(e) => onChange({ ...config, srs: e.target.checked })} />
        Mix in hands due for spaced repetition (≈ 30% of questions)
      </label>
      <label className="flex items-center gap-3 text-sm text-muted min-h-11">
        <input type="checkbox" className="accent-[var(--color-brand)] w-4 h-4" checked={!!config.showCoveredDefaults}
          onChange={(e) => onChange({ ...config, showCoveredDefaults: e.target.checked })} />
        Also train default spots already covered by an imported range pack
      </label>
    </div>
  );
}
