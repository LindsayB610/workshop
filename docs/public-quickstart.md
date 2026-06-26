# Public Quickstart

This quickstart uses only the checked-in demo and template folders. It is safe
for a fresh clone and does not require private client data.

Use this path if you want to try Workshop as an app. If you only want the
standalone Redline or Megaphone packages, use their public repos instead.

## 1. Install

```sh
npm install
```

## 2. Run The Tests

```sh
npm run test:public
```

## 3. Start Workshop

```sh
npm run desktop:dev
```

Open the local dev URL.

Fresh installs may show an empty picker. Choose `Add New Tools`, install
Redline or Megaphone, then open the tool from the picker.

In Redline, inspect the Northstar Demo packet, source readiness, findings, and
report artifacts. Then return to the tool picker and try Megaphone's demo
corpus and package views.

## 4. Review The Demo Data

Redline demo:

```text
clients/demo-redline/
```

Megaphone demo:

```text
clients/demo-megaphone/
```

The demo data is fictional. It exists so you can see working packets, reports,
source readiness, review queues, and package outputs without private data.

## 5. Create A Private Workspace

Create a folder outside the repo:

```text
~/Documents/workshop-private/
  clients/
```

Copy templates into that folder:

```text
clients/template-redline/ -> ~/Documents/workshop-private/clients/acme-redline/
clients/template-megaphone/ -> ~/Documents/workshop-private/clients/acme-megaphone/
```

Do not add real source material directly under the public repo.

See `docs/private-workspaces.md` for the runtime selector, per-tool folder
contracts, and git ignore rules.

In the app, open a tool's three-dot menu and choose `Set private workspace`.
Enter the absolute path to the folder that contains `clients/`:

```text
~/Documents/workshop-private
```

Do not select the individual client folder.

## 6. Build Your First Packet

For Redline, follow `docs/redline-packet-building.md`.

For Megaphone, follow `docs/megaphone-corpus-building.md`.

The minimum useful Redline packet has:

- `client.yaml`
- `source-manifest.json`
- canonical modules with source references
- at least one saved target or draft

The minimum useful Megaphone corpus has:

- `client.yaml`
- `source-manifest.json`
- canonical modules
- LinkedIn strategy and policy files
- a small scored example set

## 7. Keep Generated Work Local

Generated reports, post packages, source snapshots, and credentials should stay
in your private workspace. Commit only code, sanitized demo fixtures, templates,
and docs.

## Common Next Steps

- Use `npm run public:check` before publishing or packaging a public build.
- Use `Use demo workspace` from a tool menu if a private workspace path is
  wrong or incomplete.
- Use `docs/troubleshooting-public-workspaces.md` when source readiness is weak
  or proof gates block draft output.
