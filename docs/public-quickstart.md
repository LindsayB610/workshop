# Public Quickstart

This quickstart uses only the checked-in demo and template folders. It is safe
for a fresh clone and does not require private client data.

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

Open Workshop, choose Redline, and inspect the Northstar Demo packet. Then
return to the tool picker and choose Megaphone.

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

## 6. Build Your First Packet

For Redline, follow `docs/redline-packet-building.md`.

For Megaphone, follow `docs/megaphone-corpus-building.md`.

## 7. Keep Generated Work Local

Generated reports, post packages, source snapshots, and credentials should stay
in your private workspace. Commit only code, sanitized demo fixtures, templates,
and docs.
