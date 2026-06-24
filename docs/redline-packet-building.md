# Building a Redline Packet

Redline works from a local packet: a folder that captures what a client is
allowed to say, what evidence supports it, what should be avoided, and which
pages or drafts should be audited. The packet should live in a private local
workspace, not in the public Workshop repo.

Start from `clients/template-redline/` and copy it to a private folder:

```text
~/Documents/workshop-private/
  clients/
    acme-workflow/
```

## Folder Contract

```text
clients/acme-workflow/
  client.yaml
  source-manifest.json
  canonical/
    positioning.md
    buyer-language.md
    proof-library.md
    objections.md
    content-priorities.md
  sources/
    local/
    notion/
    transcripts/
  targets/
    fixtures/
    extracted/
    snapshots/
  reports/
```

Use lowercase, hyphenated `clientId` values. Keep the same `clientId` in every
source, canonical entry, target, and report artifact.

## Source Collection

Collect the smallest set of material that can support a useful audit:

- current positioning or strategy notes,
- approved buyer-language examples,
- proof, claims, or customer-evidence notes,
- objections and caveats,
- content priorities,
- the page, draft, or site export being audited.

Do not point Redline directly at living SaaS pages as source truth. Snapshot
external material into dated Markdown or JSON first. A good source filename
includes a date and a plain label, such as
`sources/local/2026-06-23-positioning-notes.md`.

## Trust And Freshness

Every source should answer four questions:

- Who owns this source?
- Is it approved, provisional, or rejected?
- When was it last reviewed?
- Does it support public claims, internal direction, or draft thinking only?

Use these practical trust levels:

- `trusted`: approved and maintained.
- `provisional`: useful but needs review before public claims rely on it.
- `stale`: old enough that it should be treated as weak support.
- `rejected`: keep for history, but do not use as evidence.

Maintained sources stay trustworthy longer. Unmaintained pages should decay over
time even if they were once accurate.

## Canonical Modules

Canonical modules are the distilled source of truth that Redline should judge
against. Write them in direct, scannable Markdown.

Suggested modules:

- `positioning.md`: category, differentiation, audience, strategic frame.
- `buyer-language.md`: phrases buyers actually use, without inventing voice.
- `proof-library.md`: approved evidence and explicit claim limits.
- `objections.md`: risks, hesitations, and buyer questions.
- `content-priorities.md`: what the client wants to emphasize now.

Each module should list the source IDs it came from in `source-manifest.json`.
If a module cannot cite a source, keep it marked partial.

## Audit Targets

Targets are not sources of truth. They are the thing being inspected.

Use `targets/fixtures/` for saved HTML or text fixtures and
`targets/snapshots/` for dated snapshot notes. Preserve old target files instead
of overwriting them, so report comparisons remain reproducible.

Good target labels name the state being audited:

- `current-production-homepage`
- `previous-production-homepage`
- `pasted-draft`
- `queued-live-url`

## Readiness Checks

Before running an audit, confirm:

- `client.yaml` parses and names the packet.
- `source-manifest.json` lists every source and canonical module.
- required canonical modules exist.
- proof claims are labeled approved, provisional, or blocked.
- audit targets are local files, pasted drafts, or queued URLs with snapshot
  output paths.
- no source entry points to another client folder.

## Proof Gates

A proof gate prevents Redline or a downstream editor from strengthening unsafe
claims.

Gate these claims until a human approves the evidence:

- metrics,
- availability promises,
- support or SLA promises,
- customer proof,
- pricing comparisons,
- geographic or infrastructure claims,
- absolute language.

Prefer a weaker truthful claim over a stronger unsupported one.

## Validation Workflow

1. Copy `clients/template-redline/` to a private workspace.
2. Fill in `client.yaml`.
3. Add source snapshots.
4. Write canonical modules from those snapshots.
5. Add or snapshot audit targets.
6. Run tests or a local audit against the demo packet first.
7. Run Redline only after the packet reports enough strong or partial evidence
   to support the page being reviewed.

## Keeping The Repo Clean

Do not commit private packets, source snapshots, generated reports, or local
client paths. The public repo should contain only demo data, templates, and
documentation.
