# Cash Trainer — NL10 Range Trainer

Preflop range training for NLHE 6-max cash games, 100 BB effective (reference: PokerStars.com NL10).
Installable PWA, 100% local (IndexedDB), no backend.

> **The bundled ranges are ESTIMATES**: an approximate synthesis of publicly discussed solver-based 6-max 100 BB
> strategies (RFI with a SB limp strategy, vs open, vs 3-bet, vs 4-bet, BB vs SB limp), built by
> `npm run ranges:estimate` from `scripts/build-estimate-pack.mjs`. They are not solver output and not verified.
> They are not GTO, not solver output and not verified. Import your own ranges (that you have the rights to)
> through the Library.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest tests (engine, data, quiz, stats)
npm run build      # typecheck + production build (dist/) with service worker
npm run preview    # serves the build
npm run ranges -- check <pack.json>   # validate a v2 range pack (see data/ranges/README.md)
```

## Deploying to Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- `public/_redirects` handles SPA routing.

## Screens

The main menu is the hub (game-style): every screen has a single **MENU** button to go back, and `Esc` also returns to the menu.

| Screen | Route | Purpose |
|---|---|---|
| Main menu | `/` | PLAY, Ranges, Progress, My mistakes, Settings, progress preview |
| Play | `/train` | Visual 6-max table (seats, actions, chips, dealer button, pot), dealt cards, big action buttons (`1`…`n`), verdict, explanation, revealed range, session mistakes review. `?review=due` / `?review=mistakes` start a review queue |
| Ranges | `/ranges` | 13×13 grid, per-hand detail, breakdown, spot metadata |
| Progress | `/stats` | Totals, 14-day activity, accuracy by position / spot / family |
| My mistakes | `/mistakes` | Replay mistakes, due hands, most missed hands, memory boxes, full mistake history |
| Settings | `/settings` | Training setup, ranges library (JSON & CSV import/export, validation, proprietary authorization), data (export, reset, restore defaults) |

`/library` and `/dashboard` redirect to Settings → Ranges and Progress.

## Data

Real ranges are imported as **v2 range packs**: see [data/ranges/README.md](data/ranges/README.md).

The format is documented in [ARCHITECTURE.md](ARCHITECTURE.md) and on the Library screen (downloadable JSON/CSV templates).

Rules enforced by validation:

- a missing hand is **not provided** (hatched): never a fold, never quizzed;
- frequencies in [0, 1], summing to 1; mixed frequencies only with `mode: "pro"`;
- format, depth, positions, history, sizings, rake + cap, source and verification status are required;
- a `demo` source cannot be marked as verified;
- different sizings / rake / depth / format across spots → warning;
- `source.proprietary: true` → imported only after the user explicitly confirms authorization.

## Design system

Tokens live in `src/index.css` (`@theme`): colors, typography (self-hosted IBM Plex Sans / Mono and Barlow Condensed
for display), spacing (4 px base), radii (`--radius-btn: 5px`, `--radius-card: 6px`, `--radius-game: 6px`),
control heights (40 px desktop / 44 px touch).
Yellow `#FFD900` is reserved for the brand, primary actions and selection indicators; it is never a strategy color.

Components: `Button`, `PlayButton`, `MenuButton`, `BigActionButton`, `GameButton`, `Card`, `Panel`, `Stat`, `Badge`, `Tabs`,
`ToggleGroup`, `Modal`, `RangeGrid`, `Legend`, `ActionSelector`, `PokerTable`, `HoleCards`, `SpotMeta`, `TrainingSetupForm`.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md). The `engine/`, `ranges/`, `quiz/` and `stats/` layers are pure TypeScript, tested without a DOM.
