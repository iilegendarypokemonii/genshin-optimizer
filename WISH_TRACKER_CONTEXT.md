# Context: Native Wish Tracker under Tools (scoping input)

You are scoping a new feature for this repo (the Genshin Optimizer desktop fork):
a **native wish/gacha tracker** available under the existing **Tools** page.
Everything below is verified background gathered in a previous session — trust it,
but re-verify file paths before large edits.

## What exists already (working data pipeline, outside this repo)

`A:/Agents/genshin-wishes/` contains a proven standalone pipeline:

- `fetch_wishes.py` — extracts the **last** `getGachaLog` URL (with authkey) from the
  game's own Chromium web cache:
  `A:/Games/Genshin Impact game/GenshinImpact_Data/webCaches/<newest version>/Cache/Cache_Data/data_2`
  (binary file; regex out `https://...getGachaLog...` ASCII runs; the URL ends at
  `game_biz=<token>`; the LAST occurrence belongs to the account that most recently
  opened the in-game wish-history screen). Then pages the API per banner
  (`gacha_type` 100/200/301/302/500, note 400 = second character banner, shares pity
  with 301), 20 items/page via `end_id` cursor, ~0.6s between calls, retry with
  backoff on retcode -110 ("visit too frequently"). Merges by wish `id` into
  `wishes_<uid>.json` (UID auto-detected from response items).
- `merge_paimon.py <uid> [xlsx]` — imports paimon.moe xlsx exports (synthetic
  19-digit time-based ids, dedup per banner by time+name multiset).
- `make_report.py` — static HTML dashboard per account (pity per banner, 5★ list
  with color-coded pity, avg pity, primo spend) — useful as UI reference.

Existing data files (the feature should be able to import or reuse these):
- `wishes_757970926.json` — user's 5th account, 2,051 wishes (API-fetched).
- `wishes_701817412.json` — user's 1st account, 4,513 wishes back to 2020-11-01
  (paimon.moe import).

### Wish record schema (HoYoverse API shape, kept verbatim)

```json
{
  "uid": "757970926", "gacha_type": "301", "item_id": "", "count": "1",
  "time": "2026-06-02 23:59:17", "name": "Nicole", "lang": "en-us",
  "item_type": "Character", "rank_type": "5",
  "id": "1764xxxxxxxxxxxxxxx",
  "source": "paimonmoe"   // only present on xlsx-imported rows
}
```
Files are `{"uid": ..., "exported": ..., "wishes": [...]}` sorted by `(time, id)`.

### Hard constraints learned the hard way

- **Authkey expires ~24h** after the user opens wish history in-game. UX must handle
  "expired" gracefully: tell the user to open the in-game wish history screen, then retry.
- **Server only keeps 365 days** of wishes → local persistence is the whole point;
  never overwrite, always merge by id.
- **Multi-account:** the user has at least 2 accounts (UIDs above; 757970926 = "5th",
  701817412 = "1st"). NEVER mix UIDs in one history — pity math breaks. Detect UID from
  the API response, not from assumptions. (A previous session nearly corrupted the data
  by merging two accounts; caught because 5★ sequences in the overlap didn't match.)
- The game cache contains **nothing else of value**: a full survey of data_0..data_3
  found getGachaLog as the only useful authkey-bearing API (rest: announcements,
  payment-page assets, geetest). The authkey only authorizes gacha-record queries.
  Characters/artifacts come from the GOOD import flow (irminsul scanner), not from here.
- **CORS:** the hoyoverse API sends no CORS headers. Browser/webview `fetch` from the
  app origin will fail. In the Tauri shell, do HTTP from Rust (a `#[tauri::command]`
  using reqwest, or `tauri-plugin-http`). Reading the binary cache file also needs the
  Rust side (or tauri-plugin-fs with scope for the game dir). Decide: probably one Rust
  command `get_wish_url()` (find newest webCaches dir, read data_2, return last URL)
  plus either Rust-side fetching or plugin-http from TS.
- Browser-only build (non-Tauri) can't read the cache or call the API → the tool must
  degrade: show stored history + manual import (paste URL / import JSON or paimon xlsx).

## Relevant repo facts (verified 2026-06-10, branch `desktop`)

- Fork of frzyc/genshin-optimizer with Tauri 2 shell at `src-tauri/`
  (plugins already wired: dialog, fs, process, opener — see `src-tauri/src/lib.rs`).
  Work happens on branch **`desktop`**; `master` is clean upstream mirror.
- Tools page is fork-custom at `apps/frontend/src/app/Tools/`:
  - `toolsManifest.ts` — card entries (`id`, `name`, `description`, `url`, `icon`,
    `category`, optional `dynamicLinks(databases)`), currently all **external** sites
    opened via `ToolViewer` (embedded webview window). There is already a `paimon-moe`
    entry ("Wish tracker") — the native tracker can sit beside it or replace it.
  - Route: `/tools/:toolId?` in `apps/frontend/src/app/App.tsx` → `./Tools` index.
  - A native tool needs a new pattern: manifest entry that routes to an internal React
    page instead of an external URL (scope this).
- The fork has **multiple GO database slots** (6) each with a `name` + `uid`
  (see `useDatabaseInfos()` in `Tools/index.tsx`, `dbMeta`). Natural fit: associate
  each wish history with a UID and optionally label it with the matching slot name.
- Storage decision to scope: GO's own database (localStorage-backed, participates in
  GO export/import) vs. JSON files in Tauri app-data dir (survives DB resets, easier
  merge semantics, matches existing files) vs. pointing at `A:/Agents/genshin-wishes/`
  (zero migration, but hardcoded path). Recommendation to evaluate: app-data JSON with
  one-time import from the existing files.
- UI stack: React + MUI v5, react-router, i18n via `libs/gi/i18n` (fork hardcodes EN
  in places). Reference pity dashboard design: `A:/Agents/genshin-wishes/make_report.py`.
- Build/run: `yarn desktop:dev` for dev; **`yarn desktop:update`** to ship (kills app,
  builds ~3.5 min, copies exe, relaunches). `yarn install` needs Node 24 via fnm.
- Gotchas: `window.confirm`/`alert` don't block in the Tauri webview — use
  `confirmAsync` from `libs/gi/ui/src/util/confirmAsync.ts`. Commit regenerated
  `src-tauri/Cargo.lock` + `gen/schemas/*`. After implementing, run real-runtime QA
  (`/qa-feature`), not just tsc/tests.

## Feature intent (user's words, lightly structured)

"Bake the wish tracking into Genshin Optimizer, under Tools." Wishes don't feed the
optimizer math — this is a tracker/dashboard: per-account pity status (5★/4★ counters
per banner, char event 301+400 share pity), 5★ history with pity each, averages,
primo spend, refresh button that pulls new wishes via the game cache authkey,
paimon.moe xlsx import, and persistence that outlives the 365-day server window.

## Open questions for scoping (decide with the user)

1. Storage: GO database entry vs app-data JSON files (see above).
2. Account model: free-form per-UID, or tied to the 6 DB slots?
3. Scope of v1: pity dashboard + refresh only? Or also full history table,
   banner-by-banner stats, xlsx import, charts?
4. Should the existing `wishes_*.json` files be imported once, or should the app
   read/write that folder directly?
5. Browser (non-Tauri) behavior: hide the tool, or read-only view of stored data?
