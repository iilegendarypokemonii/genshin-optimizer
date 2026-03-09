# Desktop App

This repository can now run as a Tauri desktop app using the existing `frontend` app as its UI.

## Commands

Run the desktop app in development mode:

```powershell
corepack yarn desktop:dev
```

Build a desktop bundle:

```powershell
corepack yarn desktop:build
```

## How it works

- Tauri shell lives in `src-tauri`
- Dev mode starts the existing Vite frontend on `http://127.0.0.1:4200`
- Production bundles use `dist/apps/frontend`

## Windows prerequisite

Tauri on Windows needs the MSVC C++ toolchain. Install Visual Studio Build Tools with:

- MSVC v143 build tools
- Windows 10/11 SDK

Without that, Rust compilation fails because `link.exe` is missing.
