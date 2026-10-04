# Working on the desktop fork

Read [CLAUDE.md](CLAUDE.md) for repository structure and build conventions.

## Reproducible verification

Use `yarn verify` for product verification. Extend its commands, named scenarios,
fixtures and evidence collectors whenever a change needs a check the CLI cannot
yet perform. Keep the extension in the same change as the product work. Do not
leave a one-off verification script as the only way to reproduce a result.

- Run the relevant scenario against the real desktop executable. For import work,
  exercise the native capture/export path and the visible preview/import flow.
- Use synthetic fixtures and isolated verification profiles. Do not modify real
  accounts or click updater restart from a verification run.
- Save checks, logs, timings, screenshots and traces under `.verify/`; report the
  exact evidence directory and distinguish product failures from harness errors.
- Keep release checks in `tools/verify/commands/release.mjs`; CI calls the same
  CLI. Add a regression check when repairing the harness or a product failure.
- Before screenshots, measure relevant DOM geometry. Use the existing Playwright
  harness consistently, clean up owned processes, and verify persistence when a
  change affects storage.

See [docs/verification.md](docs/verification.md) for commands and extension points.
