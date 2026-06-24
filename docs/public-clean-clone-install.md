# Public Clean Clone Install

This guide is for someone cloning Workshop without access to any private client
workspace.

## Prerequisites

- Node.js 20+
- npm
- Rust stable
- Tauri desktop prerequisites for your operating system

## Install

```sh
npm install
```

CI and release builds use:

```sh
npm ci
```

## Verify

Run the normal project gates:

```sh
npm test
npm run typecheck
npm run build
```

For public-source verification without private client regression fixtures:

```sh
npm run test:public
```

Run the public clean-clone proof:

```sh
npm run public:check
```

That stages a temporary public-source tree, removes private client folders and
build outputs, then verifies:

- only demo/template client folders are present;
- Tauri resources point only at demo/template folders;
- README first-run commands are present;
- the public boundary scanner has no blocking findings.

For a heavier local rehearsal that runs install, public-safe tests, e2e, and
native packaging inside the staged public tree:

```sh
npm run public:clean-clone -- --run-commands --keep
```

The staged rehearsal disables updater artifact signing inside the temporary
clone. Public contributors can prove the app packages without needing the
private release signing key; signed updater artifacts are still created only by
the release workflow.

## Run Workshop

Start the frontend dev app:

```sh
npm run desktop:dev
```

Expected first screen:

- Workshop tool picker
- Redline chiclet
- Megaphone chiclet
- three-dot menus with docs, workspace, demo/private workspace, reset, and
  disable controls

Open Redline or Megaphone. Both should load fictional demo data on first run.

## Run Tauri

Inspect Tauri configuration:

```sh
npm run desktop:tauri -- info
```

Build the native app:

```sh
npm run desktop:tauri -- build
```

The packaged app must bundle only:

```text
clients/demo-redline
clients/demo-megaphone
clients/fixture
clients/template-redline
clients/template-megaphone
```

## Optional Private Workspace

After the public install works, create a private workspace outside the repo:

```text
~/Documents/workshop-private/
  clients/
```

Then follow `docs/private-workspaces.md` to select that root from Workshop.
