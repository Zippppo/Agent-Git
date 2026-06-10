# Agent-Git

Agent-Git is a local-first desktop app for exploratory work. It uses Git-style checkpoints, `HEAD`, and forks to help you recover working context quickly instead of rebuilding it from scattered notes.

The current app is a productized MVP migrated from the original single-file prototype into an Electron desktop app that others can install, run, and package.

## Features

- Daily snapshot page with unfinished tasks inherited into a new day.
- Horizontal Task Root map with vertical checkpoint timelines.
- Checkpoint states: Planned, Done, HEAD, Finding, Abandoned.
- Task states: Active, Blocked, Paused, Done.
- Keyboard-first growth:
  - `Enter`: add next checkpoint for the selected task or checkpoint.
  - `Tab`: fork from the selected checkpoint.
  - `Space`: edit the selected task or checkpoint inline.
- Mouse interactions for selection, status changes, drag reorder, side panel toggles, and inspector resize.
- Local persistence with `localStorage`.
- JSON export for backup and debugging.

## Run The Desktop App

Requirements:

- Node.js 20 or newer.
- npm.

Install dependencies:

```bash
npm install
```

Start the desktop app in development mode:

```bash
npm run dev
```

This opens an Agent-Git desktop window. Vite is only used behind the scenes for renderer hot reload during development.

Build an unpacked desktop app:

```bash
npm run desktop:build
```

On Windows, the executable is created at:

```text
release/win-unpacked/Agent-Git.exe
```

Build distributable packages:

```bash
npm run desktop:dist
```

For local Windows builds this project disables executable signing by default, so the app can be built without code-signing certificates or elevated symlink privileges. Production releases should add signing in CI.

## Web Renderer Commands

The UI renderer can still be run in a browser for development and debugging:

```bash
npm run web:dev
```

Build only the renderer:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Layout

```text
.
├─ index.html                 # Vite app shell
├─ electron/
│  └─ main.mjs                # Electron desktop main process
├─ src/
│  ├─ main.ts                 # App behavior and rendering
│  └─ styles.css              # App styles migrated from the MVP
├─ docs/
│  └─ mvp-single-file.html    # Preserved original single-file prototype
├─ PRODUCT.md                 # Product definition and roadmap
└─ package.json
```

## Data Model

Agent-Git currently stores data in the browser under:

```text
agent-git:mvp:v1
agent-git:mvp:prefs:v1
```

This keeps the app local-first and dependency-free. Cloud sync, accounts, permissions, and team collaboration are intentionally outside the current MVP.

## Product Direction

The next engineering priorities are:

- Split the migrated renderer into typed domain, storage, and view modules.
- Add import, delete/archive, undo, and safer backup flows.
- Improve cross-day lineage instead of cloning inherited tasks blindly.
- Add focused tests around daily snapshot inheritance and `HEAD` uniqueness.

See [PRODUCT.md](PRODUCT.md) for the full product plan.
