# Public Release Checklist

Use this before publishing the dedicated public Workshop repo/source tree or
cutting a public updater release.

## Source Boundary

- `clients/` contains only classified demo/template fixtures in the public tree.
- Real client folders remain outside the public Workshop repo.
- No Notion, Slack, transcript, call-note, or customer-source snapshots are in
  the public tree.
- Generated reports and post packages are either sanitized demo artifacts or
  excluded.
- `reference/`, build outputs, local workspaces, and dependency folders are
  excluded.

## App Boundary

- Tauri `bundle.resources` lists only demo/template resources.
- Redline defaults to `clients/demo-redline`.
- Megaphone defaults to `clients/demo-megaphone`.
- External workspaces are selected at runtime and stored only in local UI state.
- Tool uninstall/reset actions never delete workspace files.

## Verification

Run:

```sh
npm test
npm run test:public
npm run typecheck
npm run build
npm run public:check
npm run test:e2e --workspace @marketing-builds/desktop
npm run smoke:megaphone --workspace @marketing-builds/desktop
cargo test --manifest-path apps/marketing-builds-desktop/src-tauri/Cargo.toml
git diff --check
```

For a full local public-source rehearsal:

```sh
npm run public:clean-clone -- --run-commands --keep
```

That rehearsal disables updater artifact signing only inside the staged public
clone. The release workflow must still build signed updater artifacts with the
private signing key configured in CI.

## Release Workflow

The `Release Workshop` GitHub Actions workflow must keep:

- dependency install;
- unit tests;
- typecheck;
- public clean-clone proof;
- signed Tauri build;
- updater manifest generation;
- updater payload staging;
- Netlify deployment;
- release artifact upload.

Do not bypass `npm run public:check` for a public updater release.

## Adding New Tools

Every new Workshop tool needs:

- a tool registry entry;
- a packaged docs page;
- demo data or empty templates;
- explicit data roots;
- import/export guards;
- public boundary inventory classification;
- tests proving the tool can start from a clean public clone.
