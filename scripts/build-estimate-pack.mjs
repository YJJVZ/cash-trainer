#!/usr/bin/env node
// Builds the bundled default pack: estimated 6-max 100 BB preflop ranges.
//   npm run ranges:estimate   →   data/ranges/packs/estimate-6max-100bb.json
//
// These are ESTIMATES: an approximate synthesis of publicly discussed solver-based 6-max 100 BB strategies,
// slightly tightened for small-stakes rake. They are not solver output. Edit the specs below and re-run.
//
// Spec syntax, per action: space-separated tokens, each "hand", "hand+" (pairs: up to AA; others: kicker up to
// the card below the top card), "from-to" (same top card / pairs) or any of those followed by ":freq".
// The spot's default action takes whatever frequency is left (fold, or check for the BB vs a limp).
import { writeFileSync } from 'node:fs';

const OUT = new URL('../data/ranges/packs/estimate-6max-100bb.json', import.meta.url);
const VERSION = 2;
const R = 'AKQJT98765432';
const POS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const HANDS = [];
for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
  HANDS.push(i === j ? R[i] + R[j] : i < j ? R[i] + R[j] + 's' : R[j] + R[i] + 'o');
}

const OPEN = 2.5, SB_OPEN = 3, THREE_IP = 7.5, THREE_BLIND = 10, FOUR = 22, ISO = 4;

/* ------------------------------------------------------------------ */
/* Ranges                                                              */
/* ------------------------------------------------------------------ */

const RFI = {
  UTG: { raise: `22:0.4 33:0.6 44+ A2s+ K9s+ Q9s:0.4 QTs+ J9s:0.3 JTs T9s 98s:0.6 87s:0.4 76s:0.3 65s:0.3
    ATo:0.75 AJo+ KJo:0.6 KQo QJo:0.25` },
  HJ: { raise: `22+ A2s+ K7s:0.5 K8s+ Q9s+ J9s+ T8s:0.4 T9s 98s 87s:0.7 76s:0.6 65s:0.5 54s:0.3
    A9o:0.5 ATo+ KTo:0.4 KJo+ QJo:0.7 JTo:0.25` },
  CO: { raise: `22+ A2s+ K2s:0.3 K3s:0.4 K4s:0.6 K5s+ Q6s:0.4 Q7s:0.6 Q8s+ J7s:0.4 J8s+ T7s:0.5 T8s+ 97s+ 86s+ 75s:0.6 76s
    64s:0.3 65s 54s:0.7 A5o:0.4 A7o:0.4 A8o+ K9o:0.5 KTo+ Q9o:0.25 QTo+ J9o:0.2 JTo T9o:0.2` },
  BTN: { raise: `22+ A2s+ K2s+ Q2s:0.7 Q3s:0.8 Q4s+ J4s:0.5 J5s:0.7 J6s+ T5s:0.4 T6s+ 95s:0.4 96s+ 84s:0.3 85s+ 74s:0.6 75s+
    63s:0.4 64s+ 53s 54s 43s:0.6 A2o+ K5o:0.3 K6o:0.5 K7o:0.8 K8o+ Q8o:0.7 Q9o+ J8o:0.6 J9o+ T8o:0.6 T9o 98o:0.6 87o:0.3` },
  // Limp-heavy SB: raise a strong, linear range, limp a wide middle, fold the bottom.
  SB: {
    raise: `77+ 66:0.3 AJs+ ATs:0.6 A5s:0.6 A4s:0.4 KQs KJs:0.6 QJs:0.4 AQo+ AJo:0.6 KQo:0.4`,
    limp: `22-55 66:0.7 ATs:0.4 A6s-A9s A5s:0.4 A4s:0.6 A2s-A3s KJs:0.4 K4s-KTs K3s:0.8 K2s:0.7 QJs:0.6 Q5s-QTs Q4s:0.8
      Q3s:0.7 Q2s:0.6 J6s-JTs J5s:0.8 J4s:0.6 J3s:0.4 T6s-T9s T5s:0.6 T4s:0.4 96s-98s 95s:0.5 86s-87s 85s:0.7 84s:0.3
      75s-76s 74s:0.5 64s-65s 63s:0.4 53s-54s 43s:0.6 AJo:0.4 A4o-ATo A3o:0.8 A2o:0.7 KQo:0.6 K8o-KJo K7o:0.8 K6o:0.6
      K5o:0.5 K4o:0.3 Q9o-QJo Q8o:0.8 Q7o:0.4 Q6o:0.3 J9o-JTo J8o:0.7 J7o:0.3 T9o T8o:0.8 T7o:0.4 98o 97o:0.6 87o
      86o:0.4 76o:0.7 65o:0.5 54o:0.3`,
  },
};

