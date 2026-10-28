import type { HandClass } from '../engine/hands';
import type { Position } from '../engine/positions';
import type { Verdict } from '../quiz/scoring';
import type { SpotFamily } from '../ranges/types';

export interface AnswerRecord {
  id: string;
  ts: number;
  sessionId: string;
  spotId: string;
  spotName: string;
  family: SpotFamily;
  hero: Position;
  hand: HandClass;
  combo: string;
  chosen: string;
  chosenLabel: string;
  expectedLabel: string;
  verdict: Verdict;
  origin: 'random' | 'review' | 'srs';
}
