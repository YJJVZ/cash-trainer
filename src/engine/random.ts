export type Rng = () => number;

/** Deterministic RNG (mulberry32) for tests and reproducibility. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cryptographic RNG for actual hand dealing. */
export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 4294967296;
};

export function pickIndex(length: number, rng: Rng): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('Empty list');
  return items[pickIndex(items.length, rng)]!;
}

/** Weighted pick; weights[i] >= 0. */
export function pickWeighted<T>(items: readonly T[], weights: readonly number[], rng: Rng): T {
  const total = weights.reduce((s, w) => s + w, 0);
  if (items.length === 0 || total <= 0) throw new Error('Weighted pick impossible');
  let x = rng() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i]!;
    if (x < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}
