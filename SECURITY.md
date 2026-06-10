# Security Policy

Agent-Git is a local-first desktop app. The current MVP stores task data in
browser storage and stores Electron image attachments under the app `userData`
directory.

## Supported Versions

Security fixes are handled on the `main` branch until the project starts
publishing versioned releases.

## Reporting a Vulnerability

Please do not open a public issue with exploit details or sensitive sample data.

Preferred reporting path:

1. Use GitHub's private vulnerability reporting or Security Advisories feature
   for this repository, if available.
2. If private reporting is not available, open a minimal public issue asking for
   a private contact path. Do not include secrets, private files, or exploit
   instructions in that issue.

Useful details to include privately:

- Affected commit or version.
- Operating system.
- Reproduction steps.
- Expected impact.
- Whether the issue affects local data, attachments, exports, or packaging.

## Scope

In scope:

- Local data exposure.
- Unsafe handling of image attachments.
- Path traversal or file access issues.
- Electron renderer and preload isolation issues.
- Packaging or update workflow issues once release distribution exists.

Out of scope:

- Vulnerabilities in unsupported Node.js or npm versions.
- Issues requiring physical access to an unlocked user account without any app
  boundary bypass.
- Dependency vulnerabilities that do not affect Agent-Git's reachable code
  paths.
