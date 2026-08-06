# Workshop

Workshop is a local desktop shell for small, private-data-aware work tools. It
keeps the application code, tests, fictional demos, and templates in this
repository while keeping real client material, credentials, and personal files
on the user’s machine.

It is deliberately quiet by default: Slate is available to install, but no tool
is installed automatically. A fresh install opens to an empty Workshop shelf,
so each user explicitly chooses when to add Slate.

## Start Here

Choose the path that fits how you will use Workshop:

| If you want to… | Start with… |
| --- | --- |
| Use the installed Workshop app | [Using Workshop](docs/using-workshop.md) |
| Try or develop Workshop from this repository | [Set up from source](#set-up-from-source) |
| Make one of the included tools available in your own fork | [Promote a tool](#promote-a-tool-in-your-fork) |
| Add real working data | [Create a private workspace](#create-a-private-workspace) |
| Verify a public-safe change before sharing it | [Run the checks](#run-the-checks) |
| Build a desktop application bundle | [Package Workshop](#package-workshop) |

## What a Fresh Install Contains

The repository contains these registered tools. Slate and Pulse are ready as
optional installs; the remaining tools are still planned:

| Tool | Availability | Purpose | Private input boundary |
| --- | --- | --- | --- |
| Slate | Available from **Add New Tools** | Configurable local Markdown reference views | A private `slate.config.json` declares the Markdown files and views. |
| Redline | Planned | Source-backed page and draft review | A private client workspace containing packets, snapshots, and reports. |
| Megaphone | Planned | Campaign planning and post-package workflows | A private client corpus and generated post packages. |
| Pulse | Available from **Add New Tools** | Persistent recurring-obligation view | A private `pulse.config.json`; its credential remains in the operating-system keychain. |

The public repository includes fictional Redline and Megaphone demos and empty
templates. It does **not** include real client data, Slate inventories, Pulse
state, credentials, local paths, or private configuration.

## Set Up From Source

This path is for contributors. If you installed the app and want to use Slate,
start with [Using Workshop](docs/using-workshop.md) instead.

### Prerequisites

- Node.js 20 or later
- npm
- Rust and the [Tauri prerequisites](https://tauri.app/start/prerequisites/)
  only if you will run or package the native desktop app

### Install and verify

```sh
git clone https://github.com/LindsayB610/workshop.git
cd workshop
npm ci
npm test
npm run typecheck
```

### Run the desktop interface

```sh
npm run desktop:dev
```

Open the local address Vite prints. Seeing an empty shelf is expected until you
install Slate or Pulse from **Add New Tools**.

## Promote a Tool in Your Fork

Promotion is a source-controlled product decision, not a user preference in
the app. This avoids exposing unfinished tools through a public build.

1. In `apps/marketing-builds-desktop/src/tool-registry/toolManifest.ts`, change
   the chosen tool’s `status` from `"planned"` to `"ready"`.
2. In `apps/marketing-builds-desktop/src/tool-registry/tools.ts`, keep
   `defaultInstalled: false` to show it in **Add New Tools**, or set it to
   `true` to install it for new users automatically.
3. Implement the [Workshop plugin host contract](docs/workshop-plugin-contract.md),
   then add or update the tool’s tests and documentation for its real setup flow.
4. Run [the checks](#run-the-checks) before committing or releasing.

Once promoted, an optional tool appears in **Add New Tools**. A
default-installed tool appears directly on the shelf. Existing local install
state cannot make a still-planned tool visible.

## Create a Private Workspace

Keep real data outside this repository. A practical layout is:

```text
~/Documents/workshop-private/
  workspace.yaml
  clients/
    acme-redline/
    acme-megaphone/
  slate/
    slate.config.json
  pulse/
    pulse.config.json
```

Use `clients/template-redline/` and `clients/template-megaphone/` as starting
points for real client folders, then add source material only in the private
copy. The public example [`workspace.example.yaml`](workspace.example.yaml)
shows the client-index shape without containing client data.

After you promote Redline or Megaphone, use that tool’s menu to select the
private workspace root—the folder that contains `clients/`, not an individual
client folder. Slate reads only the source paths declared in its private
configuration; the complete user setup is in
[Using Workshop](docs/using-workshop.md). Pulse is also configured in its own
private folder. Workshop reads only its declared service metadata and retrieves
the matching credential from the operating-system keychain when Pulse requests
a constrained service call.

Never commit private workspaces, credentials, source snapshots, generated
reports, post packages, personal inventories, or filled-in configuration.

## Run the Checks

Run these before sharing source changes:

```sh
# Unit and integration tests
npm test

# Type safety and production frontend build
npm run typecheck
npm run build

# Public-boundary scan and clean staged-clone validation
npm run public:check
```

For the fullest public-install rehearsal—including a clean dependency install,
browser tests, and a native app bundle—run:

```sh
npm run public:clean-clone -- --run-commands --keep
```

The retained temporary clone is useful when diagnosing a public-build failure;
delete it when you no longer need the evidence.

## Package Workshop

Build the native application locally:

```sh
npm run desktop:tauri -- build
```

Signed update releases require the private signing key and release-environment
configuration. Use the manual `Release Workshop` GitHub Actions workflow for
an actual release; see [docs/workshop-updates.md](docs/workshop-updates.md).

## Repository Map

```text
apps/marketing-builds-desktop/  Tauri desktop shell and registered tools
packages/core/                 Redline schemas, audits, and report generation
clients/                       Fictional demos and empty client templates
docs/                          Product, workspace, tool, and release guides
bin/redline.js                 Redline CLI entry point
```

## Further Reading

- [docs/public-quickstart.md](docs/public-quickstart.md) — demo and local
  development orientation
- [docs/using-workshop.md](docs/using-workshop.md) — install, update, and Slate
  setup for app users
- [docs/private-workspaces.md](docs/private-workspaces.md) — private-workspace
  layout and runtime guardrails
- [docs/public-clean-clone-install.md](docs/public-clean-clone-install.md) —
  clean public-build procedure
- [docs/public-release-checklist.md](docs/public-release-checklist.md) —
  release checklist
- [docs/redline-packet-building.md](docs/redline-packet-building.md) — Redline
  client-packet contract
- [docs/megaphone-corpus-building.md](docs/megaphone-corpus-building.md) —
  Megaphone corpus contract
- [docs/troubleshooting-public-workspaces.md](docs/troubleshooting-public-workspaces.md)
  — common workspace and source-readiness problems
- [docs/contributing-tools.md](docs/contributing-tools.md) — adding a Workshop
  tool safely
- [docs/workshop-plugin-contract.md](docs/workshop-plugin-contract.md) —
  building an independently versioned app for Workshop

## Project Principles

- Real data stays local and outside the public repository.
- Public source uses fictional demos and structural templates only.
- A private-workspace problem affects only the selected tool; it never falls
  back to unrelated data.
- Deterministic behavior, boundaries, and tool contracts need regression tests.
- Promotion and release are explicit decisions; passing tests alone does not
  make an unfinished tool user-facing.

## License

Workshop is licensed under the [MIT License](LICENSE).