/** Hero facing an open: [hero][opener] → { '3bet', call }. */
const VS_OPEN = {
  HJ: {
    UTG: { '3bet': `TT+ 99:0.6 88:0.4 AQs+ AJs:0.7 ATs:0.4 A5s:0.7 A4s:0.5 KQs:0.8 KJs:0.4 QJs:0.3 JTs:0.3 AKo AQo:0.6` },
  },
  CO: {
    UTG: { '3bet': `TT+ 99:0.6 88:0.4 77:0.3 AQs+ AJs:0.7 ATs:0.4 A5s:0.7 A4s:0.5 KQs:0.8 KJs:0.5 KTs:0.3 QJs:0.3 JTs:0.3
      T9s:0.3 AKo AQo:0.6 AJo:0.3` },
    HJ: { '3bet': `99+ 88:0.6 77:0.4 AJs+ ATs:0.7 A9s:0.3 A5s A4s:0.7 A3s:0.4 KQs KJs:0.7 KTs:0.5 QJs:0.6 QTs:0.4 JTs:0.5
      T9s:0.4 98s:0.3 AQo+ AJo:0.5 KQo:0.5` },
  },
  BTN: {
    UTG: {
      '3bet': `QQ+ AKs AQs:0.5 A5s:0.6 A4s:0.4 KQs:0.4 AKo`,
      call: `TT-JJ 99 88 77 66:0.7 55:0.6 44:0.5 33:0.4 22:0.4 AQs:0.5 AJs ATs A9s:0.4 KQs:0.6 KJs KTs:0.6 QJs QTs:0.5 JTs
        T9s 98s:0.6 87s:0.4 AQo:0.7 AJo:0.3 KQo:0.4`,
    },
    HJ: {
      '3bet': `JJ+ AKs AQs:0.6 AJs:0.4 A5s:0.7 A4s:0.5 A3s:0.3 KQs:0.5 KJs:0.3 AKo AQo:0.4`,
      call: `TT 22-99:0.6 AQs:0.4 AJs:0.6 ATs A9s:0.6 A8s:0.3 KQs:0.5 KJs:0.7 KTs K9s:0.4 QJs QTs Q9s:0.4 JTs J9s:0.5 T9s
        98s 87s:0.6 76s:0.5 65s:0.4 AQo:0.6 AJo:0.5 KQo:0.6 KJo:0.2`,
    },
    CO: {
      '3bet': `TT+ 99:0.4 AQs+ AJs:0.6 ATs:0.5 A9s:0.3 A4s-A5s A3s:0.6 A2s:0.4 KQs:0.7 KJs:0.5 KTs:0.4 K9s:0.3 QJs:0.4
        QTs:0.3 JTs:0.3 AQo+ AJo:0.5 ATo:0.3 KQo:0.5`,
      call: `99:0.6 55-88 44:0.8 22-33:0.7 AJs:0.4 ATs:0.5 A9s:0.7 A8s:0.6 A7s:0.5 A6s:0.4 A2s:0.4 KQs:0.3 KJs:0.5 KTs:0.6
        K9s:0.5 QJs:0.6 QTs:0.7 Q9s:0.5 JTs:0.7 J9s:0.6 T9s T8s:0.4 98s 97s:0.3 87s 76s 65s:0.7 54s:0.5 AJo:0.5 ATo:0.4
        KQo:0.5 KJo:0.5 QJo:0.4`,
    },
  },
  // SB: 3-bet or fold.
  SB: {
    UTG: { '3bet': `QQ+ JJ:0.7 TT:0.4 AKs AQs:0.8 AJs:0.4 A5s:0.5 A4s:0.4 KQs:0.6 AKo AQo:0.4` },
    HJ: { '3bet': `JJ+ TT:0.7 99:0.4 AQs+ AJs:0.7 ATs:0.4 A5s:0.7 A4s:0.5 KQs:0.8 KJs:0.4 QJs:0.3 AKo AQo:0.7 AJo:0.3` },
    CO: { '3bet': `TT+ 99:0.7 88:0.5 77:0.3 AJs+ ATs:0.8 A9s:0.4 A5s A4s:0.7 A3s:0.5 KQs KJs:0.8 KTs:0.5 QJs:0.6 QTs:0.4
      JTs:0.5 T9s:0.3 AQo+ AJo:0.7 ATo:0.3 KQo:0.6 KJo:0.3` },
    BTN: { '3bet': `88+ 77:0.8 66:0.6 55:0.5 44:0.4 22-33:0.3 A8s+ A7s:0.8 A6s:0.6 A5s A4s A3s:0.8 A2s:0.7 KTs+ K9s:0.7
      K8s:0.4 K5s-K7s:0.3 QTs+ Q9s:0.6 J9s+ T9s T8s:0.4 98s:0.6 87s:0.5 76s:0.5 65s:0.4 54s:0.3 ATo+ A9o:0.5 A8o:0.3 KJo+
      KTo:0.6 QJo:0.6 QTo:0.3 JTo:0.4` },
  },
  // BB: defends wide by calling, 3-bets a linear-ish value range plus suited bluffs.
  BB: {
    UTG: {
      '3bet': `QQ+ AKs AQs:0.5 A5s:0.5 A4s:0.4 KQs:0.3 AKo`,
      call: `22-JJ AQs:0.5 A8s-AJs A7s:0.8 A6s:0.7 A5s:0.5 A4s:0.6 A3s:0.8 A2s:0.7 KQs:0.7 K9s-KJs K8s:0.6 K7s:0.4 K6s:0.4
        K5s:0.3 Q9s-QJs Q8s:0.4 J9s-JTs J8s:0.4 T9s T8s:0.6 98s 97s:0.4 87s 86s:0.3 76s 65s 54s:0.7 AJo-AQo ATo:0.6 KQo
        KJo:0.6 KTo:0.3 QJo:0.6 QTo:0.3 JTo:0.4`,
    },
    HJ: {
      '3bet': `QQ+ JJ:0.4 AKs AQs:0.5 AJs:0.3 A5s:0.5 A4s:0.4 KQs:0.4 AKo AQo:0.3`,
      call: `JJ:0.6 22-TT AQs:0.5 AJs:0.7 A6s-ATs A5s:0.5 A4s:0.6 A2s-A3s KQs:0.6 K8s-KJs K7s:0.7 K6s:0.6 K5s:0.5 K4s:0.4
        Q9s-QJs Q8s:0.7 Q7s:0.3 J9s-JTs J8s:0.7 T8s-T9s 97s-98s 86s-87s 75s:0.5 76s 65s 64s:0.3 54s AQo:0.7 ATo-AJo
        A9o:0.4 KQo KJo KTo:0.6 QJo QTo:0.5 JTo:0.7 T9o:0.3`,
    },
    CO: {
      '3bet': `JJ+ TT:0.4 AKs AQs AJs:0.5 ATs:0.3 A5s:0.6 A4s:0.5 A3s:0.3 KQs:0.6 KJs:0.3 AKo AQo:0.5`,
      call: `TT:0.6 22-99 AJs:0.5 ATs:0.7 A6s-A9s A5s:0.4 A4s:0.5 A3s:0.7 A2s KQs:0.4 KJs:0.7 K5s-KTs K4s:0.7 K3s:0.5
        K2s:0.4 Q8s-QJs Q7s:0.6 Q6s:0.5 Q5s:0.3 J8s-JTs J7s:0.6 T8s-T9s T7s:0.6 97s-98s 96s:0.4 86s-87s 85s:0.3 75s-76s
        74s:0.2 65s 64s:0.6 54s 53s:0.5 43s:0.3 AQo:0.5 A9o-AJo A8o:0.5 A7o:0.3 A5o:0.3 KTo-KQo K9o:0.5 QTo-QJo Q9o:0.4
        JTo J9o:0.4 T9o 98o:0.4 87o:0.2`,
    },
    BTN: {
      '3bet': `TT+ 99:0.3 AJs+ ATs:0.5 A9s:0.3 A5s:0.6 A4s:0.6 A3s:0.4 A2s:0.3 KQs KJs:0.5 KTs:0.4 K9s:0.3 K5s:0.3 QJs:0.4
        QTs:0.3 JTs:0.3 AQo+ AJo:0.5 KQo:0.5 A5o:0.3`,
      call: `99:0.7 22-88 ATs:0.5 A9s:0.7 A6s-A8s A5s:0.4 A4s:0.4 A3s:0.6 A2s:0.7 KJs:0.5 KTs:0.6 K9s:0.7 K6s-K8s K5s:0.7
        K2s-K4s QJs:0.6 QTs:0.7 Q3s-Q9s Q2s:0.8 JTs:0.7 J6s-J9s J5s:0.8 J4s:0.6 J3s:0.4 J2s:0.3 T6s-T9s T5s:0.5 T4s:0.3
        96s-98s 95s:0.4 85s-87s 84s:0.3 75s-76s 74s:0.5 64s-65s 63s:0.4 53s-54s 52s:0.3 43s 42s:0.2 AJo:0.5 A6o-ATo
        A5o:0.7 A3o-A4o A2o:0.8 KQo:0.5 K8o-KJo K7o:0.7 K6o:0.5 K5o:0.4 K4o:0.2 Q9o-QJo Q8o:0.8 Q7o:0.3 J9o-JTo J8o:0.7
        T9o T8o T7o:0.3 98o 97o:0.4 87o 86o:0.2 76o:0.6 65o:0.4 54o:0.2`,
    },
    // vs the SB's strong raising range (it limps its weaker hands).
    SB: {
      '3bet': `QQ+ JJ:0.4 AKs AQs:0.4 A5s:0.5 A4s:0.4 KQs:0.3 AKo`,
      call: `JJ:0.6 22-TT AQs:0.6 A6s-AJs A5s:0.5 A4s:0.6 A2s-A3s KQs:0.7 K7s-KJs K6s:0.7 K5s:0.7 Q9s-QJs Q8s:0.6 J9s-JTs
        J8s:0.5 T8s-T9s 97s-98s 86s:0.6 87s 76s 75s:0.4 65s 54s 43s:0.3 AQo AJo ATo A9o:0.7 A8o:0.5 A5o:0.4 KQo KJo
        KTo:0.7 K9o:0.3 QJo QTo:0.5 JTo:0.6 T9o:0.3`,
    },
  },
};

