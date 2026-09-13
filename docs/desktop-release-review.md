# Desktop release review

Reviewed on 13 September 2026 with Claude Fable (`claude-fable-5`, confirmed in
the reviewer CLI's model-usage output). Two independent read-only reviews covered
standards and specification/correctness, followed by a recheck of the fixes.
The baseline was `af0dee5aae82ea8d4f4c178c932195267e96e983`.

## Standards

Fable found no violations of the repository's documented conventions and no
release blockers. The useful clarity findings were addressed:

- Packaging logs now distinguish validation from packaging.
- Comments explain why the final storage flush bypasses the paused write barrier.
- The public environment allowlist documents maintenance when upstream adds settings.
- GitHub authentication/network failures stop the release step before draft creation.

The existing metadata-helper filename remains for compatibility. The workflow
deliberately lists the three public assets explicitly; the working output folder
also contains maintainer release notes, which should not be uploaded by a wildcard.

## Specification and correctness

The first pass found no P1 issues. Its actionable findings were resolved:

- CI now runs native tests and a Playwright smoke check of the built frontend.
- Download, save, and installation failures have distinct user messages.
- Active wish exports and screenshot deletion join the pre-install write barrier.
- Noninteractive builds use `--ci`, including update signing.

Fable traced the signature/installer/manifest chain, fork URLs, draft-publication
behavior, environment isolation, main-window updater capability, and README
preservation. Its final verdict was **no release blockers found**.

The reviewer accepted holding new background writes during the final installation
interval: interrupted operations never report successful completion, existing
writes drain before installation, and failed installations resume held writes.

Two nonblocking limitations remain: a permanently hung local disk write can keep
the saving dialog waiting; the pre-existing wish-file remove/rename sequence has a
power-loss gap covered by a backup. The updater's write barrier prevents its own
shutdown from interrupting that sequence.

## Complexity check

Decision points were counted from the TypeScript syntax tree, with nested
functions counted independently. The new update renderer was simplified without
changing its behavior.

| Function             | Before | After |
| -------------------- | -----: | ----: |
| `DesktopUpdates`     |     12 |     9 |
| `UpdateReleaseNotes` |      — |     4 |
| `checkForUpdates`    |      4 |     4 |
| `installUpdate`      |      4 |     4 |

The updater component's seven tests passed before and after the extraction.
