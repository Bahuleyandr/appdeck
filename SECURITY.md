# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately via
[GitHub Security Advisories](https://github.com/Bahuleyandr/appdeck/security/advisories/new).
Do not open public issues for security reports. You can expect an initial response within a week.

## Supported versions

Only the latest release receives fixes. AppDeck is pre-1.0; there are no backport branches.

## Signing and update posture (honest status)

- **Builds are currently unsigned.** Windows SmartScreen and macOS Gatekeeper will warn on first
  run. Authenticode/notarization is planned and tracked in the project backlog; until then,
  verify downloads against the `SHA256SUMS-<OS>.txt` files attached to each GitHub Release.
- Auto-updates come from GitHub Releases via electron-updater. Releases are created as drafts
  and published manually after review.

## Privacy invariants

These hold by design and are enforced by a key-name denylist at vault-encryption time
(`src/main/sync/vault.ts`):

- Sync (file vault or self-hosted server) carries **configuration only**: workspaces, profiles,
  custom recipes, service metadata, workspace membership, layouts.
- **Never synced:** cookies, sessions, tokens, AI keys, proxy passwords, downloads, permission
  decisions, last visited URLs.
- The sync server (`server/`) is zero-knowledge: it stores ciphertext, an Argon2id auth hash,
  and a passphrase-wrapped key it cannot open.
- Custom CSS/JS arriving via sync or import does not execute until approved on the receiving
  device.
- Each service runs in its own Chromium partition with `sandbox` and `contextIsolation` on and
  `nodeIntegration` off.
