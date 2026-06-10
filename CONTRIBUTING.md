# Contributing to Agent-Git

Thanks for considering a contribution. Agent-Git is currently an early MVP, so
small, focused changes are easier to review than broad rewrites.

## Development Setup

Requirements:

- Node.js 20 or newer.
- npm.

Install dependencies:

```bash
npm install
```

Run the desktop app:

```bash
npm run dev
```

Run the browser renderer:

```bash
npm run web:dev
```

## Checks Before a Pull Request

Run these commands before opening a pull request:

```bash
npm test
npm run typecheck
npm run build
```

If a check fails, include the failure details in the pull request description.

## Pull Request Guidelines

- Keep changes scoped to one feature, bug fix, or cleanup.
- Prefer the existing architecture and style over introducing new frameworks.
- Add or update tests when behavior changes.
- Update README, PRODUCT.md, or CHANGELOG.md when user-visible behavior changes.
- Do not commit generated directories such as `node_modules/`, `dist/`, or
  `release/`.
- Do not commit personal data, exported app backups, screenshots with private
  information, credentials, logs, or local environment files.

## Product Direction

Agent-Git is not trying to become a full project management system. Changes
should support the core product goal: helping a person recover complex work
context quickly.

Good first areas:

- Data model cleanup.
- Safer backup and import flows.
- Tests for daily snapshot inheritance and `HEAD` uniqueness.
- Renderer module extraction.
- Accessibility and keyboard interaction fixes.

## Reporting Bugs

When reporting a bug, include:

- What you expected to happen.
- What actually happened.
- Steps to reproduce.
- Operating system.
- Node.js and npm versions.
- Whether you ran the Electron app or the browser renderer.

Avoid attaching private app exports or screenshots that contain sensitive task
content.
