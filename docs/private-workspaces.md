# Private Workspaces

Workshop can run from the checked-in demo clients, but real client data should
live outside this repository.

Recommended layout:

```text
~/Documents/workshop-private/
  workspace.yaml
  clients/
    acme-redline/
    acme-megaphone/
  pulse/
    pulse.config.json
  slate/
    slate.config.json
```

Each tool still expects a `clients/<client-id>` folder under the selected root.
The selected root should be the folder that contains `clients/`, not the client
folder itself.

## Selecting A Workspace

From the Workshop picker:

1. Open a tool's three-dot menu.
2. Choose `Set private workspace`.
3. Enter the absolute local path to the private workspace root.

The selection is stored in local UI state only. It is not written to the repo,
and changing it does not create, delete, or modify workspace files.

Use `Use demo workspace` to return that tool to the bundled demo root.

## Tool Contracts

Slate private folder:

```text
<private-root>/slate/
  slate.config.json
```

Slate is configured inside Slate, rather than through Workshop's shared client
workspace picker. Select the `slate/` folder that contains
`slate.config.json`, not the configuration file itself. Each Slate source uses
an absolute Markdown path; Slate reads only those declared files and does not
discover neighboring folders. See [using-workshop.md](using-workshop.md) for a
working configuration example.

Redline private root:

```text
<workspace-root>/
  clients/
    <client-id>/
      client.yaml
      source-manifest.json
      canonical/
      sources/
      targets/
      reports/
```

Megaphone private root:

```text
<workspace-root>/
  clients/
    <client-id>/
      client.yaml
      source-manifest.json
      canonical/
      linkedin/
      sources/
      post-packages/
```

Pulse optional manual private folder:

```text
<private-root>/pulse/
  pulse.config.json
```

Pulse's normal guided setup does not require a private folder. For an existing
manual or self-hosted installation, select the folder containing
`pulse.config.json`. The file declares the service endpoint and credential
reference; the credential itself is stored in the operating-system keychain.
Pulse owns its definitions, runner, and state. Workshop exposes only generic
service metadata and constrained requests, and never copies those data into
shared client folders.

## Workspace Index

`workspace.yaml` is the local index Workshop and the tool packages use to agree
on available private clients:

```yaml
version: 1
workspaceType: workshop-private
clients:
  - clientId: acme-redline
    root: clients/acme-redline
    tool: redline
    status: active
  - clientId: acme-megaphone
    root: clients/acme-megaphone
    tool: megaphone
    status: active
```

Workshop validates this index contract before it is used by the app:

- `version` must be `1`.
- each client `root` must be relative and must match `clients/<client-id>`;
- client ids and tool ids must be lowercase slugs;
- duplicate client ids, traversal paths, absolute client roots, and unsupported
  statuses are rejected.

`workspace.yaml` indexes client-scoped Redline and Megaphone folders. Pulse is
configured directly from its own private folder and is not a
`clients/<client-id>` entry.

Slate is separate from `workspace.yaml`: its private `slate.config.json`
directly declares the Markdown sources Slate can display.

The current packaged app still loads the selected client folder through the
tool's normal `clients/<client-id>` path. The next UI step is to surface valid
`workspace.yaml` clients directly in the tool picker/client switcher.

## Git Rules

Do not commit real source snapshots, generated reports, post packages, local
workspace paths, or credentials.

The repo ignores common accidental local workspace folders:

```text
workshop-private/
clients/private-*/
clients/*-private/
```

The safest setup is still to keep the entire private workspace outside this
repository.

## Runtime Guardrails

Workshop validates selected roots before native file actions run:

- selected private roots must be absolute local paths;
- selected roots cannot contain traversal segments;
- known private pilot folders are rejected for public Workshop flows;
- Redline writes stay under the selected Redline client folder;
- Redline live snapshots stay under `targets/fixtures`, `targets/extracted`,
  or `targets/snapshots`;
- Megaphone post-package exports stay under the selected Megaphone client's
  `post-packages/` folder;
- Megaphone onboarding exports cannot write post-package artifacts.
