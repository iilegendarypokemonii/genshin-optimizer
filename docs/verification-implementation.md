# Verification CLI implementation contract

Approved scope: `yarn verify app|release|installed|patch`, with durable JSON reports,
logs, screenshots, timings and Playwright traces. Future product work must extend
this CLI when it needs new verification instead of accumulating one-off scripts.

## Shared interfaces

- ESM entry point `tools/verify/cli.mjs`; repository root resolved from import URL.
- Command modules export `run({ root, options, args, evidence })`. They return an
  exit code (0 pass, 1 product failure, 2 environment/harness error, 3 patch attention).
  CLI rejects invalid commands/options with 64. Playwright loads only for app work.
- `createEvidence(root, command)` from `lib/evidence.mjs` returns an object with
  `dir`, `report`, `check(id, fn)`, `write(relativePath, content)`, and `finish(exitCode)`.
  `checkpoint()` persists a running report and latest pointer before app launch.
  `check` records elapsed time and the result `{message, data, evidence}` returned
  by `fn`; failures record error details and rethrow. Callers decide continuation.
  Evidence paths in checks are relative to the run directory. `write` creates
  parents and writes strings/Buffers or JSON for objects. `finish` writes schema-1
  report.json and latest.json. Report includes command/status/exitCode, git/env,
  durationMs, subject, metrics, checks and trace status. Run directories are unique.
- `runProcess(command, args, {cwd, env, timeoutMs, logPath})` from `lib/proc.mjs`
  returns `{code, stdout, stderr, durationMs, timedOut}`. Spawn errors reject;
  nonzero exits are returned. Timeouts kill the owned process tree. No shell
  interpolation; add Rust's bin folder to the child PATH when needed.
- `runApp({root, options, args, evidence})` from `lib/app.mjs` returns exit code.
  `commands/app.mjs` forwards to it. Scenario index exports named scenarios
  (`smoke`, `good-upload`, `irminsul-import`) whose functions accept a context.
  Runtime installed checks reuse `runApp` with a smoke run against the installed exe.
  Installed `--baseline REPORT` compares the real storage digest across a local update.
- Native `verify_info` returns `{protocol:1, profile, identifier, dataDir, version}`.
  A retained ASCII marker `GO_VERIFY_PROTOCOL_V1` in the executable allows the
  harness to refuse old binaries BEFORE launch. Injection command is
  `irminsul_inject_fixture({fixture: JSON.stringify(fixture.fixture)})`.
  Both native verification commands require a valid verify profile and main window.
- Irminsul fixture file is `fixtures/irminsul/patch-7-1.json` below tools/verify,
  wrapper `{fixture, expect}`; the core owns the fixture schema. Keep exact
  counts and GOOD keys beside the input. Basic GOOD input lives under fixtures/good.

## Required acceptance checks

1. Node tests exercise argument rejection/exit codes, evidence failure records,
   timeout cleanup, safe profile paths (traversal, symlinks, invalid names), stale
   PID/reuse protection, old-binary rejection and release/workflow drift guard.
2. Core Rust tests run the real export path: Cryo Traveler, excluded TPS avatar,
   Vodyanitsa, Winter's Heavy Heart, artifact/material, unknown-weapon rejection.
   GO Rust tests cover profile names, command gates and shared fixture expectations.
3. Real exe runs use child-only environment, separate data directory and browser
   storage; verify protocol/profile/dataDir before scenarios. Never touch tool
   windows or updater restart. Snapshot real profile storage for change detection.
   A shared profile cannot be owned by two runs; never kill an unverified PID.
4. `app --build smoke good-upload irminsul-import` passes, including actual upload,
   persistence on disk and restart, real core injection, preview and UI import.
   Every step saves evidence, and failures include screenshots and readable text.
5. Repeat app checks three times; cleanup leaves no owned processes/profiles.
   Exercise keep-profile, incompatible exe, mismatched expectations and unknown
   weapon error. Failure testing must be reproducible via CLI options/scenarios.
6. `release` owns all existing CI checks and CI calls tag/pre/post, including the
   real desktop scenarios after building. Wrong tag fails.
   `installed` checks digest, file version, process path and launch time; runtime
   option drives an isolated installed exe. `patch --offline` never accesses the
   network and clearly labels local-only findings; online checks cover all sources
   from the approved plan, with unavailable sources distinguished from up-to-date.
7. Independent cross-family review of isolation, cleanup, false passes and CI;
   fix important findings, install with desktop:update, rerun installed checks.

Future changes must keep these gates reproducible through the CLI.
