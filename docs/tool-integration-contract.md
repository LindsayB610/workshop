# Workshop Tool Integration Contract

Workshop integrates tools through a stable, framework-neutral manifest in
`apps/marketing-builds-desktop/src/tool-registry/toolManifest.ts`. For an
external plugin, the plugin package owns its declaration; Workshop layers only
host metadata such as its icon and install defaults. The React registry then
adapts the neutral plugin-view props to Workshop's generic workspace-selection
callback.

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
- Slate is consumed from its own package and uses Workshop's generic configured
  Markdown capabilities. Its private `slate.config.json` may declare any number
  of local Markdown sources; Workshop returns source metadata without exposing
  paths, then reads or watches only a declared source id. See the
  [Workshop plugin host contract](workshop-plugin-contract.md) and the
  [Slate repository](https://github.com/LindsayB610/slate).

## Required checks

Any manifest change must include a focused registry test. Before release, run:

```sh
npm test
npm run typecheck
npm run privacy:scan -- --inventory docs/data-boundary-inventory.json --strict
```

Private configuration failures must make only the affected tool unavailable;
they must not silently fall back to unrelated data or block other tools.
