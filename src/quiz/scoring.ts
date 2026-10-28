import { topActions } from '../ranges/analysis';
import type { Strategy } from '../ranges/types';

export type Verdict = 'correct' | 'partial' | 'wrong';

export interface ScoringPolicy {
  id: 'standard' | 'pro';
  evaluate(strategy: Strategy, actionId: string): Verdict;
}

/** Standard: only the majority action (or a tied one) is correct. */
export const standardPolicy: ScoringPolicy = {
  id: 'standard',
  evaluate: (strategy, actionId) => (topActions(strategy).includes(actionId) ? 'correct' : 'wrong'),
};

/** Pro (future): an action played at frequency ≥ threshold is "partial". */
export function proPolicy(threshold = 0.15): ScoringPolicy {
  return {
    id: 'pro',
    evaluate: (strategy, actionId) => {
      if (topActions(strategy).includes(actionId)) return 'correct';
      return (strategy[actionId] ?? 0) >= threshold ? 'partial' : 'wrong';
    },
  };
}
