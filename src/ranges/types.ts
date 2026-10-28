import type { ActionKind } from '../engine/actions';
import type { HandClass } from '../engine/hands';
import type { Position } from '../engine/positions';

/** Library snapshot format (loose spots). Still the internal/export format. */
export const SCHEMA_ID = 'nl10-range-trainer/v1';
/** Range pack authoring/exchange format (one source, one sizing, shared parameters). */
export const PACK_SCHEMA_ID = 'nl10-range-trainer/v2';

export const SPOT_FAMILIES = ['RFI', 'VS_OPEN', 'VS_3BET', 'VS_4BET', 'BVB_LIMP'] as const;
export type SpotFamily = (typeof SPOT_FAMILIES)[number];

export const FAMILY_LABELS: Record<SpotFamily, string> = {
  RFI: 'Open (RFI)',
  VS_OPEN: 'Facing an open',
  VS_3BET: 'Facing a 3-bet',
  VS_4BET: 'Facing a 4-bet',
  BVB_LIMP: 'BB vs SB limp',
};

export type SpotMode = 'standard' | 'pro';

export const VERIFICATION_STATUSES = ['demo', 'unverified', 'community', 'verified'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  demo: 'Fictional demo',
  unverified: 'Unverified',
  community: 'Community',
  verified: 'Verified',
};

export const SOURCE_KINDS = ['demo', 'user', 'solver', 'coach', 'book', 'other'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface GameFormat {
  game: 'NLHE';
  tableSize: number;
  stackBb: number;
  site?: string;
  stakes?: string;
  tableType?: string;
}

/** Action already taken before hero. */
export interface HistoryAction {
  position: Position;
  kind: ActionKind;
  /** Total bet size in BB (e.g. open 2.5). */
  sizeBb?: number;
}

/** Legal action for hero in this spot. */
export interface ActionOption {
  id: string;
  kind: ActionKind;
  label: string;
  sizeBb?: number;
}

export interface SizingProfile {
  /** Identifier compared across spots to detect mixing. */
  profileId: string;
  description?: string;
  rfiBb?: number;
  sbRfiBb?: number;
  threeBetIpBb?: number;
  threeBetOopBb?: number;
  fourBetBb?: number;
}

export interface RakeModel {
  modelId: string;
  /** Rake percentage; null = unknown (never defaulted). */
  percent: number | null;
  /** Cap in BB; null = unknown / not provided. */
  capBb: number | null;
  /** null = unknown. */
  noFlopNoDrop: boolean | null;
  description?: string;
}

export interface DataSource {
  kind: SourceKind;
  name: string;
  author?: string;
  url?: string;
  license?: string;
  /** Proprietary range (coach, paid software…). */
  proprietary: boolean;
  /** The user confirmed they hold the rights to use it. */
  authorizedByUser?: boolean;
  notes?: string;
}

/** Frequencies by action id; sum = 1. */
export type Strategy = Record<string, number>;

/**
 * Strategies by hand. A MISSING hand is not a fold: it is "not provided"
 * and must never be quizzed or counted as a fold.
 */
export type HandMap = Partial<Record<HandClass, Strategy>>;

/* ------------------------------------------------------------------ */
/* Range packs (schema v2)                                             */
/* ------------------------------------------------------------------ */

/** Parameters the SOURCE of the ranges assumed. Independent from the app's target; null = unknown. */
export interface SourceParameters {
  site: string | null;
  stakes: string | null;
  rakePercent: number | null;
  rakeCapBb: number | null;
  noFlopNoDrop: boolean | null;
  notes?: string | null;
}

/** Was the data entry checked against the source? Says nothing about strategic quality. */
export interface Transcription {
  status: 'unchecked' | 'checked';
  checkedBy: string | null;
  checkedAt: string | null;
  method: string | null;
}

export interface PackSource extends DataSource {
  reference?: string | null;
  tool?: string | null;
  producedAt?: string | null;
}

export interface PackHeader {
  id: string;
  version: number;
  name: string;
  format: { game: 'NLHE'; tableSize: number; stackBb: number; tableType?: string | null };
  sizing: SizingProfile;
  sourceParameters: SourceParameters;
  source: PackSource;
  transcription: Transcription;
  /** Standard mode = majority action; ties broken by `tieBreak` order (default: actions declaration order). */
  strategy: { standardRule: 'majority'; tieBreak: string[] | null };
  /** Optional human justification of why the ranges suit the target environment. */
  compatibilityNote?: string | null;
}

/** Pack provenance kept on every spot expanded from a pack. */
export interface SpotPackInfo {
  header: PackHeader;
  /** Spot id inside the pack file. */
  spotId: string;
  /** Original frequencies, untouched (future Pro mode). */
  sourceHands: HandMap;
  /** Hands whose source strategy was mixed and got simplified by the Standard rule. */
  simplifiedHands: HandClass[];
}

export interface RangeSpot {
  id: string;
  name: string;
  family: SpotFamily;
  mode: SpotMode;
  format: GameFormat;
  hero: Position;
  villains: Position[];
  history: HistoryAction[];
  sizing: SizingProfile;
  rake: RakeModel;
  source: DataSource;
  verification: VerificationStatus;
  actions: ActionOption[];
  hands: HandMap;
  notes?: string;
  updatedAt?: string;
  /** Present when the spot comes from a v2 range pack. */
  pack?: SpotPackInfo;
}

export interface RangeLibrary {
  schema: typeof SCHEMA_ID;
  name?: string;
  exportedAt?: string;
  spots: RangeSpot[];
}
