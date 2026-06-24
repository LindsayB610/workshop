# Private Workspaces

Workshop can run from the checked-in demo clients, but real client data should
live outside this repository.

Recommended layout:

```text
~/Documents/workshop-private/
  clients/
    acme-redline/
    acme-megaphone/
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
