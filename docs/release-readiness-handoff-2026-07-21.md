# Workshop Release-Readiness Handoff — 2026-07-21

## Decision state

**Published successfully.** The user approved the release after reviewing this
handoff. Commit `95dd19e` was pushed to `main`, and **Release Workshop**
published Workshop v0.1.27 on 2026-07-21. The CI build, signing, Netlify
deployment, and artifact publication all passed.

The reviewed baseline is commit `95dd19e` on `main`, containing the Phase 0–4
consolidation and public-boundary changes. `git diff --check` passed before the
commit and the release workflow completed successfully against that commit.

## Verified environment

| Component | Value |
| --- | --- |
| macOS | 26.5.2 (25F84) |
| Node | 22.12.0 |
| npm | 10.9.0 |
| Rust / Cargo | 1.96.0 |

## Local verification evidence

| Check | Result |
| --- | --- |
| `npm test` | Passed: 59 core tests and 176 desktop tests. |
| `npm run test:public` | Passed: public core suite and 176 desktop tests. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed. |
| `npm run public:check` | Passed: staged public tree has only approved client folders and no blocking boundary findings. |
| `npm run test:e2e --workspace @marketing-builds/desktop` | Passed: 14 Playwright tests. |
| `npm run smoke:megaphone --workspace @marketing-builds/desktop` | Passed, including the expected no-credentials AI fallback. |
| `cargo test --manifest-path apps/marketing-builds-desktop/src-tauri/Cargo.toml` | Passed: 25 Rust tests. |
| Full staged rehearsal | Passed install, tests, build, E2E, and native `Workshop.app` bundle in retained clone `/var/folders/vl/87__7z_d50b49y8frgs2f2_m0000gn/T/workshop-public-clone-I8EMge`. |
| `git diff --check` | Passed. |

The local Rust target directory contained stale generated paths from an earlier
workspace location. It was cleaned and rebuilt before the passing Rust and
Megaphone smoke checks; no source files or user data were removed.

## Public-boundary result

The strict scan reports 10 reviewed findings and no blockers:

- 3 intentional local-path guard references in scanner/docs tests.
- 7 sanitized `demo-redline` report artifacts.

The scanner blocks the legacy client identifier, unclassified client folders,
private source snapshots, secrets, and unsafe Tauri resource roots. The staged
clone includes only `demo-megaphone`, `demo-redline`, `fixture`,
`template-megaphone`, and `template-redline` client folders.

## Product and documentation check

- Registered: Redline, Megaphone, and Pulse.
- Planned but unregistered: Slate.
- Deferred: SEO review surface.
- Public docs and the tool integration contract describe those statuses and
  the corresponding private-workspace boundaries.

## Release workflow and CI prerequisites

`.github/workflows/release-workshop.yml` includes dependency installation,
tests, typecheck, public-boundary proof, signed Tauri build, updater-manifest
generation, updater-payload staging, Netlify deployment, and artifact upload.

GitHub contains the required named secrets (values were not read):

- `NETLIFY_AUTH_TOKEN`
- `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY`
- `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## Published release evidence

- Version: `0.1.27`
- Workflow: [Release Workshop run 29868107076](https://github.com/LindsayB610/workshop/actions/runs/29868107076)
- Updater manifest: [latest.json](https://workshop-updates-lindsaybrunner.netlify.app/latest.json)
- Signed updater payload: [Workshop.app.tar.gz](https://workshop-updates-lindsaybrunner.netlify.app/Workshop.app.tar.gz)

The remaining optional follow-through is to install or update Workshop and
confirm that the updater detects v0.1.27 on a user machine.
