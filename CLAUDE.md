# Genshin Optimizer - Local Desktop Fork

## Goal

Turn Genshin Optimizer from a web app into a personal desktop application. This fork serves as a local hub for Genshin Impact (and future HoYoverse game) tooling — consolidating outside tools, data sources, and custom features beyond what the upstream web app offers.

Stay compatible with upstream (`frzyc/genshin-optimizer`). All fork changes should be additive — new files, new exports, config changes — so that `git merge upstream/master` remains clean. Currently up to date with upstream at 10.33.0.

## Repo layout

Nx monorepo (yarn 3.4.1) with ~130 libraries across multiple games:

```
apps/frontend/       → Main GI web app (Vite + React + MUI)
libs/gi/             → Genshin Impact libs (52 packages)
libs/sr/             → Star Rail libs
libs/zzz/            → Zenless Zone Zero libs
libs/common/         → Shared utilities
libs/game-opt/       → Cross-game optimization engine
src-tauri/           → Tauri 2 desktop shell (Rust)
desktop/             → Built desktop exe
tools/scripts/       → Build helper scripts
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

To sync with upstream: `git fetch upstream && git merge upstream/master`

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

### Release build (~3 min)
```bash
yarn tauri build          # needs cargo in PATH
```
Outputs exe to `src-tauri/target/release/genshin-optimizer-desktop.exe`.
Copy to `desktop/Genshin Optimizer Local.exe` for the standard location.

Build is fast because:
- `bundle.active: false` — skips MSI/NSIS installer packaging
- Release profile: `opt-level = 1, lto = false, codegen-units = 16` — fine for a webview wrapper
- Updater plugin removed — no signing keys needed

### Frontend only (no Tauri)
```bash
yarn nx run frontend:build    # production build to dist/apps/frontend/
yarn frontend                 # dev server
```

### Other commands
```bash
yarn test                 # run all tests
yarn mini-ci              # format + typecheck + lint + test
yarn reload-dm            # update game data submodules
```

## Important notes

- Close the desktop exe before rebuilding (Windows locks the file)
- Vite caches pre-bundled deps in `node_modules/.vite/` — delete if exports change and HMR doesn't pick them up
- Cargo/Rust must be in PATH for Tauri builds: `export PATH="$HOME/.cargo/bin:$PATH"`
