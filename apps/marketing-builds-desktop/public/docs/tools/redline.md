# Redline

Redline audits a client page against a trusted local source packet.

Use it when you need to compare live or saved page copy against source modules,
proof notes, buyer-language guidance, and approval rules.

Typical workspace contents:

- `sources/` for trusted source snapshots and canonical modules.
- `targets/` for saved page targets.
- `reports/` for audit outputs and edit briefs.
- packet metadata that marks source strength, freshness, and proof status.

Build your own packet with:

- `docs/redline-packet-building.md`
- `docs/public-quickstart.md`
- `docs/private-workspaces.md`
- `docs/troubleshooting-public-workspaces.md`

Disabling Redline in Workshop only hides the tool from the picker. It does not
delete client packets, reports, targets, or local source files.
