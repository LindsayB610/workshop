# Workshop Local Readiness

## Phase 10 Status

Last reviewed: 2026-06-20

Phase 10 is complete. The app now avoids active-looking controls for behavior
that belongs to Phase 11, the local visual pass is complete, and the release
workflow has published a signed updater release.

## Completed

- `Export Reports` is disabled until the local workflow can export/open real
  files from Workshop.
- Report artifact rows are disabled until artifact opening is wired in Phase 11.
- Disabled action states are covered by desktop render tests.
- The `Release Workshop` workflow is checked in and covered by a docs/workflow
  consistency test.
- The required release secrets exist in GitHub:
  - `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY`
  - `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - `NETLIFY_AUTH_TOKEN`
- GitHub Actions run `27887662889` completed successfully and published Workshop
  `0.1.6` to the Netlify update host.
- Hosted `latest.json` returned version `0.1.6` with a non-empty
  `darwin-aarch64` signature.
- Hosted `Workshop.app.tar.gz` and `Workshop_0.1.6_aarch64.dmg` both returned
  HTTP 200.
- Local visual QA was completed with a local Vite run and headless Chrome
  screenshot review at `/private/tmp/workshop-phase10-chrome-2.png`.
- Prior installed-app updater acceptance verified the preserved `0.1.4`
  Workshop app detected hosted signed `0.1.5`, showed `Update available`, and
  installed only after the button was clicked.

## Manual Visual QA Checklist

When the app is run locally, check:

- Workshop opens directly to the Redline workbench without a duplicate launcher.
- The sidebar has one clear navigation surface.
- The selected client is obvious.
- Findings are the primary content.
- Source readiness and exports read as supporting information.
- Disabled export/artifact controls are visibly unavailable and not confusing.
- Update status is quiet unless an update is available.
