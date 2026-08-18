# Changelog

## Unreleased

### Added

- **Tray quick view.** Left-clicking the tray icon opens a small popover listing services with
  unread messages and your most recent notifications, so you can triage without restoring the
  window. Clicking a row opens the app focused on that service. It reads only main-process data,
  so parked and dozing services stay asleep, and it is skipped entirely while the app is locked.

### Fixed

- **Clicking a notification for a service in another workspace now switches to that workspace**
  instead of quietly doing nothing useful. Previously the id was written into the *current*
  workspace's layout, which could not resolve it and fell back to displaying an arbitrary service.
  Affects OS-notification clicks, link routing and automations, not just the new quick view.

### Changed

- **Tray click behaviour.** Left-click now opens the quick view; **double-click** shows/hides the
  main window (previously single-click did). Right-click still opens the tray menu, which gained
  an explicit *Open AppDeck* item. On Linux the tray keeps a persistent context menu, because most
  Linux trays never emit click events.

## 0.2.0 — 2026-08-16

First release since the initial 0.1.0 scaffold. The app went from "feature-complete on paper" to
something with the tests, security boundaries, and honesty to hand to another person.

### Added

- **Two-tier sleep.** Idle services *doze* — detached and throttled, but alive — so notifications
  keep arriving and waking is instant with no reload. Muted services still deep-sleep to free
  their memory, and a dozing service escalates to deep sleep after 2 hours untouched.
- **EasyList + EasyPrivacy tracker blocking** from a bundled engine snapshot. Works entirely
  offline; the only network fetch is the explicit "Update blocklist" button.
- **Searchable notification archive** with full-text search, per-service grouping, a
  "seen before" divider, and a configurable retention window.
- **Scheduled AI briefings** — a daily summary of your notifications, delivered to the inbox,
  using your own API key or a local Ollama model.
- **Per-service memory accounting**, including an estimate of what sleeping is currently saving.
- **Real portable mode**: a marker file beside the executable (or `APPDECK_PORTABLE_ROOT`) moves
  the database, vault, logs, and every service login next to the app.
- **Focus modes that actually do something** — mute notifications, allow/block specific services,
  hide muted services from the rail, and tighten the sleep timer, either on a schedule or
  switched on manually.
- **Revocable sync sessions and per-IP rate limiting** on the self-hosted sync server.
- Release checksums (`SHA256SUMS-<OS>.txt`) and a signing/notarization pipeline that activates
  once certificates are supplied.

### Fixed

- The **privacy firewall was silently dead**: its request handler was overwritten by the tracker
  blocker, because Electron keeps only one `onBeforeRequest` listener per session. Both now share
  one handler, and an explicit "allow" rule beats the blocklist.
- Custom CSS/JS arriving over sync no longer executes until approved on the receiving device.
- The app lock is enforced in the main process, so no IPC call can re-show panes over it.
- Schedule-triggered automations fired every 60 seconds inside their window instead of once.
- "Never sleep" was being ignored by the memory sweep and by the tray-hide path.
- Sync no longer churns server revisions when nothing changed, coalesces concurrent runs, and
  surfaces real errors instead of a hardcoded "0 conflicts".
- Deep links that launch the app cold are no longer dropped.
- Migration backups now checkpoint the WAL first, so they cannot silently omit recent data.
- Windows High Contrast focus indicators restored after the Tailwind 4 migration.

### Changed

- React 19 and Tailwind 4; Electron 42.9.
- The catalog claim is now accurate: **88 curated apps**, no padded name variants.
- Control Center split from one 3.8k-line file into 29 panel modules; IPC registration split from
  1k lines into five domain modules, guarded by a test that every channel has a handler.
- Test suite: **196 unit tests, 27 server tests against real D1, 5 Electron e2e tests.**

### Known limitations

- **Builds are unsigned.** Windows SmartScreen and macOS Gatekeeper will warn on first run;
  verify downloads against the published checksums.
- The sync server is not deployed anywhere by default — it is yours to deploy (see
  `server/README.md`). Local file-based sync needs no server.

## 0.1.0 — 2026-06-21

Initial scaffold: isolated service panes, workspaces, tiling, notification inbox, E2EE file
sync, app lock, and the recipe catalog.
