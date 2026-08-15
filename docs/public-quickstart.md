# Public Quickstart

This guide is for trying or contributing to Workshop from a fresh public clone.
If you have already installed the desktop app, follow
[using-workshop.md](using-workshop.md) instead.

## 1. Install, verify, and open the native app

Workshop's public source path requires macOS on Apple Silicon, Node.js 20 or
later, npm, Rust, and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```sh
git clone https://github.com/LindsayB610/workshop.git
cd workshop
npm ci
npm test
npm run typecheck
npm run desktop:tauri -- dev
```

Tauri starts Vite and opens Workshop. Slate and Pulse are already present on a
fresh installation. Open either app from the shelf when you are ready to
connect its private folder.

## 3. Try Slate With Local-Only Data

Create a private folder outside this clone, then add a Markdown file and a
`slate.config.json` file that names it. The configuration must use absolute
paths. [using-workshop.md](using-workshop.md) provides the full example,
supported views, and privacy rules.

Workshop does not ship a Slate data set. This keeps the public repository free
of personal inventories and makes Slate useful with your own reference files.

Pulse follows the same private-folder pattern: select a folder containing its
public-safe `pulse.config.json`, then complete Pulse's own setup. Its endpoint
metadata is shared with Pulse, but the matching credential stays in the
operating-system keychain.

## 4. Understand The Included Demo Material

The repository also includes fictional Redline and Megaphone demo folders:

```text
clients/demo-redline/
clients/demo-megaphone/
```

They are source fixtures for contributors, not currently installable tools in
the public Workshop catalog. A fork owner can promote a tool only after it has
an intentional product flow, tests, and documentation; see
[contributing-tools.md](contributing-tools.md).

## 5. Keep Real Work Local

Keep real source material, generated reports, credentials, and private
configuration outside this repository. Commit only code, sanitized demo
fixtures, templates, and documentation. See
[private-workspaces.md](private-workspaces.md) for the broader workspace
layout and runtime guardrails.

## Before You Share Changes

```sh
npm test
npm run typecheck
npm run build
npm run public:check
```