/** Opener facing a 3-bet (only hands it opened). OOP = 3-bettor acts after hero postflop. */
const VS_3BET = {
  UTG: {
    oop: { '4bet': `KK+ QQ:0.4 AKs AKo:0.6 A5s:0.3`,
      call: `QQ:0.6 TT-JJ 99:0.5 88:0.3 AQs AJs:0.6 KQs:0.7 AKo:0.4 A5s:0.3 A4s:0.2 QJs:0.3 JTs:0.3` },
    ip: { '4bet': `KK+ QQ:0.3 AKs AKo:0.5 A5s:0.3`,
      call: `QQ:0.7 99-JJ 88:0.6 77:0.4 AQs AJs ATs:0.6 KQs KJs:0.6 QJs:0.6 JTs:0.6 T9s:0.4 AKo:0.5 AQo:0.5 A5s:0.4 A4s:0.4` },
  },
  HJ: {
    oop: { '4bet': `KK+ QQ:0.5 AKs AKo:0.7 A5s:0.4 A4s:0.3`,
      call: `QQ:0.5 TT-JJ 99:0.7 88:0.5 77:0.3 AQs AJs:0.8 ATs:0.4 KQs:0.8 KJs:0.4 QJs:0.4 JTs:0.4 T9s:0.3 AKo:0.3 AQo:0.4
        A5s:0.3 A4s:0.3` },
    ip: { '4bet': `KK+ QQ:0.4 AKs AKo:0.6 A5s:0.4 A4s:0.3`,
      call: `QQ:0.6 99-JJ 88:0.8 77:0.6 66:0.4 AQs AJs ATs:0.7 A9s:0.3 KQs KJs:0.8 KTs:0.5 QJs:0.8 QTs:0.4 JTs:0.8 T9s:0.6
        98s:0.4 AKo:0.4 AQo:0.6 AJo:0.2 KQo:0.3 A5s:0.4 A4s:0.4` },
  },
  CO: {
    oop: { '4bet': `QQ+ JJ:0.3 AKs AQs:0.3 A5s:0.5 A4s:0.4 A3s:0.2 AKo`,
      call: `JJ:0.7 99-TT 88:0.7 77:0.5 66:0.3 AQs:0.7 AJs ATs:0.7 A9s:0.3 KQs KJs:0.8 KTs:0.5 QJs:0.7 QTs:0.4 JTs:0.7
        T9s:0.5 98s:0.3 AQo:0.6 AJo:0.3 KQo:0.4 A5s:0.4 A4s:0.4` },
    ip: { '4bet': `QQ+ JJ:0.3 AKs AQs:0.3 A5s:0.5 A4s:0.4 A3s:0.3 AKo`,
      call: `JJ:0.7 88-TT 77:0.7 66:0.5 55:0.3 AQs:0.7 AJs ATs A9s:0.5 A8s:0.3 KQs KJs KTs:0.7 K9s:0.3 QJs QTs:0.6 JTs
        J9s:0.3 T9s:0.8 98s:0.6 87s:0.4 AQo:0.8 AJo:0.5 KQo:0.6 A5s:0.5 A4s:0.5 A3s:0.4` },
  },
  BTN: {
    ip: { '4bet': `QQ+ JJ:0.3 AKs AQs:0.3 A5s:0.5 A4s:0.4 A3s:0.3 AKo AQo:0.2`,
      call: `JJ:0.7 77-TT 66:0.8 55:0.6 44:0.5 22-33:0.4 AQs:0.7 AJs ATs A9s A8s:0.6 A7s:0.4 A6s:0.4 A5s:0.5 A4s:0.6 A3s:0.5
        A2s:0.4 KQs KJs KTs K9s:0.6 K8s:0.3 QJs QTs Q9s:0.5 JTs J9s:0.6 T9s T8s:0.4 98s 87s:0.8 76s:0.7 65s:0.6 54s:0.4
        AQo:0.8 AJo:0.6 ATo:0.3 KQo:0.6 KJo:0.3 QJo:0.2` },
  },
  SB: {
    oop: { '4bet': `QQ+ JJ:0.4 AKs AQs:0.3 A5s:0.4 A4s:0.4 AKo`,
      call: `JJ:0.6 77-TT AQs:0.7 ATs-AJs KJs-KQs QJs AQo AJo:0.5 KQo:0.6 A5s:0.4 A4s:0.4` },
  },
};

