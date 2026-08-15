# Public Release Checklist

Use this before publishing a public Workshop installer or cutting a public
updater release.

The staged-boundary check, full clean-clone rehearsal, legacy-reference
sanitization, and Phase 4 handoff are complete. Use this checklist again for
each owner-approved release; see `docs/release-readiness-handoff-2026-07-21.md`.

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

## Compatibility Boundary

- `com.lindsaybrunner.workshop` is the permanent Workshop bundle identifier.
  It determines macOS/WebKit's local profile and therefore preserves remembered
  folders, appearance, installed-tool state, and plugin preferences.
- Do not change the bundle identifier, persisted local-storage keys, state
  schemas, or plugin preference namespaces as routine refactoring.
- Any exception requires Lindsay's explicit approval first, a written migration
  and rollback plan, automated migration coverage, and an installed-app
  acceptance test proving existing local state survives the update.
- Never silently reset, discard, or reinterpret user-local state. If a
  migration cannot be made safely, retain the prior state and explain the
  decision before shipping.

## Verification

Run:

```sh
npm test
npm run test:coverage
npm run test:public
npm run typecheck
npm run build
npm run public:check
npm run test:e2e --workspace @marketing-builds/desktop
npm run smoke:megaphone --workspace @marketing-builds/desktop
cargo test --manifest-path apps/marketing-builds-desktop/src-tauri/Cargo.toml
git diff --check
```

For a full local public-source rehearsal of the staged app bundle:

```sh
npm run public:clean-clone -- --run-commands --keep
```

That rehearsal disables updater artifact signing only inside the staged public
clone and verifies the app bundle rather than a DMG. The release workflow must
still build the signed updater artifacts and DMG with the private signing key
configured in CI.

## Release Workflow

The `Release Workshop` GitHub Actions workflow must keep:

- dependency install;
- unit tests;
- typecheck;
- public clean-clone proof;
- signed Tauri build;
- Developer ID signature verification with Hardened Runtime;
- Apple notarization, ticket stapling, and Gatekeeper assessment;
- updater manifest generation;
- updater payload staging;
- Netlify deployment;
- GitHub tag and public GitHub Release;
- stable `Workshop-aarch64.dmg` and SHA-256 checksum upload;
- diagnostic artifact upload when the DMG/signing/notary path fails.

Do not bypass `npm run public:check` for a public updater release.

## Public installer acceptance

Before publishing broadly, use a clean macOS user account without developer
tools or prior Workshop state:

1. Download `Workshop-aarch64.dmg` from the GitHub Release stable URL.
2. Verify its SHA-256 against `Workshop-aarch64.dmg.sha256`.
3. Open the DMG, copy Workshop to Applications, and launch it normally.
4. Confirm Gatekeeper identifies Workshop's Developer ID. Do not accept any
   installation path that needs a security override or Terminal workaround.
5. Confirm a fresh launch shows the empty shelf, then install Slate or Pulse
   and connect a private folder.
6. Keep the prior public release installed long enough to prove detection and
   installation of a newer signed, notarized release.

## Native macOS acceptance

Before calling a signed release complete, test the installed app—not the Vite
preview—on macOS:

1. Open **Workshop → Preferences…** and choose **Custom palette**.
2. Focus the palette text field, type four valid hex values, then press
   **Command-A** followed by **Command-C**.
3. Paste into a separate native app, such as TextEdit, and confirm the exact
   four values arrive.
4. In Workshop’s **Edit** menu, confirm Undo, Redo, Cut, Copy, Paste, and
   Select All are present and Copy is enabled while the field is selected.

This is deliberately a release acceptance check: macOS owns the final native
menu and keyboard dispatch path, which browser tests cannot faithfully invoke.

## Adding New Tools

Every new Workshop tool needs:

- a tool registry entry;
- a packaged docs page;
- demo data or empty templates;
- explicit data roots;
- import/export guards;
- public boundary inventory classification;
- tests proving the tool can start from a clean public clone.
