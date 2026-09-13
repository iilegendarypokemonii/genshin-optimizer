# Desktop maintainer guide

Friends should use the [Windows installation guide](../README.md#install-on-windows).
This page is for maintaining and releasing the Tauri desktop fork.

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
stops the locally running developer copy, builds, copies it, and launches it.
Friends use the in-app update button instead of these commands.

The UI lives in `apps/frontend`; native code and packaging live in `src-tauri`.
The desktop version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` is
independent of the upstream optimizer version in `package.json`.

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

1. Incorporate and test the changes on `desktop`.
2. Bump the desktop version in both Tauri files, and refresh `src-tauri/Cargo.lock`
   with Cargo. Use a stable `x.y.z` version greater than the last release.
3. Commit and push the changes. Tag that exact commit as `desktop-vX.Y.Z` and push
   the tag. For example:

   ```powershell
   git tag desktop-v0.3.0
   git push origin desktop desktop-v0.3.0
   ```

4. The **Windows desktop release** workflow tests and builds the signed Windows
   installer and creates a **draft** GitHub Release. Check the run and its assets:
   `Genshin-Optimizer-Local-Setup.exe`, its `.sig`, and `latest.json`.
5. Edit the draft's release notes and test the installer. Click **Publish release**
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

Use [the acceptance criteria](desktop-release-acceptance.md), focused updater
and storage tests, and a real signed installer upgrade with synthetic data.
Do not use a friend's real data for installation QA.

The GitHub default branch should be `desktop`, so visitors see the desktop
introduction. The original upstream README remains intact beneath it.
