# AppDeck

A free, personal-first desktop workspace — run web services (WhatsApp, Telegram, Slack, Discord,
Messenger, Gmail, …) as isolated, sleepable, multi-account panes inside one Electron app.

**Highlights**

- Multi-account isolation (one Chromium partition per service instance) + nested tabs per service
- Workspaces, split/grid tiling, sleep/hibernate, quick switcher
- Unified **notification inbox** + cross-service ⌘K search
- **Local-first, E2EE config sync** via an encrypted vault file — cookies/sessions never sync
- Link routing, Chrome-extension support, tracker/ad blocking, Ferdium/Rambox import
- Optional **BYO-key AI** brief & triage over your notifications
- App lock (Argon2id), tray + global hotkey, light/dark themes, auto-update

## Develop

```sh
npm install
npm run dev
```

## Build & release

```sh
npm run dist        # local installers (no publish)
npm run release     # build + publish to GitHub Releases (needs GH_TOKEN)
```

Verify chain: `npm run typecheck && npm run lint && npm test && npm run build`. See
[RELEASING.md](RELEASING.md) for the update/release flow.

## Stack

Electron + React + TypeScript (electron-vite), better-sqlite3, libsodium, zod. MIT licensed.