/** 3-bettor facing a 4-bet (only hands it 3-bet), by how wide the opener was. */
const VS_4BET = {
  tight: { allin: `KK+ QQ:0.3 AKs:0.7 AKo:0.4`, call: `QQ:0.7 AKs:0.3 AKo:0.5 JJ:0.6 TT:0.3 AQs:0.4` },
  loose: { allin: `QQ+ JJ:0.3 AKs AKo:0.8 A5s:0.2`,
    call: `JJ:0.7 TT:0.7 99:0.4 AKo:0.2 AQs:0.7 AJs:0.4 KQs:0.4 AQo:0.3 A5s:0.2` },
};

/** BB vs SB limp: raise value + some bluffs, check the rest. */
const BB_VS_LIMP = {
  raise: `66+ 55:0.5 A8s+ A5s A4s:0.7 A3s:0.5 KTs+ K9s:0.6 QTs+ Q9s:0.5 J9s+ T9s 98s:0.4 A9o+ A8o:0.5 KTo+ K9o:0.4 QTo+
    JTo:0.6 K4s:0.3 Q5s:0.3 J6s:0.3 T6s:0.3 96s:0.3 85s:0.3 K5o:0.3 Q6o:0.3 J7o:0.3 T7o:0.3`,
};

/* ------------------------------------------------------------------ */
/* Expansion                                                           */
/* ------------------------------------------------------------------ */

