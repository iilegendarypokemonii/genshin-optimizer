# Reproducible desktop verification

`yarn verify` launches the real desktop executable, drives named scenarios and
records machine-readable results. Add scenarios and evidence collectors here as
product work requires them; keep checks reproducible for the next contributor.

```powershell
yarn verify app --build smoke good-upload irminsul-import
yarn verify app smoke --keep-profile
yarn verify release
yarn verify release --stage tag --tag desktop-v0.4.7
yarn verify installed --runtime
yarn verify patch
yarn verify patch --offline
```

`app` defaults to the executable in `src-tauri/target/release/`; `--exe` selects
another build. `--build` first builds without installer packaging or signing.
`--profile` selects an isolated verification profile, `--keep-profile` preserves
its data for inspection, and `--no-trace` disables trace collection. Normal runs
remove their test profile and owned processes. Existing incompatible binaries
are rejected before launch.

Each run starts with an empty profile. Reusing a named profile clears its previous
test data. If a console was forcibly closed, use `app --profile NAME --recover`
to reclaim its stale lock. Recovery refuses a live harness PID and only stops
an app whose saved process identity and explicit profile argument both match.

The app reads `GO_VERIFY_PROFILE` at startup and uses a separate application
identifier and WebView2 data directory. Native fixture injection requires that
profile and the main window. The harness verifies native profile information,
checks that the real profile's storage is unchanged, and avoids tool windows
and updater restarts. Verification profiles cannot read the real game's wish
cache, so automatic wish discovery cannot put account credentials in traces.
Live packet capture is also refused. Fixture support is compiled into the binary,
but injection requires the explicitly isolated verification profile.
Fixtures use made-up accounts; they do not capture network
traffic or validate the game's current wire protocol.

## Scenarios and evidence

- `smoke`: main pages, game-data page, desktop update control and minimum-width
  layout.
- `good-upload`: paste GOOD data through the import UI, verify Amber on disk,
  restart the app and verify persistence.
- `irminsul-import`: inject synthetic decoded data through the real Rust core,
  check exported GOOD keys, preview and import through the game-data UI, then
  inspect the imported characters and weapon.
- `irminsul-error`: reject an unknown weapon through the core, show the error in
  the UI, then recover with valid data (expected exit 0).
- `irminsul-mismatch`: deliberately change an expected count to exercise failure
  reports/screenshots (expected exit 1).
- `interrupt-restart`: interrupt a restart and exercise cleanup (expected exit 2).

Each run creates a unique `.verify/<run>/report.json`; `.verify/latest.json`
points at the newest result. Checks include status, elapsed time, readable error
details and evidence paths. A running report is written before launching the app,
so a forcibly interrupted run keeps its profile name and never looks like a pass.
App scenarios save screenshots, browser console and page errors, and Playwright
traces. Traces span each app launch, including resource loading and all scenarios
until the next restart, so the viewer can replay snapshots with their assets.
Open a recorded trace with:

```powershell
yarn playwright show-trace <path-to-trace.zip>
```

Exit codes: 0 passes, 1 identifies a product/check failure, 2 identifies a harness
or environment failure, 3 flags patch updates needing attention, and 64 rejects
invalid command usage. An unavailable upstream source is not proof that local
data is current. Offline patch results only describe locally available refs.

`installed` expects the normal installed process to be running; `--runtime` also
works when it is closed by launching an isolated instance. Leave the normal app
idle during runtime verification: concurrent real-account edits make the storage
guard inconclusive (exit 2). A force-kill between creating a profile lock and
writing its owner record is refused by recovery; inspect that lock before manual
removal rather than guessing whether another harness still owns it.

Installed reports also record a SHA-256 digest of real account storage without
copying its contents. Pass `installed --baseline <earlier-report.json>` after a
local update to check that it is unchanged. This is a strict byte comparison:
normal startup can update wish-cache status and probe timestamps. A mismatch
reports changed storage; it does not identify the changed records or prove data
loss. Retain that failed result and do not claim upgrade preservation from an
unmatched baseline. The runtime isolation guard separately compares storage
before and after the verification session.

Desktop saves debounce for 200 ms. The restart scenario waits for committed data
before terminating the app; edits still waiting to save at a forced kill are
outside that persistence guarantee.

## Extending verification

Place named app scenarios in `tools/verify/scenarios/` and register them in its
index. Use the shared scenario context's step, invoke, navigation, restart and
fixture helpers so checks retain the same timing, screenshot and failure
evidence. Use stable accessible UI locators. Keep assertions about visible
behavior and persisted output; a successful invoke alone does not prove import.

Keep synthetic input and expected output together under `tools/verify/fixtures/`.
The Irminsul fixture is also consumed by Rust tests so native changes cannot
silently invalidate app checks. Unknown-item and malformed-input regressions
should exercise the real error path.

Shared evidence and process helpers are under `tools/verify/lib/`. New commands
must use them, return the documented exit codes, give subprocesses timeouts and
clean up only resources owned by their run. Never trust a PID file alone to
authorize termination, or a path suffix alone to authorize deletion.

`release --stage tag,pre,post` owns the release checklist. The GitHub workflow
calls those stages and uploads `.verify/` even on failure. Keep the workflow
drift guard and Node tests passing when extending it.

CI runs the post stage with `--skip desktop-app`: GitHub's Windows runners run
elevated, and elevated WebView2 never opens the CDP port the app harness needs
(WebView2Feedback #5640). Run `yarn verify release --stage post` locally on the
commit you tag. `--skip` takes comma-separated check ids, rejects unknown ones,
and records each as `skipped` in the report.

Local installation uses `yarn desktop:update`, which builds without installer
bundling or release-signing keys. Release CI still uses `desktop:build` to create
signed installer artifacts before running the post-build gates.

Run harness checks with `node --test tools/verify/*.test.mjs`, then run the
affected real-app scenarios. Include the command and report path when reporting
verification. Preserve failures as useful evidence; do not report an unrun or
unavailable check as passing.
