# Workshop Release-Readiness Handoff — 2026-07-21

## Decision state

**Ready for owner approval.** This is a release-readiness handoff, not a
release. No commit, tag, GitHub Actions workflow dispatch, Netlify deployment,
or updater publication was performed.

The reviewed baseline is the current working tree rooted at commit `3c1294a`.
It intentionally contains the Phase 0–4 consolidation and public-boundary
changes; `git diff --check` passes. The owner must review, commit, and push the
intended scope before dispatching the release workflow.

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

## Owner actions for an actual release

1. Review the working-tree diff and commit/push the intended release scope.
2. Choose release notes and, if needed, a version override.
3. Manually dispatch **Release Workshop** in GitHub Actions.
4. Confirm the signed updater payload, `latest.json`, DMG, and uploaded
   artifacts.
5. Install or update Workshop and confirm the updater detects the release.

