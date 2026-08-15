# Workshop

Workshop is a private-first macOS home for small, independent tools. Install
only the apps you want; keep their code public and their working files,
configuration, and credentials on your own machine.

[Download Workshop for Apple Silicon](https://github.com/LindsayB610/workshop/releases/latest/download/Workshop-aarch64.dmg)
· [View the latest release](https://github.com/LindsayB610/workshop/releases/latest)
· [Build a tool for Workshop](docs/workshop-plugin-contract.md)

Workshop does not upload, discover, edit, move, or delete your private files.
A brand-new installation opens to an empty shelf. That is the product, not a
setup failure.

## Choose your path

| If you want to… | Start here |
| --- | --- |
| Install Workshop and add a tool | [Install Workshop](#install-workshop) |
| Connect Markdown files with Slate | [Set up Slate](#set-up-slate) |
| Connect recurring reminders with Pulse | [Set up Pulse](#set-up-pulse) |
| Run or modify Workshop from source | [Develop Workshop](#develop-workshop-from-source) |
| Build an independent app that runs in Workshop | [Build for Workshop](#build-for-workshop) |
| Understand privacy, folders, or recovery | [User guides](#user-guides) |

## Install Workshop

Workshop currently supports Apple Silicon Macs running macOS 11 or later. Intel
Macs, Windows, Linux, and mobile platforms are not supported yet.
The installer is published through GitHub Releases.

1. [Download the notarized Workshop DMG](https://github.com/LindsayB610/workshop/releases/latest/download/Workshop-aarch64.dmg).
2. Open it and drag **Workshop** to **Applications**.
3. Open Workshop from Applications.
4. Choose **Add New Tools**, install Slate or Pulse, then open it from your
   shelf.

The first shelf is empty by design. Apps do not arrive pre-installed, and
installing or removing an app never deletes its private files.

Workshop checks for signed updates when it opens and once per day while it is
open. Choose **Workshop → Check for Updates…** to check immediately. Updates
replace Workshop; they do not alter your private tool folders.

### Verify a download (optional)

Each release includes `Workshop-aarch64.dmg.sha256`. To verify a downloaded
installer, place both files in the same folder and compare these outputs:

```sh
shasum -a 256 Workshop-aarch64.dmg
cat Workshop-aarch64.dmg.sha256
```

They must match exactly. The installer is Developer ID-signed and Apple
notarized; macOS should identify its signer without a security override. For
the details, see [Public Workshop Distribution](docs/public-distribution.md).

## What you can add today

| App | Job | What stays private |
| --- | --- | --- |
| [Slate](https://github.com/LindsayB610/slate) | Read Markdown references you explicitly choose. | A folder with `slate.config.json` and the Markdown paths it declares. |
| [Pulse](https://github.com/LindsayB610/pulse) | Manage recurring reminders and their history. | A folder with `pulse.config.json`; credentials remain in macOS Keychain. |

Slate and Pulse are independent apps with their own repositories, tests, and
documentation. Workshop supplies the desktop frame, app installation, local
folder lifecycle, settings, and narrowly scoped native capabilities.

Redline and Megaphone are contributor fixtures and future work, not available
apps in the public Workshop catalog. The fictional material in `clients/` is
not your starting data set.

## Set up Slate

1. In Workshop, choose **Add New Tools** → **Slate** → **Install**.
2. Create a private folder outside the Workshop and Slate repositories.
3. Put `slate.config.json` in that folder, listing only the Markdown files
   Slate may read.
4. Open Slate, choose that folder, and select **Connect**.

Minimal `slate.config.json`:

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

Slate reads only declared files; it does not scan the selected folder. See
[Using Workshop: Slate](docs/using-workshop.md#connect-slate) for every view,
folder browsing, and recovery behavior.

## Set up Pulse

1. In Workshop, choose **Add New Tools** → **Pulse** → **Install**.
2. Create a private Pulse folder containing `pulse.config.json`.
3. Open Pulse, choose that folder, and complete **Connect Pulse**.

Workshop remembers the selected folder after a successful connection. It gives
Pulse constrained service access and keeps the corresponding credential in your
macOS Keychain. Pulse owns its dashboard, runner, Android setup, backup, and
configuration guidance; use the [Pulse repository](https://github.com/LindsayB610/pulse)
for those details.

### Keep private work private

Keep tool folders outside public repositories. A simple layout is:

```text
~/Documents/workshop-private/
  slate/
    slate.config.json
  pulse/
    pulse.config.json
```

Slate’s Markdown files may live elsewhere; their absolute paths belong only in
your private Slate configuration. Never commit private folders, credentials,
personal inventories, source snapshots, or generated outputs.

## Preferences and recovery

Choose **Workshop → Preferences…** to change Workshop’s local appearance,
two-character mark, and remembered tool folders.

- Appearance is Workshop-only. Apps may inherit its semantic tokens but must
  also work with their own standalone fallback styles.
- Folder actions let you review, change, reconnect, or forget a remembered
  folder. They never search, modify, move, or delete private files.
- A disconnected folder affects only that app. Reconnect it from Preferences
  or the app’s own connection flow.

## Develop Workshop from source

Use this path to work on the shell, inspect its source, or contribute changes.
You need macOS on Apple Silicon, Node.js 20 or later, npm, Rust, and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/).

```sh
git clone https://github.com/LindsayB610/workshop.git
cd workshop
npm ci
npm test
npm run typecheck
npm run desktop:tauri -- dev
```

The last command opens the native development app. For shell-only browser UI
work, run `npm run desktop:dev` instead.

To build a local native bundle without publishing anything, run:

```sh
npm run desktop:tauri -- build
```

Before proposing a change, run:

```sh
npm test
npm run test:coverage
npm run typecheck
npm run build
npm run public:check
```

For the full public-source rehearsal—including a clean dependency install,
browser tests, and native bundle—run:

```sh
npm run public:clean-clone -- --run-commands --keep
```

## Build for Workshop

Workshop is a host, not a monorepo bucket for every tool. A tool should live in
its own repository and own its UI, parsing, state, documentation, tests, and
private configuration. Workshop owns the desktop shell, promotion/install
state, settings, local folder lifecycle, semantic theme tokens, and generic
native capabilities.

Before writing code:

1. Read the [Workshop plugin host contract](docs/workshop-plugin-contract.md).
2. Follow [Adding a Workshop Tool](docs/contributing-tools.md) for declarations,
   privacy boundaries, docs, tests, and promotion.
3. Keep real user data outside this repository and test the tool from a clean
   public consumer installation.

Tools must not import Workshop source code, depend on private Workshop data, or
ask the host to learn their domain-specific configuration.

## User guides

- [Using Workshop](docs/using-workshop.md) — detailed Slate and Pulse setup
- [Public installer and updates](docs/public-distribution.md) — download,
  verification, signatures, and supported platforms
- [Private workspaces](docs/private-workspaces.md) — local folder layout and
  runtime guardrails
- [Troubleshoot local workspaces](docs/troubleshooting-public-workspaces.md)

## Contributor and maintainer guides

- [Workshop plugin contract](docs/workshop-plugin-contract.md)
- [Adding a Workshop Tool](docs/contributing-tools.md)
- [Public quickstart](docs/public-quickstart.md)
- [Public clean-clone install](docs/public-clean-clone-install.md)
- [Public release checklist](docs/public-release-checklist.md)
- [Signed updates and release operations](docs/workshop-updates.md)
- [Workshop appearance contract](docs/workshop-appearance-design.md)
- [Repository roadmap](docs/workshop-roadmap.md)
- [Redline packet building](docs/redline-packet-building.md) — contributor
  fixture documentation
- [Megaphone corpus building](docs/megaphone-corpus-building.md) — contributor
  fixture documentation

## Repository map

```text
apps/marketing-builds-desktop/  Tauri shell, plugin host, and desktop UI
packages/core/                  Redline schemas, audits, and report generation
clients/                        Fictional fixtures and public templates
docs/                           User, contributor, product, and release guides
```

## License

Workshop is licensed under the [MIT License](LICENSE).
