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

`npm run release` runs `electron-builder --publish always`. With the current `releaseType: draft`
configuration, it uploads the installer, blockmap, and `latest.yml` (the manifest
`electron-updater` reads) to a **draft** GitHub Release. Review the assets, then publish the
release manually — installed clients only pick up the update once the draft is published.

## Signing and notarization

Signing is fully wired but **dormant until you add the secrets below** — builds without them
stay unsigned and everything else (packaging, publishing, auto-update) works unchanged.

### What to obtain

- **macOS:**
  - An Apple Developer Program membership (USD 99/yr).
  - A **Developer ID Application** certificate, exported from Keychain Access as a
    password-protected `.p12`.
  - Your **Team ID** (10 characters, visible at developer.apple.com → Membership).
  - An **app-specific password** for your Apple ID (appleid.apple.com → Sign-In and Security →
    App-Specific Passwords) — used by `notarytool`, not your account password.
- **Windows**, one of:
  - A standard **OV or EV code-signing certificate** from a CA (Sectigo, DigiCert, ...). OV certs
    are issued as a `.pfx`; EV certs usually live on a hardware token or cloud HSM and cannot use
    the `CSC_LINK` flow — use `win.signtoolOptions.certificateSubjectName` instead (see the
    commented block in `electron-builder.yml`).
  - **Azure Trusted Signing** — configure the commented `win.azureSignOptions` block in
    `electron-builder.yml` and provide `AZURE_TENANT_ID`/`AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET`.

### GitHub secrets to set (Settings → Secrets and variables → Actions)

| Secret | Value |
| --- | --- |
| `CSC_LINK` | base64 of the certificate file: `.p12` (macOS) or `.pfx` (Windows). `base64 -i cert.p12 \| pbcopy` |
| `CSC_KEY_PASSWORD` | password for that certificate file |
| `APPLE_ID` | the Apple ID email that owns the developer membership |
| `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password (format `xxxx-xxxx-xxxx-xxxx`) |
| `APPLE_TEAM_ID` | the 10-character Team ID |

Notes:

- The release workflow builds each OS on its own runner, so if the Windows and macOS certs
  differ you can use `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` for Windows and keep `CSC_LINK` for
  macOS (electron-builder prefers the `WIN_`-prefixed pair on Windows) — add them to the
  workflow's env block in that case.
- Set **all three** Apple secrets or none: electron-builder 26 skips notarization cleanly when
  none are present, but fails the build when they are only partially set (by design, so a typo
  can't silently ship an un-notarized release).
- The "Report signing status" step in `.github/workflows/release.yml` writes whether artifacts
  were signed/notarized into each run's job summary.

### Verifying a signed release

```sh
# macOS: signature + hardened runtime
codesign -dv --verbose=2 AppDeck.app        # look for "Authority=Developer ID Application: ..."
codesign --verify --deep --strict AppDeck.app
# macOS: Gatekeeper/notarization verdict (run on the dmg or the app)
spctl --assess --type open --context context:primary-signature -v AppDeck-x.y.z.dmg
xcrun stapler validate AppDeck-x.y.z.dmg    # confirms the notarization ticket is stapled

# Windows (Developer Command Prompt / Windows SDK)
signtool verify /pa /v "AppDeck Setup x.y.z.exe"
```

### What users see until then

Unsigned builds still install and auto-update, but with OS friction:

- **Windows:** SmartScreen shows "Windows protected your PC"; users must click
  *More info → Run anyway*.
- **macOS:** Gatekeeper blocks the first launch ("cannot be opened because the developer cannot
  be verified"); users must right-click → Open, or on newer macOS approve it under
  System Settings → Privacy & Security.
- Point cautious users at the `SHA256SUMS-<OS>.txt` file attached to each release for manual
  verification in the meantime.

## Notes

- **Code signing:** see [Signing and notarization](#signing-and-notarization) above — the config
  and CI plumbing are in place; adding the GitHub secrets activates it.
- **Dev builds don't auto-update:** `UpdaterService` is a no-op unless `app.isPackaged`.
- **Switching to self-host later:** replace the `publish` block with
  `provider: generic` + `url: https://.../appdeck/`; no app-code change needed.
- **Private repo:** clients need a token to download; prefer a public repo or a generic/S3 host for
  a private project.
