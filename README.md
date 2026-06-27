# AppDeck

A free, personal-first desktop workspace — run web services (WhatsApp, Telegram, Slack, Discord,
Messenger, Gmail, …) as isolated, sleepable, multi-account panes inside one Electron app.

**Highlights**

- Multi-account isolation (one Chromium partition per service instance) + nested tabs per service
- Workspaces, split/grid tiling, sleep/hibernate, quick switcher
- Unified **notification inbox** + cross-service ⌘K search
- **Local-first, E2EE config sync** via an encrypted vault file — cookies/sessions never sync
- Link routing, Chrome-extension support, tracker/ad blocking, migration wizard
- Optional provider-neutral **BYO AI** brief, triage, saved prompts, and task extraction
- App lock (Argon2id), tray + global hotkey, light/dark themes, auto-update

## Free Pro Controls

AppDeck exposes the workflow controls that many workspace browsers put behind paid tiers:
unlimited workspaces, profiles, custom apps, per-service sleep/mute/pin/user-agent/custom CSS/JS,
Chrome extension toggles, migration import, memory diagnostics, and local or zero-knowledge sync.
The Personal Pro layer also adds a 1,500+ local recipe registry, community recipe packs, nested
workspace groups, enable/disable controls, working-hours focus rules, per-service proxy/permission/
download/zoom/find/storage controls, editable link-routing rules, dashboards/widgets, provider-
agnostic BYO AI configuration, privacy shield settings, shortcuts, and self-host sync status.
The differentiation layer adds dashboard home, broader command-center search, migration previews,
recipe-pack validation, tracker/vault trust status, performance suggestions, saved AI workflows, and
an executable distribution-readiness check. The beyond-parity layer adds local automations, smart
focus modes, browser bookmark imports, Recipe Studio, a local extension-pack catalog, rules-based
privacy firewall, workspace snapshots, personal analytics, portable-mode status, peer-sync peers,
and one-click work kits.

## Develop

```sh
npm install
npm run dev
```

## Build & release

```sh
npm run dist        # local installers (no publish)
npm run release     # build + publish to GitHub Releases (needs GH_TOKEN)
npm run release:check
```

Verify chain: `npm run typecheck && npm run lint && npm test && npm run build`. See
[RELEASING.md](RELEASING.md) and [docs/DISTRIBUTION_POLISH.md](docs/DISTRIBUTION_POLISH.md) for the
update/release flow.

## Stack

Electron + React + TypeScript (electron-vite), better-sqlite3, libsodium, zod. MIT licensed.
