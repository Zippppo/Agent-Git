# Agent-Git

Agent-Git is a local-first desktop app for exploratory work. It uses Git-style
checkpoints, `HEAD`, and forks to help you recover working context quickly
instead of rebuilding it from scattered notes.

The project is currently an early MVP. It is usable for local daily planning
and product feedback, but the renderer is still being split out of its migrated
prototype structure.

## Contents

- [Why Agent-Git](#why-agent-git)
- [Features](#features)
- [Privacy and Data](#privacy-and-data)
- [Quick Start](#quick-start)
- [Development Commands](#development-commands)
- [Packaging](#packaging)
- [Project Layout](#project-layout)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

## Why Agent-Git

Complex work often branches, stalls, and loops back. A normal todo list records
the next action, but it rarely captures why the current path exists.

Agent-Git gives each day a task map:

- Task roots represent parallel work streams.
- Checkpoints record decisions, findings, completed work, and planned steps.
- `HEAD` marks the current continuation point for each task.
- Forks preserve alternate paths without mixing them into the main line.

The goal is simple: when you open the app, you should be able to understand
where your work stopped and where to continue.

## Features

- Daily snapshot page with unfinished tasks inherited into a new day.
- Horizontal task root map with vertical checkpoint timelines.
- Checkpoint states: Planned, Done, HEAD, Finding, Abandoned.
- Task states: Active, Blocked, Paused, Done.
- Keyboard-first growth:
  - `Enter`: add the next checkpoint for the selected task or checkpoint.
  - `Ctrl+Enter`: fork from the selected checkpoint.
  - `Space`: edit the selected task or checkpoint inline.
- Mouse interactions for selection, status changes, drag reorder, side panel
  toggles, and inspector resize.
- Local persistence with `localStorage`.
- Image attachments in the Electron app.
- JSON export for backup and debugging.

## Privacy and Data

Agent-Git is local-first. The current app does not include accounts, cloud sync,
telemetry, analytics, or a remote backend.

Current storage locations:

```text
localStorage:
  agent-git:mvp:v1
  agent-git:mvp:prefs:v1

Electron userData:
  attachments/
```

The JSON export action downloads a local backup of the app state. Treat exported
JSON files as personal data if your tasks contain sensitive notes.

## Quick Start

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

This opens an Agent-Git desktop window. Vite is used behind the scenes for
renderer hot reload during development.

## Development Commands

Run the browser renderer only:

```bash
npm run web:dev
```

Run tests:

```bash
npm test
```

Run TypeScript checks:

```bash
npm run typecheck
```

Build the renderer:

```bash
npm run build
```

Preview the production renderer build:

```bash
npm run preview
```

## Packaging

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

For local Windows builds this project disables executable signing by default, so
the app can be built without code-signing certificates or elevated symlink
privileges. Production releases should add signing in CI.

## Project Layout

```text
.
|- index.html                 # Vite app shell
|- electron/
|  |- main.mjs                # Electron desktop main process
|  |- preload.cjs             # Isolated renderer bridge
|  `- zoom-shortcuts.mjs      # Shared zoom shortcut logic
|- src/
|  |- main.ts                 # App behavior and rendering
|  `- styles.css              # App styles migrated from the MVP
|- test/
|  `- zoom-shortcuts.test.mjs # Node test suite
|- docs/
|  `- mvp-single-file.html    # Preserved original single-file prototype
|- PRODUCT.md                 # Product definition and roadmap
|- CONTRIBUTING.md            # Contribution guide
|- SECURITY.md                # Security policy
|- CHANGELOG.md               # Release notes
`- package.json
```

## Known Limitations

- The renderer is still a large migrated file and needs domain, storage, and
  view modules.
- Cross-day lineage is not fully modeled yet. Inherited tasks are currently
  copied into the new day.
- Forks are currently represented as visual indentation, not a complete branch
  tree.
- Search, import, archive, and undo history are still limited.
- JSON export is useful for development backup, but it is not a polished user
  backup format yet.
- No prebuilt release binaries are published yet. Build from source for now.

See [PRODUCT.md](PRODUCT.md) for the full product direction.

## Contributing

Contributions are welcome while the project is still small and evolving. Start
with [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

For security issues, see [SECURITY.md](SECURITY.md).

## License

Agent-Git is released under the [MIT License](LICENSE).
