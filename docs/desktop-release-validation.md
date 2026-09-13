# Desktop 0.2.0 validation

Date: 13 September 2026. Release source: `37a3093156d157db334a76227bedaf8555ba15a0`.

## Application checks

- 23 frontend tests passed across the updater, persistent storage, write barrier,
  and Wish Tracker storage specs. This includes deferred updates, offline retry,
  duplicate-click prevention, download/verification failures, save failures, and
  waiting for active writes before installation.
- Four release-packaging tests passed, including wrong tags, conflicting native
  versions, unsigned artifacts, and unchanged installer bytes at the manifest URL.
- Frontend type checking and the production Vite build passed.
- Eight native Rust tests passed; the manual OCR dump test was intentionally ignored.
- The built frontend passed Playwright checks for home, Tools, Settings, desktop
  updater isolation from the browser, and no horizontal overflow at 1120px.
- Built JavaScript contained neither private-environment canary, signing-key
  variable, nor authentication-token variable markers.
- The original README suffix was verified unchanged, apart from newline normalization.

## Real Windows installer upgrade

Two isolated Tauri installers used the same application source and production
frontend, with test versions 0.1.0 and 0.2.0. Test-only configuration changed the
product name, executable name, application identifier, and updater endpoint, so
the existing working optimizer and its real data were not involved. The QA native
build used the debug profile for browser inspection; production artifacts use the
release profile. Only the QA endpoint permitted loopback HTTP. Both installers
used the release signing key; signature verification remained enabled.

Playwright connected to the QA app's WebView2 instance. Results:

1. The 0.1.0 per-user installer completed and the app launched.
2. A synthetic account (name and UID), Amber, and a weapon were imported using the
   normal optimizer UI. Synthetic wish history and a screenshot were also stored.
3. A current-release response and an unavailable update server produced the
   expected user-facing states.
4. A bad signature was rejected. The 0.1.0 app stayed open and offered a retry.
5. A valid signed installer downloaded, installed, and automatically relaunched
   the app. The native version API then reported 0.2.0.
6. The account name, UID, character, and storage marker remained. Wish history
   and the screenshot matched their pre-update bytes exactly.
7. The upgraded app reported its installed version and the up-to-date state.

DOM geometry was measured before screenshots, and the native Settings, available
update, and completed update screens were visually inspected. Local evidence is
under `.codex-run/desktop-release/`, including `native-upgrade-result.json` and
the `native-*.png` screenshots. These contain only synthetic account data.

## Review and release automation

The [Fable adversarial review](desktop-release-review.md) records findings,
resolutions, and remaining nonblocking limitations.

The production release workflow is
[Windows desktop release](https://github.com/iilegendarypokemonii/genshin-optimizer/actions/runs/34728470908).
It independently checks types, all four frontend spec files, packaging, native
tests, and the built frontend before preparing the signed release assets.

That workflow completed successfully. All four frontend test files were confirmed
in its completed log. The resulting [0.2.0 release](https://github.com/iilegendarypokemonii/genshin-optimizer/releases/tag/desktop-v0.2.0)
is published, and both the anonymous public installer request and the updater's
`releases/latest/download/latest.json` endpoint succeeded.

The downloaded production installer was independently verified against the
embedded public key with `minisign-verify`; changing an installer byte caused
verification to fail. Its SHA-256 also matches GitHub's asset digest:

```text
51d0e26a27f67db24727061e2fbc0b95ba69f3f229383d3ca28fb22038d65954
```

Installer size: 192,146,264 bytes. The original working developer executable was
left running and unchanged. The isolated QA application was uninstalled and all
three test ports were closed.

This verification used an isolated installation on the maintainer's Windows PC;
it does not claim testing on every Windows version or a separate clean VM.
