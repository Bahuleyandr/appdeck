# Releasing AppDeck

Auto-update is wired to **GitHub Releases** via `electron-updater` (publish config in
`electron-builder.yml`: `Bahuleyandr/appdeck`). The packaged app checks for updates on launch
(`UpdaterService.init()` → `checkForUpdatesAndNotify`) and downloads in the background; the user
clicks **Settings → Diagnostics → Restart & install** once a build is downloaded.

## One-time setup

1. Create the GitHub repo `Bahuleyandr/appdeck` (public or private) and push the code.
2. Create a GitHub **Personal Access Token** with `repo` scope (Contents: read/write). This is the
   publish credential — keep it out of git.

## Cut a release

```sh
# 1. Bump the version (electron-updater compares package.json version)
npm version patch        # or minor / major

# 2. Publish: builds, packs nsis + portable, uploads to a GitHub Release + latest.yml
GH_TOKEN=ghp_xxx npm run release
```

`npm run release` runs `electron-builder --publish always`. With the current `releaseType: release`
configuration, it publishes a GitHub Release immediately with the installer, blockmap, and
`latest.yml` (the manifest `electron-updater` reads). Installed clients pick it up on their next
launch.

## Notes

- **Code signing:** unsigned builds still auto-update, but Windows SmartScreen warns on first run.
  Add a cert via `electron-builder.yml` → `win.certificateFile`/`certificatePassword` (or Azure
  Trusted Signing) when ready.
- **Dev builds don't auto-update:** `UpdaterService` is a no-op unless `app.isPackaged`.
- **Switching to self-host later:** replace the `publish` block with
  `provider: generic` + `url: https://.../appdeck/`; no app-code change needed.
- **Private repo:** clients need a token to download; prefer a public repo or a generic/S3 host for
  a private project.
