# Workshop Tool Integration Contract

Workshop integrates tools through a stable, framework-neutral manifest in
`apps/marketing-builds-desktop/src/tool-registry/toolManifest.ts`. The manifest
is the source of truth for a registered tool's stable id, display name, routes,
capabilities, runtime entry point, and required private-workspace fields. The
React registry supplies only presentation details such as icons and install
defaults.

## Current integration mechanisms

| Tool | Runtime kind | Entry point | Private-workspace contract |
| --- | --- | --- | --- |
| Redline | `bundled-core` | `@redline/core` | `workspace.yaml`, then a selected client `client.yaml` |
| Megaphone | `bridge-cli` | `@megaphone/core/bridgeCli` | `workspace.yaml`, then a selected client `client.yaml` |
| Pulse | `external-runner` | `@marketing-builds/pulse` | Private runner URL plus API bearer token; runner owns `pulses.yaml`, `.env`, and state |

The shell owns navigation, presentation, install state, and the constrained
native adapter. A tool owns its domain behavior, data contracts, and generated
local artifacts. The shell must not import or persist private client data.

## Runtime rules

- `bundled-core` is a package contract consumed by Workshop's current bundled
  Redline adapter. Replacing that implementation with a published canonical
  package must preserve this manifest entry point and pass the adapter tests.
- `bridge-cli` invokes the standalone Megaphone bridge through Workshop's
  constrained native layer; it does not copy Megaphone corpora into Workshop.
- `external-runner` means Workshop owns the Pulse management UI while Pulse
  remains the source of truth for schedules, credentials, Android push delivery,
  and state. Workshop uses Pulse's authenticated `/api/v1/snapshot` and
  `/api/v1/occurrences/:id/done` contract; it must not copy runner state into
  the Workshop repository or persist the API bearer token.
- Slate uses the native `slate_read_source` bridge against its selected private
  root. It reads and watches only the two Markdown files named by
  `slate.config.json`; UC and freezer storage each have a local-only view.

## Required checks

Any manifest change must include a focused registry test. Before release, run:

```sh
npm test
npm run typecheck
npm run privacy:scan -- --inventory docs/data-boundary-inventory.json --strict
```

Private configuration failures must make only the affected tool unavailable;
they must not silently fall back to unrelated data or block other tools.
