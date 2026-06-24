# Workshop Signed Updates

Workshop uses Tauri's signed updater. The public key is committed in
`apps/marketing-builds-desktop/src-tauri/tauri.conf.json`; the private key must
stay out of git and should live in the release environment only.

## Current Update Host

- Production update host: `https://workshop-updates-lindsaybrunner.netlify.app`
- Current manifest: `https://workshop-updates-lindsaybrunner.netlify.app/latest.json`
- Netlify project: `workshop-updates-lindsaybrunner`
- Netlify site ID: `c752e385-30f2-4878-b489-03811f8ce106`
- Current hosted release: Workshop `0.1.6`

The durable updater signing key should be stored in GitHub Actions secrets for
`LindsayB610/workshop`:

- `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY`
- `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

The automated release workflow also needs:

- `NETLIFY_AUTH_TOKEN`

As of the Phase 10 readiness pass on 2026-06-20, all three secrets exist in
GitHub and the `Release Workshop` workflow has deployed signed updater payloads.

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
4. Builds the signed Tauri bundle.
5. Generates `latest.json`.
6. Deploys the update payload to Netlify.
7. Uploads the signed update artifacts to the workflow run.

The public Workshop repo does not publish desktop updates automatically on every
push to `main`. Configure the required secrets first, then use manual workflow
dispatch for intentional releases.

## Build A Signed Release

Use this local path only for emergency/manual releases or for reproducing the
workflow locally.

1. Bump the app version:

```sh
npm run updater:bump-version --workspace @marketing-builds/desktop -- 0.2.0
```

This updates the desktop package, Tauri config, Cargo metadata, and Workshop UI
version constant together.

2. Build with the signing key available. The string form is the verified path for
   the current Tauri CLI:

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

4. Publish these files to `https://workshop-updates-lindsaybrunner.netlify.app/`:
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

5. Launch the previous Workshop build and confirm it automatically detects the
   signed update, shows the blue `Update available` button, and installs only
   after that button is clicked.

The app will reject unsigned updates, missing signatures, and non-HTTPS artifact
URLs before the release manifest is published.

## Latest Acceptance Evidence

On 2026-06-20, Workshop `0.1.4` was built with launch-time update checking,
the final public key, and the production update endpoint. Workshop `0.1.5` was
then built, signed, and published to Netlify for installed-app updater
acceptance. The first GitHub Actions release later published signed Workshop
`0.1.6` artifacts to the same Netlify host.

Verified:

- Historical GitHub Actions run `27887662889` completed successfully in the
  private development repo before the public Workshop split:
  `https://github.com/LindsayB610/content-redline/actions/runs/27887662889`
- Hosted `latest.json` returns version `0.1.6`.
- Hosted `latest.json` includes a non-empty `darwin-aarch64` signature.
- Hosted updater archive `Workshop.app.tar.gz` returns HTTP 200.
- Hosted DMG `Workshop_0.1.6_aarch64.dmg` returns HTTP 200.
- Preserved older app bundle initially reported `CFBundleShortVersionString`
  `0.1.4`.
- Launching that preserved older app detected version `0.1.5` and exposed a blue
  `Update available` button.
- Before clicking, the app bundle still reported `CFBundleShortVersionString`
  `0.1.4`.
- Clicking `Update available` installed the hosted update.
- After clicking, the same app bundle reported `CFBundleShortVersionString`
  `0.1.5`.