function expand(tok) {
  const fail = () => { throw new Error(`bad token "${tok}"`); };
  if (tok.includes('-')) {
    const [a, b] = tok.split('-');
    if (a.length === 2) { // pairs "22-66"
      if (b.length !== 2 || a[0] !== a[1] || b[0] !== b[1]) fail();
      const [hi, lo] = [R.indexOf(b[0]), R.indexOf(a[0])].sort((x, y) => x - y);
      return [...R.slice(hi, lo + 1)].map((c) => c + c);
    }
    if (a[0] !== b[0] || a[2] !== b[2]) fail();
    const [hi, lo] = [R.indexOf(a[1]), R.indexOf(b[1])].sort((x, y) => x - y);
    return [...R.slice(hi, lo + 1)].map((c) => a[0] + c + a[2]);
  }
  const plus = tok.endsWith('+');
  const t = plus ? tok.slice(0, -1) : tok;
  if (!HANDS.includes(t)) fail();
  if (!plus) return [t];
  if (t.length === 2) return [...R.slice(0, R.indexOf(t[0]) + 1)].map((c) => c + c);
  const out = [];
  for (let i = R.indexOf(t[1]); i > R.indexOf(t[0]); i--) out.push(t[0] + R[i] + t[2]);
  return out;
}

/**
 * Builds { hand: { action: freq } } for every hand of `reach` (all 169 by default).
 * Hands outside `reach` are dropped silently, so a spec can be shared by openers of different widths.
 */
