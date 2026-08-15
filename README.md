# Workshop

Workshop is a macOS desktop home for small, private-data-aware tools. It gives
you one place to install and open independent apps while keeping their code,
configuration, credentials, and working files in the right places.

The shell is public source. Your real Markdown files, reminder data, service
credentials, and private configuration stay on your machine. Workshop does not
upload, discover, edit, move, or delete those files.

**Slate and Pulse are part of the shipped Workshop experience.** They appear
on the shelf after a fresh install and after a shell update; connecting either
one to private data remains an explicit, local action.

## Start here

| Your goal | Go here |
| --- | --- |
| Run Workshop from this public repository | [Run Workshop from source](#run-workshop-from-source) |
| Use a Workshop app someone has provided | [Install a provided app](#install-a-provided-app) |
| Add and configure Slate or Pulse | [Set up your first tool](#set-up-your-first-tool) |
| Build an app that runs in Workshop | [Build for Workshop](#build-for-workshop) |
| Contribute to the shell itself | [Development and checks](#development-and-checks) |

## What you can use today

| Tool | What it does | What you provide privately |
| --- | --- | --- |
| Slate | Displays Markdown references you explicitly choose. | A folder with `slate.config.json` and the Markdown paths it declares. |
| Pulse | Manages recurring reminders and their history. | A folder with `pulse.config.json`; its credential stays in your macOS Keychain. |

Redline and Megaphone are registered for future development, but they are not
available in the public Workshop build. The fictional material
in `clients/` exists for contributors; it is not your starting data set.

## Run Workshop from source

This is currently the complete public installation path. Workshop does not yet
publish a downloadable installer through GitHub Releases.

### You need

- macOS on Apple Silicon (the maintained signed build target is `darwin-aarch64`)
- Node.js 20 or later and npm
- Rust and the [Tauri prerequisites](https://tauri.app/start/prerequisites/)

### Install, verify, and open the native app

```sh
git clone https://github.com/LindsayB610/workshop.git
cd workshop
npm ci
npm test
npm run typecheck
npm run desktop:tauri -- dev
```

The last command starts Vite and opens the native Workshop window. You do not
need to open the local Vite address yourself. The first window shows Slate and
Pulse, ready for you to connect to local private folders.

## Install a provided app

If you installed Workshop from the public GitHub Release:

1. Open the `.dmg` and drag **Workshop** to **Applications**.
2. Open **Workshop** from Applications.
3. Open Slate or Pulse from the shelf and connect its private folder.

Workshop checks for signed updates when it opens and daily while it remains
open. To check immediately, choose **Workshop → Check for Updates…**. An
update never changes your private tool folders.

## Set up your first tool

### Slate: local Markdown views

1. Create a private folder outside both the Workshop and Slate repositories.
2. Put `slate.config.json` in that folder and list only the Markdown files you
   want Slate to read.
3. Open Slate, select that folder, and choose **Connect**.

Minimal example:

```json
{
  "version": 1,
  "sources": [
    {
      "id": "weekly-notes",
      "label": "Weekly notes",
      "path": "/absolute/path/to/weekly-notes.md",
      "view": "markdown-tabs"
    }
  ]
}
```

See [Using Workshop](docs/using-workshop.md#connect-slate) for all supported
Slate views, recovery steps, and the privacy boundary.

### Pulse: recurring reminders

1. Create a private Pulse folder containing `pulse.config.json`.
2. Open Pulse and select that folder when prompted.
3. Use Pulse’s **Connect Pulse** flow to store its credential in your macOS
   Keychain and load the dashboard.

Workshop remembers the selected folder after a successful connection. It gives
Pulse only safe service metadata and constrained service results; it never
hands the credential to Pulse. For Pulse’s runner, Android, backup, and config
instructions, use the [Pulse repository](https://github.com/LindsayB610/pulse).

### Your private folder layout

Keep private data outside every public repository. For example:

```text
~/Documents/workshop-private/
  slate/
    slate.config.json
  pulse/
    pulse.config.json
```

You may keep the Markdown files Slate reads elsewhere. Their absolute paths
live only in your private Slate configuration. Never commit private folders,
credentials, personal inventories, source snapshots, or generated outputs.

## Preferences and folders

Choose **Workshop → Preferences…** to change Workshop’s local appearance,
two-character personal mark, and remembered tool folders.

- Appearance choices are shell-only. Plugins can inherit theme tokens, but
  still work with their own standalone fallbacks.
- Folder actions can review, change, reconnect, or forget a remembered folder.
  They never search for, modify, move, or delete private files.
- A disconnected folder affects only its own tool. Reconnect that tool from
  Preferences or its in-app connection flow.

## Development and checks

Use the browser-only frontend preview when you are working on shell UI without
native capabilities:

```sh
npm run desktop:dev
```

Before sharing source changes, run:

```sh
npm test
npm run typecheck
npm run build
npm run public:check
```

For the fullest public-install rehearsal—including a clean dependency install,
browser tests, and a native bundle—run:

```sh
npm run public:clean-clone -- --run-commands --keep
```

To build a local native app bundle:

```sh
npm run desktop:tauri -- build
```

Signed updates are intentionally published through the manual **Release
Workshop** GitHub Actions workflow; see [Workshop signed updates](docs/workshop-updates.md).

## Build for Workshop

Workshop owns the desktop shell, settings, local folder lifecycle, semantic
theme tokens, and narrowly scoped native capabilities. Each tool is an
independently versioned application that owns its interface, parsing, state,
and private configuration. Tools must never import Workshop source code or
depend on private Workshop data.

Read the [Workshop plugin contract](docs/workshop-plugin-contract.md) before
building an app, then use [Contributing tools](docs/contributing-tools.md) to
add its declaration, tests, and promotion path. Promotion is a source-controlled
decision: a planned tool does not become visible merely because local state says
it was installed.

## Repository map and deeper docs

```text
apps/marketing-builds-desktop/  Tauri shell, plugin host, and desktop UI
packages/core/                 Redline schemas, audits, and report generation
clients/                       Fictional fixtures and public templates
docs/                          User, contributor, product, and release guides
```

- [Using Workshop](docs/using-workshop.md) — detailed Slate and Pulse setup
- [Public quickstart](docs/public-quickstart.md) — public-clone orientation
- [Private workspaces](docs/private-workspaces.md) — folder layout and runtime guardrails
- [Troubleshoot local workspaces](docs/troubleshooting-public-workspaces.md)
- [Public clean-clone install](docs/public-clean-clone-install.md)
- [Public release checklist](docs/public-release-checklist.md)
- [Redline packet building](docs/redline-packet-building.md)
- [Megaphone corpus building](docs/megaphone-corpus-building.md)
- [Workshop appearance contract](docs/workshop-appearance-design.md)
- [Workshop plugin contract](docs/workshop-plugin-contract.md)

## License

Workshop is licensed under the [MIT License](LICENSE).
