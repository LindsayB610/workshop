# Workshop Public Repo Boundaries

Phase 18 established the boundary for a dedicated public Workshop repository.
Workshop should publish from its own repo, separate from individual tool
source-of-truth repos or private development trees. Phases 20-23 add the demo
data, public docs, external workspace model, and clean-clone proof needed to
publish deliberately.

## Repository Model

The public repo is `workshop`: the host shell, bundled tool adapters, safe
demo/template resources, public docs, release workflow, and updater metadata.

Tool implementation and private client work remain separate:

- Redline and Megaphone may have their own source-of-truth repos or private
  development trees.
- Real client packets, corpora, reports, source snapshots, and local workspace
  state stay outside the public Workshop repo.
- The clean-clone staging script is the export/proof path from this private
  development tree into the public Workshop source shape.

## License

Workshop will use the MIT license. The repository-level license is committed as
`LICENSE` and should ship with the dedicated public Workshop repo.

## Public By Default

These file classes are intended to become publishable in the dedicated public
Workshop repo:

- Workshop shell and tool code under `apps/`.
- Redline core code under `packages/`.
- Build, updater, and contribution documentation after private examples are
  removed.
- Sanitized demo fixtures and empty templates created in Phase 20.
- Public corpus-building docs created in Phase 21.

## Private By Default

These classes must not ship in the public Workshop repo, public package, or
default app bundle:

- Real client folders, including `clients/parasail`.
- Notion, Slack, Google Docs, transcript, or call-note snapshots from a real
  client.
- Generated client reports, edit briefs, source-readiness reports, or agent
  handoff artifacts unless explicitly sanitized as demo data.
- Megaphone real corpora, example posts, measurement exports, and local AI
  credential state.
- Local absolute paths such as `/Users/lindsaybrunner/...`.
- API keys, update signing private keys, Netlify tokens, OpenAI keys, Notion
  tokens, GitHub tokens, and other secrets.
- Tauri bundled resources that include private client or corpus roots.

## Current Reviewed Inventory

The source of truth is `docs/data-boundary-inventory.json`.

Current high-risk items are intentionally classified, not ignored:

- `clients/parasail` is `private-excluded` and must be removed from public
  source/bundles before the public split ships.
- `apps/marketing-builds-desktop/src-tauri/tauri.conf.json` now bundles only
  classified demo/template client resources. Private client roots must be
  selected at runtime through local workspace state.
- App-visible fixtures, smoke tests, and README examples now use Phase 20
  demo/template data. Private planning history and legacy core audit modules
  remain classified until the public-doc and external-workspace phases split
  public Workshop source from private development context.

## Scanner Contract

`apps/marketing-builds-desktop/scripts/public-boundary-scan.mjs` reads the
inventory, scans repository files, and reports:

- blocked private terms,
- local absolute paths,
- Notion/source snapshot paths,
- generated client report paths,
- secret-shaped strings,
- unclassified client-like folders, and
- Tauri resources that bundle private client roots.

The scanner is strict for unreviewed or explicitly unsafe findings. It may
still return reviewed findings for classified private material in this private
  development tree; the public clean-clone proof stages a sanitized Workshop
  tree where those private folders are absent.

## Future-Agent Rules

- New app code belongs under `apps/` and should not import real client folders
  directly.
- New Redline or Megaphone examples must use demo/template data unless the work
  is explicitly private and classified in the inventory.
- Do not add new `clients/<real-client>` or corpus folders without adding an
  inventory entry marked `private-excluded`.
- Do not add Tauri resources that point at `clients`, `megaphone/clients`,
  corpora, local workspaces, or generated reports.
- If a test needs realistic data, prefer generated temporary fixtures or
  sanitized demo fixtures.
- If a public doc needs to mention a real historical client, keep the reference
  brief, avoid source excerpts, and add an inventory allowlist reason.

## Remediation Map

- Phase 19: add the tool catalog and installed-tool state without deleting local
  user workspaces.
- Phase 20: replace app-visible Redline and Megaphone private fixtures with
  sanitized demo clients and templates.
- Phase 21: add public corpus-building docs that explain how users create their
  own private local context.
- Phase 22: move real user/client data outside the repo and harden runtime
  workspace selection.
- Phase 23: prove a clean public clone can install, test, package, and update
  Workshop without private data. Complete through `npm run public:check`,
  `docs/public-clean-clone-install.md`, and `docs/public-release-checklist.md`.