function build(spec, defaultAction, reach = HANDS, where = '') {
  const out = {};
  for (const h of reach) out[h] = {};
  for (const [action, text] of Object.entries(spec)) {
    for (const tok of text.split(/\s+/).filter(Boolean)) {
      const [h, f] = tok.split(':');
      for (const x of expand(h)) {
        if (!(x in out)) continue;
        if (action in out[x]) throw new Error(`${where}: ${x} listed twice for ${action}`);
        out[x][action] = f ? Number(f) : 1;
      }
    }
  }
  for (const [h, s] of Object.entries(out)) {
    const used = Object.values(s).reduce((a, b) => a + b, 0);
    if (used > 1 + 1e-9) throw new Error(`${where}: ${h} frequencies sum to ${used}`);
    const rest = +(1 - used).toFixed(4);
    if (rest > 0) s[defaultAction] = rest;
    for (const k of Object.keys(s)) s[k] = +s[k].toFixed(4);
  }
  return out;
}

const played = (hands, actions) => HANDS.filter((h) => actions.some((a) => (hands[h]?.[a] ?? 0) > 0));

/* ------------------------------------------------------------------ */
/* Spots                                                               */
/* ------------------------------------------------------------------ */

const lower = (p) => p.toLowerCase();
const between = (a, b) => POS.slice(POS.indexOf(a) + 1, POS.indexOf(b));
const after = (p) => POS.slice(POS.indexOf(p) + 1);
const folds = (ps) => ps.map((position) => ({ position, kind: 'fold' }));
const openSize = (p) => (p === 'SB' ? SB_OPEN : OPEN);
const threeSize = (p) => (p === 'SB' || p === 'BB' ? THREE_BLIND : THREE_IP);
const isBlind = (p) => p === 'SB' || p === 'BB';
const FOLD = { id: 'fold', kind: 'fold', label: 'Fold' };
const CALL = { id: 'call', kind: 'call', label: 'Call' };

