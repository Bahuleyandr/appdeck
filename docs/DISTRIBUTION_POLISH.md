# AppDeck Distribution Polish

AppDeck should feel free, local-first, and boringly trustworthy from download to update.

## Release Readiness

- Run `npm run release:check` from the repo root.
- Confirm `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` are green.
- Confirm `server npm run typecheck` is green.
- Confirm `electron-builder.yml`, `RELEASING.md`, and `server/wrangler.toml` are present.
- Confirm the Trust panel reports a clean vault denylist.
- Confirm the Automations, Focus Modes, Firewall, Snapshots, Analytics, Portable, Peer Sync, and Work Kits panels open from command search.
- Confirm Settings has the intended AI provider defaults and no committed secrets.

## Packaging Targets

- Windows portable build: `npm run dist:portable`.
- Windows installer/release build: `npm run dist`.
- Self-host sync server: deploy the `server` Worker with Wrangler after configuring the target Cloudflare account.

## Store / Package Managers

- Winget: publish after a signed installer URL is stable.
- Homebrew/Linux packages: add once macOS/Linux packaging has a tested CI runner.
- GitHub Releases: attach portable and installer artifacts with checksums.

## Privacy Copy

Use the same wording as the Trust panel:

- Syncs: workspaces, profiles, custom recipes, service metadata, workspace membership, layouts.
- Never syncs: cookies, tokens, AI keys, proxy passwords, downloads, permission decisions, last visited URLs.
