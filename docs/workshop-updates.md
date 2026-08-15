# Workshop Signed Updates

## For Workshop Users

The packaged Workshop app checks for signed updates every time it opens, then
once every 24 hours while it remains open. **Workshop → Check for Updates…**
and **Preferences → Updates** check immediately. If it shows **Update
available**, choose that button to download the update and restart Workshop.
You can keep using the installed version when no update is found or when you
are offline. Updating Workshop changes the app itself; it does not move,
upload, or delete private tool data.

The rest of this document is for maintainers who publish signed releases.

## For Maintainers

Workshop uses Tauri's signed updater. The public key is committed in
`apps/marketing-builds-desktop/src-tauri/tauri.conf.json`; the private key must
stay out of git and should live in the release environment only. Public first
installs use the notarized DMG in [GitHub Releases](public-distribution.md),
not the updater archive.

## Current Update Host

- Production update host: `https://workshop-updates-lindsaybrunner.netlify.app`
- Current manifest: `https://workshop-updates-lindsaybrunner.netlify.app/latest.json`
- Netlify project: `workshop-updates-lindsaybrunner`
- Netlify site ID: `c752e385-30f2-4878-b489-03811f8ce106`
- Current hosted release: the version returned by the live `latest.json` manifest

The durable updater signing key should be stored in GitHub Actions secrets for
`LindsayB610/workshop`:

- `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY`
- `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

The automated release workflow also needs:

- `NETLIFY_AUTH_TOKEN`

Public installer releases additionally require the Developer ID certificate and
App Store Connect notarization secrets documented in
[Public Workshop Distribution](public-distribution.md#maintainer-release-contract).
The permanent public app identifier is `com.lindsaybrunner.workshop`; do not
change it after a public installer is in circulation.

As of 2026-06-24, all three secrets have been rotated and configured in the
public `LindsayB610/workshop` GitHub repository. The committed updater public
key in `tauri.conf.json` must match the private key stored in
`WORKSHOP_TAURI_SIGNING_PRIVATE_KEY`.

## Publish From GitHub Actions

Use the `Release Workshop` workflow when publishing a signed Workshop update.
It is intentionally manual-dispatch so a desktop update is always an explicit
release action.

Required inputs:

- `version`: the Workshop version to publish, such as `0.2.0`
- `notes`: release notes shown in the updater

The workflow:

1. Installs dependencies on macOS.
2. Bumps the Workshop package, Tauri, Cargo, and UI version metadata.
3. Runs tests and typecheck.
4. Builds the Developer ID-signed Tauri bundle with Hardened Runtime.
5. Notarizes and staples the Apple Silicon DMG, then verifies it with macOS
   tooling.
6. Generates `latest.json`.
7. Deploys the update payload to Netlify.
8. Creates a GitHub `vX.Y.Z` release with the notarized
   `Workshop-aarch64.dmg` and checksum.
9. Uploads signed update artifacts and diagnostics to the workflow run.

The public Workshop repo does not publish desktop updates automatically on every
push to `main`. Configure the required secrets first, then use manual workflow
dispatch for intentional releases. A release fails before GitHub Release
creation if signing, notarization, stapling, validation, or updater deployment
fails.

## Build A Signed Release

Use this local path only for emergency/manual releases or for reproducing the
workflow locally.

1. Bump the app version:

```sh
npm run updater:bump-version --workspace @marketing-builds/desktop -- 0.2.0
```

This updates the desktop package, Tauri config, Cargo metadata, and Workshop UI
version constant together.

2. Build with both the Tauri updater key and Apple public-distribution
   credentials available. The manual path is for emergency reproduction only;
   public releases must still be notarized and published through the GitHub
   workflow.

```sh
TAURI_SIGNING_PRIVATE_KEY="$(cat /path/to/workshop-updater.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" \
  npm run tauri --workspace @marketing-builds/desktop -- build
```

3. Write the static updater manifest:

```sh
npm run updater:manifest --workspace @marketing-builds/desktop -- \
  --version 0.2.0 \
  --platform darwin-aarch64 \
  --artifact src-tauri/target/release/bundle/macos/Workshop.app.tar.gz \
  --signature-file src-tauri/target/release/bundle/macos/Workshop.app.tar.gz.sig \
  --app-bundle src-tauri/target/release/bundle/macos/Workshop.app \
  --dmg src-tauri/target/release/bundle/dmg/Workshop_0.2.0_aarch64.dmg \
  --base-url https://workshop-updates-lindsaybrunner.netlify.app \
  --output dist/latest.json \
  --notes "Release notes for Workshop 0.2.0"
```

4. Publish these updater files to `https://workshop-updates-lindsaybrunner.netlify.app/`:
   - `latest.json`
   - `Workshop.app.tar.gz`
   - `Workshop.app.tar.gz.sig`
   - `Workshop_0.2.0_aarch64.dmg`

For the current Netlify host, a production deploy can be pushed with:

```sh
npx netlify deploy --prod \
  --dir /path/to/staged-workshop-update-site \
  --site c752e385-30f2-4878-b489-03811f8ce106
```

5. Upload the notarized DMG and matching SHA-256 checksum to a GitHub Release;
   see [Public Workshop Distribution](public-distribution.md).

6. Launch the previous Workshop build and confirm it automatically detects the
   signed update, shows the blue `Update available` button, and installs only
   after that button is clicked.

The app will reject unsigned updates, missing signatures, and non-HTTPS artifact
URLs before the release manifest is published.

## Latest Acceptance Evidence

On 2026-06-20, Workshop `0.1.4` was built with launch-time update checking,
the final public key, and the production update endpoint. Workshop `0.1.5` was
then built, signed, and published to Netlify for installed-app updater
acceptance. The private development repo later published signed Workshop
`0.1.6` artifacts to the same Netlify host.

After the public repo split, GitHub Actions run `28146316856` in
`LindsayB610/workshop` published signed Workshop `0.1.21` artifacts to the live
Netlify update host on 2026-06-25. Future current-version checks should use the
live `latest.json` manifest rather than this historical evidence section.

Verified:

- Historical GitHub Actions run `27887662889` completed successfully in the
  private development repo before the public Workshop split:
  `https://github.com/LindsayB610/content-redline/actions/runs/27887662889`
- Public GitHub Actions run `28146316856` completed successfully:
  `https://github.com/LindsayB610/workshop/actions/runs/28146316856`
- Hosted `latest.json` returned version `0.1.21` after the first public release.
- Hosted `latest.json` included a non-empty `darwin-aarch64` signature.
- Hosted updater archive `Workshop.app.tar.gz` returned HTTP 200.
- Hosted DMG `Workshop_0.1.21_aarch64.dmg` returned HTTP 200.
- Preserved older app bundle initially reported `CFBundleShortVersionString`
  `0.1.4`.
- Launching that preserved older app detected version `0.1.5` and exposed a blue
  `Update available` button.
- Before clicking, the app bundle still reported `CFBundleShortVersionString`
  `0.1.4`.
- Clicking `Update available` installed the hosted update.
- After clicking, the same app bundle reported `CFBundleShortVersionString`
  `0.1.5`.