const spots = [];
const rfiHands = {};
const threeBetHands = {};

for (const hero of ['UTG', 'HJ', 'CO', 'BTN', 'SB']) {
  const actions = [FOLD];
  if (hero === 'SB') actions.push({ id: 'limp', kind: 'limp', label: 'Limp' });
  actions.push({ id: 'raise', kind: 'raise', label: hero === 'SB' ? `Raise ${SB_OPEN} BB` : `Open ${OPEN} BB`, sizeBb: openSize(hero) });
  const hands = build(RFI[hero], 'fold', HANDS, `rfi-${hero}`);
  rfiHands[hero] = hands;
  spots.push({
    id: `rfi-${lower(hero)}`, name: `${hero} — Open (RFI)`, family: 'RFI', hero,
    villains: after(hero), history: folds(POS.slice(0, POS.indexOf(hero))), actions, hands,
  });
}

for (const [hero, byOpener] of Object.entries(VS_OPEN)) {
  for (const [opener, spec] of Object.entries(byOpener)) {
    const size = threeSize(hero);
    const actions = [FOLD, ...(spec.call ? [CALL] : []), { id: '3bet', kind: 'raise', label: `3-bet ${size} BB`, sizeBb: size }];
    const hands = build(spec, 'fold', HANDS, `${hero} vs ${opener}`);
    threeBetHands[`${hero}|${opener}`] = played(hands, ['3bet']);
    spots.push({
      id: `${lower(hero)}-vs-${lower(opener)}-open`, name: `${hero} vs ${opener} open`, family: 'VS_OPEN', hero, villains: [opener],
      history: [...folds(POS.slice(0, POS.indexOf(opener))), { position: opener, kind: 'raise', sizeBb: openSize(opener) },
        ...folds(between(opener, hero))],
      actions, hands,
    });
  }
}

const threeBetHistory = (opener, three) => [
  ...folds(POS.slice(0, POS.indexOf(opener))),
  { position: opener, kind: 'raise', sizeBb: openSize(opener) },
  ...folds(between(opener, three)),
  { position: three, kind: 'raise', sizeBb: threeSize(three) },
  ...folds(after(three)),
];

for (const opener of ['UTG', 'HJ', 'CO', 'BTN', 'SB']) {
  for (const three of after(opener)) {
    const spec = VS_3BET[opener][isBlind(three) && !isBlind(opener) ? 'ip' : 'oop'] ?? VS_3BET[opener].ip;
    const reach = played(rfiHands[opener], ['raise']);
    spots.push({
      id: `${lower(opener)}-vs-${lower(three)}-3bet`, name: `${opener} open, vs ${three} 3-bet`, family: 'VS_3BET', hero: opener,
      villains: [three], history: threeBetHistory(opener, three),
      actions: [FOLD, CALL, { id: '4bet', kind: 'raise', label: `4-bet ${FOUR} BB`, sizeBb: FOUR }],
      hands: build(spec, 'fold', reach, `${opener} vs ${three} 3-bet`),
      notes: `Only hands ${opener} opens are provided.`,
    });
  }
}

