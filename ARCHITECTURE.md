# NL10 Range Trainer — Architecture

## 1. Principles

1. **No invented data presented as authentic.** The only bundled range is a *fictional* demo,
   generated from a public heuristic (the Chen formula) and flagged `verification: "demo"` +
   `source.kind: "demo"` everywhere in the UI.
2. **Missing ≠ fold.** A hand that is not provided is `undefined` in `spot.hands`. It is shown as
   "not provided" (hatched), never quizzed and never counted as a fold. A fold is written
   explicitly as `{ "fold": 1 }`.
3. **No silent mixing.** Different sizing profiles, rake models, depths or formats across spots →
   a warning in the library and in the quiz settings.
4. **Proprietary ranges**: a file flagged `source.proprietary: true` is only imported after the
   user explicitly confirms (`source.authorizedByUser: true`). Nothing is downloaded or bundled
   automatically.
5. **Ready for Pro mode**: every hand carries a *strategy* `{ actionId: frequency }`.
   Standard mode is simply the case where one frequency equals 1. Rendering (split cells) and the
   grading policy (`ScoringPolicy`) already support mixed frequencies.

## 2. Layout

```
src/
├── engine/          Pure poker engine (no React dependency)
│   ├── cards.ts        ranks, suits, 52 cards
│   ├── hands.ts        169 classes, 13×13 grid, 1,326 combos
│   ├── positions.ts    6-max positions, preflop action order
│   ├── actions.ts      action kinds, color groups
│   └── random.ts       deterministic RNG (tests) / crypto RNG (prod)
├── ranges/          Range data and format
│   ├── types.ts        RangeSpot, RangeLibrary, Strategy…
│   ├── validation.ts   structural validation + warnings
│   ├── consistency.ts  detects sizing / rake / format mixing
│   ├── io.ts           JSON & CSV import/export
│   ├── analysis.ts     combo % per action, coverage
│   ├── describe.ts     readable history / situation text
│   ├── pack.ts         v2 range packs: validation, RFI rules, expansion, export
│   ├── standard.ts     Standard simplification (majority, deterministic ties)
│   ├── target.ts       target environment (PokerStars NL10) + computed compatibility
│   ├── coverage.ts     hides demo spots covered by a real pack (training only)
│   ├── packTools.ts    CSV merge, check report, diff (used by `npm run ranges`)
│   └── demo/           FICTIONAL demo range
├── quiz/            Pure quiz engine
│   ├── engine.ts       spot selection, dealing, grading
│   ├── explain.ts      explanation generated from the data
│   └── scoring.ts      grading policy (Standard / future Pro)
├── stats/           Pure statistics
│   ├── aggregate.ts    totals, by position, by spot, mistakes
│   └── srs.ts          spaced repetition (Leitner boxes)
├── storage/         IndexedDB persistence (idb)
├── state/           React store (context) linking storage ↔ UI
├── components/      Reusable visual components
└── pages/           Main menu, Play, Ranges, Progress, My mistakes, Settings (+ embedded Library)
```

The `engine`, `ranges`, `quiz` and `stats` folders are pure TypeScript, tested without a DOM.

## 3. Data model (format `nl10-range-trainer/v1`)

```jsonc
{
  "schema": "nl10-range-trainer/v1",
  "name": "My library",
  "spots": [{
    "id": "btn-rfi",
    "name": "BTN — Open (RFI)",
    "family": "RFI",                    // RFI | VS_OPEN | VS_3BET | VS_4BET | BVB_LIMP
    "mode": "standard",                 // standard | pro
    "format": { "game": "NLHE", "tableSize": 6, "stackBb": 100,
                "site": "PokerStars.com", "stakes": "NL10", "tableType": "regular" },
    "hero": "BTN",
    "villains": ["SB", "BB"],
    "history": [ { "position": "UTG", "kind": "fold" }, … ],
    "sizing": { "profileId": "std-2.5-3", "rfiBb": 2.5, "sbRfiBb": 3, "description": "…" },
    "rake":   { "modelId": "ps-nl10", "percent": 5, "capBb": null, "noFlopNoDrop": true,
                "description": "…" },
    "source": { "kind": "demo", "name": "…", "proprietary": false },
    "verification": "demo",             // demo | unverified | community | verified
    "actions": [ { "id": "fold", "kind": "fold", "label": "Fold" },
                 { "id": "raise", "kind": "raise", "label": "Open 2.5 BB", "sizeBb": 2.5 } ],
    "hands": { "AA": { "raise": 1 }, "72o": { "fold": 1 } /* missing hands = not provided */ }
  }]
}
```

CSV (one spot per file): a `#meta,<metadata JSON>` line, then a `hand,<actionId>,<actionId>…`
table of frequencies. A hand missing from the table stays not provided.

## 3b. Range packs (format `nl10-range-trainer/v2`)

Authoring/exchange format for real ranges: one source, one sizing profile, one set of source parameters for all its
spots. Documented in [data/ranges/README.md](data/ranges/README.md). At import, a pack is expanded into the internal v1
spot format (`id = <packId>:<spotId>`, Standard hands derived, original frequencies kept in `spot.pack.sourceHands`),
so the quiz engine is unchanged. v1 libraries remain importable and v1 snapshots keep the pack provenance.

## 4. Build steps

| Step | Content | Status |
|---|---|---|
| 1 | Scaffold Vite + React + TS + Tailwind + PWA + Vitest | V1 |
| 2 | Engine: cards, 13×13 grid, 1,326 combos + tests | V1 |
| 3 | Data format, validation, consistency, import/export + tests | V1 |
| 4 | Fictional demo range | V1 |
| 5 | Quiz engine, explanations, mistake review + tests | V1 |
| 6 | Statistics + spaced repetition + tests | V1 |
| 7 | IndexedDB + store | V1 |
| 8 | UI: main menu hub, play table, viewer, progress, mistakes, settings | V1 |
| 9 | Pro mode: frequency quiz, range editor, spot comparison | future |
| 10 | Import your own verified ranges (licensed) | up to you |

## 5. Pro mode (groundwork only)

- `Strategy` already accepts several actions with frequencies.
- `RangeGrid` renders mixed cells as proportional bands.
- `ScoringPolicy`: `standardPolicy` (majority action) and `proPolicy` (frequency threshold)
  both exist; only the former is exposed in the UI.
- `mode: "pro"` spots are visible in the viewer but excluded from the Standard quiz.
