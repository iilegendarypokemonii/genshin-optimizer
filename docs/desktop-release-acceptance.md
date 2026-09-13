# Desktop distribution acceptance criteria

Review base: `af0dee5aae82ea8d4f4c178c932195267e96e983`.

The requested result is one Windows installer for nontechnical friends, a visible
in-app update button for this fork's GitHub releases, and a clear repository
introduction above the unchanged original Gacha Optimizer README. The changes
must receive a final adversarial review by Claude Fable.

- Build an x64 NSIS installer with WebView2 setup, a shortcut, and no development-tool requirements.
- Keep the existing application identifier and separate per-Windows-user data directory.
- Check this fork's releases only; show current, available, offline/error, download progress, and install states.
- Require an explicit install click, reject invalid signatures, prevent overlapping operations, and allow retries after failure.
- Flush pending optimizer saves before Windows closes the app for installation; do not install if saving fails.
- Package actual Tauri v2 installer/signature files and validate release tags against the desktop version.
- Keep signing secrets out of source, generated JavaScript, and published artifacts.
- Automate a draft GitHub Release from a desktop version tag; publishing the completed draft makes it available to the updater.
- Verify installer launch and an actual signed upgrade, retaining synthetic optimizer, wish-history, and screenshot data.
- Preserve the original README content below a personal-modification introduction, feature list, installation steps, and update instructions.
- Run focused updater/storage/release tests, frontend type checking/build, Rust checks, and Playwright visual QA.
- Have Fable inspect the complete diff for standards and spec/correctness, then resolve actionable findings before delivery.
