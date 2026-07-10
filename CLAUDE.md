# Genshin Optimizer - Local Desktop Fork

## Repo layout

Nx monorepo (yarn 3.4.1) with ~130 libraries across multiple games:

```
apps/frontend/             → Main GI web app (Vite + React + MUI)
apps/frontend-playwright/  → Playwright e2e tests (fork-only, not an Nx project)
libs/gi/                   → Genshin Impact libs (52 packages)
libs/sr/                   → Star Rail libs
libs/zzz/                  → Zenless Zone Zero libs
libs/common/               → Shared utilities
libs/game-opt/             → Cross-game optimization engine
src-tauri/                 → Tauri 2 desktop shell (Rust)
desktop/                   → Built desktop exe
tools/scripts/             → Build helper scripts
```

Key GI libraries:
- `gi/db` — Database, data models, CustomMultiTarget + expression system
- `gi/wr` — Optimizer worker, expression evaluator (`api.ts`)
- `gi/page-team` — Team/character UI, multi-target editor, expression editor
- `gi/formula` + `gi/sheets` — Damage formulas and character sheets
- `gi/consts`, `gi/keymap`, `gi/stats` — Game constants and stat mappings

## Git structure

- `origin` → `iilegendarypokemonii/genshin-optimizer` (this fork)
- `upstream` → `frzyc/genshin-optimizer` (main project)
- `aurceive` → `aurceive/genshin-optimizer` (expression feature source)

### Branch strategy

- **`master`** — clean mirror of `upstream/master`. Fast-forward only. Never commit fork changes here.
- **`desktop`** — main working branch. All fork features (Tauri shell, expression targets, desktop UX) live here on top of master.
- **`feature/*`** — feature branches for new work, branched from `desktop`, merged back into `desktop`.

### Syncing with upstream

```bash
git fetch upstream
git checkout master
git merge --ff-only upstream/master
git checkout desktop
git rebase master
```

If rebase conflicts occur, resolve them on `desktop` — never modify `master`.

### Game-patch data updates

Genshin ships a version every 42 days with a banner-phase swap at day 21; a new region lands yearly (7.0 Snezhnaya: 2026-08-12). Upstream adds new character/weapon data in PRs named like "Add Luna VII first half content" / "Add <char> + Sig". Measured lag from patch day to data on `upstream/master` (6.0–6.6): usually **0–3 days**, one 9-day outlier in December (Luna III). Phase-2 characters sometimes land a day *before* their banner.

Routine after each patch or phase date (+2–3 days):

```bash
git fetch upstream
git log master..upstream/master --oneline -- libs/gi/stats   # new data commits pending?
```

If new data is there, run the upstream sync above, then `yarn desktop:update` to rebuild the exe. If nothing landed after ~4 days, check open PRs on frzyc/genshin-optimizer — the data is usually in review there.

## Features exclusive to this fork

1. **Tauri desktop app** — `src-tauri/`, standalone exe wrapping the web frontend
2. **Expression-based multi-opt targets** — evaluate expression trees (constants, operations, enclosing/priority/min/max) instead of just weighted target sums. Ported from aurceive's fork. Key files:
   - `libs/gi/db/src/Database/DataManagers/CustomMultiTarget.ts` — ExpressionUnit types, OperationSpecs, validation
   - `libs/gi/wr/src/api.ts` — expression tree evaluator
   - `libs/gi/page-team/src/CharacterDisplay/CustomMultiTarget/` — expression UI (AddItemsPanel, ExpressionDisplay, ItemConfigPanel, TargetExpressionEditor)
3. **Desktop UX polish** — loading spinner, no white flash, high-res icons

Branch `feature/expression-targets` has the expression work history.

## Building

### Dev mode (hot reload)
```bash
yarn desktop:dev          # or: yarn tauri dev
```
Starts Vite dev server on localhost:4200 + Tauri webview window.

### Update the installed app (one command, ~4 min warm)
```bash
yarn desktop:update       # kill running app → build → copy exe → relaunch
```
This is the standard way to ship changes into `desktop/Genshin Optimizer Local.exe`
(the exe people actually launch). The exe never updates itself — if you commit
without running this, the app keeps showing old code.

### Release build (~3 min)
```bash
yarn tauri build          # needs cargo in PATH; build only, no copy
yarn desktop:build        # build + copy exe/resources to desktop/ (no kill/relaunch)
```
Outputs exe to `src-tauri/target/release/genshin-optimizer-desktop.exe`.

Build is fast because:
- `bundle.active: false` — skips MSI/NSIS installer packaging
- Release profile: `opt-level = 1, lto = false, codegen-units = 16` — fine for a webview wrapper
- Updater plugin removed — no signing keys needed

### Frontend only (no Tauri)
```bash
yarn nx run frontend:build    # production build to dist/apps/frontend/
yarn frontend                 # dev server
```

### Testing
```bash
yarn test                 # run all unit tests (Nx)
yarn test:e2e             # run Playwright e2e smoke tests (starts Vite dev server if needed)
yarn test:e2e:ui          # Playwright interactive UI mode
yarn mini-ci              # format + typecheck + lint + test
```

Playwright tests live in `apps/frontend-playwright/` and run against `http://localhost:4200` (HashRouter, routes use `/#/` prefix). They are standalone — not an Nx project — to avoid merge conflicts with upstream.

### Other commands
```bash
yarn reload-dm            # update game data submodules
```

## Important notes

- **Node 24 required for `yarn install`** (upstream pins it via `.nvmrc` + preinstall check).
  System node is 22; use fnm: `"$LOCALAPPDATA/Microsoft/WinGet/Links/fnm.exe" exec --using=24 node .yarn/releases/yarn-3.4.1.cjs install`.
  Building/running/tests work fine on either version — only install is gated.
- Close the desktop exe before rebuilding (Windows locks the file)
- Vite caches pre-bundled deps in `node_modules/.vite/` — delete if exports change and HMR doesn't pick them up
- Cargo/Rust must be in PATH for Tauri builds: `export PATH="$HOME/.cargo/bin:$PATH"`