for (const opener of ['UTG', 'HJ', 'CO', 'BTN', 'SB']) {
  for (const three of after(opener)) {
    const reach = threeBetHands[`${three}|${opener}`];
    spots.push({
      id: `${lower(three)}-vs-${lower(opener)}-4bet`, name: `${three} 3-bet, vs ${opener} 4-bet`, family: 'VS_4BET', hero: three,
      villains: [opener], history: [...threeBetHistory(opener, three), { position: opener, kind: 'raise', sizeBb: FOUR }],
      actions: [FOLD, CALL, { id: 'allin', kind: 'allin', label: '5-bet all-in', sizeBb: 100 }],
      hands: build(VS_4BET[opener === 'UTG' || opener === 'HJ' ? 'tight' : 'loose'], 'fold', reach, `${three} vs ${opener} 4-bet`),
      notes: `Only hands ${three} 3-bets against ${opener} are provided.`,
    });
  }
}

spots.push({
  id: 'bb-vs-sb-limp', name: 'BB vs SB limp', family: 'BVB_LIMP', hero: 'BB', villains: ['SB'],
  history: [...folds(['UTG', 'HJ', 'CO', 'BTN']), { position: 'SB', kind: 'limp', sizeBb: 1 }],
  actions: [{ id: 'check', kind: 'check', label: 'Check' }, { id: 'raise', kind: 'raise', label: `Raise ${ISO} BB`, sizeBb: ISO }],
  hands: build(BB_VS_LIMP, 'check', HANDS, 'bb vs limp'),
});

const pack = {
  schema: 'nl10-range-trainer/v2',
  pack: {
    id: 'estimate-6max-100bb',
    version: VERSION,
    name: 'Estimated 6-max 100 BB',
    format: { game: 'NLHE', tableSize: 6, stackBb: 100, tableType: 'regular' },
    sizing: {
      profileId: 'est-2.5-3-7.5-10-22',
      rfiBb: OPEN,
      sbRfiBb: SB_OPEN,
      threeBetIpBb: THREE_IP,
      threeBetOopBb: THREE_BLIND,
      fourBetBb: FOUR,
      description: `Opens ${OPEN} BB (SB ${SB_OPEN} BB), 3-bet ${THREE_IP} BB in position / ${THREE_BLIND} BB from the blinds, 4-bet ${FOUR} BB, 5-bet all-in, BB raises a SB limp to ${ISO} BB`,
    },
    sourceParameters: {
      site: null, stakes: null, rakePercent: null, rakeCapBb: null, noFlopNoDrop: null,
      notes: 'Approximate synthesis of publicly discussed solver-based 6-max 100 BB strategies, slightly tightened for small-stakes rake. Not solver output.',
    },
    source: {
      kind: 'other', name: 'Estimation (consensus of public 6-max 100 BB strategies)', author: 'Claude (estimation)', url: null,
      reference: 'scripts/build-estimate-pack.mjs', license: 'Own work, free to use', tool: null, producedAt: '2026-10-31', proprietary: false,
    },
    transcription: { status: 'unchecked', checkedBy: null, checkedAt: null, method: null },
    strategy: { standardRule: 'majority', tieBreak: ['allin', '4bet', '3bet', 'raise', 'call', 'limp', 'check', 'fold'] },
    compatibilityNote: 'Estimates for learning purposes; replace with your own verified ranges when you have them.',
  },
  spots,
};

writeFileSync(OUT, JSON.stringify(pack, null, 2) + '\n');
console.log(`Wrote ${spots.length} spots to ${OUT.pathname}`);
