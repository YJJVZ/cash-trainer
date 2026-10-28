export const ACTION_KINDS = ['fold', 'check', 'call', 'limp', 'raise', 'allin'] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export function isActionKind(value: unknown): value is ActionKind {
  return typeof value === 'string' && (ACTION_KINDS as readonly string[]).includes(value);
}

/** Color group: grey (fold), blue (call/check), red (raise/3-bet/4-bet/all-in), green (limp). */
export type ActionColor = 'fold' | 'call' | 'raise' | 'limp';

export function actionColor(kind: ActionKind): ActionColor {
  switch (kind) {
    case 'fold':
      return 'fold';
    case 'check':
    case 'call':
      return 'call';
    case 'limp':
      return 'limp';
    case 'raise':
    case 'allin':
      return 'raise';
  }
}
