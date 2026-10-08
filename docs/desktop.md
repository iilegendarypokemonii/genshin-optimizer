# Desktop maintainer guide

To install the app, follow the [installation guide](../README.md#install-on-windows).
This page covers developing, updating, and releasing the Tauri desktop build.

## Local development and builds

Use Node 24 (`.nvmrc`), the checked-in Yarn release, stable Rust, and Visual
Studio Build Tools with MSVC v143 and the Windows 10/11 SDK.

```powershell
fnm use 24
node .yarn/releases/yarn-3.4.1.cjs install --immutable
node .yarn/releases/yarn-3.4.1.cjs desktop:dev
```

`desktop:build` builds the frontend, Rust executable, and NSIS installer. It also
copies the executable to `desktop/Genshin Optimizer Local.exe`. `desktop:update`
stops a running local copy, builds without installer packaging or signing, copies
the executable, and launches it. Installed copies update through the in-app
updater instead.

The UI lives in `apps/frontend`; native code and packaging live in `src-tauri`.
The desktop version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` is
independent of the upstream optimizer version in `package.json`.

## Branches and upstream changes

`master` is upstream [frzyc/genshin-optimizer](https://github.com/frzyc/genshin-optimizer)
plus the desktop changes. Keep edits to upstream files as small as possible and
put new code in new files, so upstream merges stay easy. Merge upstream rather
than rebasing, because release tags point at published commits:

```powershell
git remote add upstream https://github.com/frzyc/genshin-optimizer.git
git fetch upstream
git merge upstream/master
```

`yarn verify patch` reports upstream commits that are not merged yet, open
upstream pull requests that add game content, and the state of the bundled
capture data.

## Game patch updates

Genshin releases a version every six weeks, with a banner change halfway through.
Upstream usually adds new characters and weapons within a few days. After each
patch, merge upstream and publish a desktop release.

Account capture needs its own update, because its game data is bundled rather
than downloaded. The core lives in the
[Irminsul fork](https://github.com/iilegendarypokemonii/irminsul) (branch
`multi-account`), pinned by revision in `src-tauri/Cargo.toml`. That repository's
`crates/irminsul-core/README.md` has the details.

1. **Decoder:** when [auto-artifactarium](https://github.com/konkers/auto-artifactarium)
   publishes an update for the new version, port it into
   `crates/irminsul-core/vendor/auto-artifactarium` and recheck the login UID
   lookup. Missing this shows "no unambiguous account UID".
2. **Game data:** run `cargo run --example refresh_game_data` in
   `crates/irminsul-core`. It lists the added weapons and characters. Read its
   warnings: game files rename fields between versions. Missing this shows
   "Unknown weapon ID; update Irminsul".
3. Push the core, then update the `irminsul-core` revision here.

The `capture_data_covers_optimizer_weapons_and_characters` Rust test fails when
the optimizer knows a weapon or character that the bundled capture data lacks.
If it fails after an upstream merge, repeat step 2.

## Update signing

The app embeds a public verification key. Keep the corresponding private key
outside this repository and back it up securely: losing it prevents existing
installations from trusting future updates signed with a different key.

Set these GitHub Actions repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: the contents of the Tauri private key file.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: its password, if one was set (otherwise empty).

For a local signed build, set those same environment variables for the build
process. `TAURI_SIGNING_PRIVATE_KEY` may also point to the local key file.
Never commit the key or print it into build logs. The Vite configuration only
exposes explicitly listed public configuration values to the frontend.

Tauri updater signatures are required and separate from Windows Authenticode
publisher certificates. The current installer is not Authenticode signed.

## Publish a desktop release

1. Merge and test the changes on `master`.
2. Bump the desktop version in both Tauri files, and refresh `src-tauri/Cargo.lock`
   with Cargo. Use a stable `x.y.z` version greater than the last release.
3. Run `yarn verify release --stage post` locally on that commit. CI skips its
   desktop-app check (see [verification](verification.md)).
4. Commit and push the changes. Tag that exact commit as `desktop-vX.Y.Z` and push
   the tag. For example:

   ```powershell
   git tag desktop-v0.3.0
   git push origin master desktop-v0.3.0
   ```

5. The **Windows desktop release** workflow tests and builds the signed Windows
   installer and creates a **draft** GitHub Release. Check the run and its assets:
   `Genshin-Optimizer-Local-Setup.exe`, its `.sig`, and `latest.json`.
6. Edit the draft's release notes and test the installer. Click **Publish release**
   and mark it as the latest release. This is the step that makes it downloadable
   and available through **Check for updates**. Keep desktop releases as the latest
   releases in this fork; publishing an unrelated release as latest would hide the
   updater manifest.

The workflow refuses to replace assets on an already published version. Release
a higher desktop version for corrections. Avoid moving or reusing release tags.

For a manual local package after a signed build:

```powershell
node tools/scripts/generate-update-json.mjs desktop-v0.2.0
```

Files appear in `desktop/release/`. The helper uses the actual Tauri v2 `.exe` and
`.exe.sig` outputs; the old `.nsis.zip` updater format is no longer used.

## Data preservation and verification

Keep the application identifier
`com.iilegendarypokemonii.genshinoptimizerlocal` unchanged. App data is stored
under that identifier in the current Windows user's LocalAppData, separately
from installed binaries. NSIS upgrades preserve that directory.

Before installing an update, the UI drains active wish/screenshot writes and
flushes pending optimizer changes. Failed downloads, signature verification,
or saves leave the app running with a retry option.

Test installer upgrades with synthetic data in an isolated profile, never with
real account data. [Verification](verification.md) describes the commands.
