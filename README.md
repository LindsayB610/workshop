# Workshop

Workshop is a local Marketing Builds desktop app for running focused,
client-scoped content tools from one host shell. It ships with fictional demo
data and empty templates so a fresh public clone can run without private client
context.

Redline and Megaphone are bundled tools inside Workshop. Real client packets,
corpora, reports, source snapshots, and credentials should live outside this
public repo and be selected through local workspace settings.

## Alpha Notice

Workshop is early software. It is useful as a local experiment and as a staging
ground for source-backed audit, drafting, and publishing workflows, but its
findings, rewrite guidance, and proof checks should not be trusted without
human review.

## What This Is

Workshop answers one practical question:

> How can a consultant turn trusted local source material into useful audit,
> drafting, review, and publishing workflows without exposing private client
> context?

It is not a generic AI writing app. The core value is source-backed judgment:
tool outputs must trace back to local client context, dated source snapshots,
canonical modules, example corpora, or explicit proof rules.

## Current Status

Implemented through Phase 23:

- Client packet contract and validation.
- Sanitized Redline demo client and workspace template.
- Sanitized Megaphone demo corpus and workspace template.
- Public packet/corpus-building docs for Redline, Megaphone, private workspace
  setup, troubleshooting, and future tool contributors.
- External local workspace selection for keeping real client data outside the
  repo while the packaged app ships only demo/template resources.
- Public clean-clone proof for installing, testing, packaging, and updating
  Workshop without private client data.
- Source readiness and trust/freshness checks.
- Snapshot-first source workflow for local client packets.
- Single-page extraction, judge validation, quote checks, and report generation.
- Multi-page crawl primitives.
- Human and agent-ready report bundle outputs.
- Edit brief generation from agent edit plans.
- Workshop desktop app with Redline as the first sub-tool.
- Signed Tauri updater configuration and release-manifest tooling.

Current hardening:

- Workshop opens with fictional demo data so a fresh clone can run without real
  client context. Real client packets should live outside the public repo and be
  selected from a local private workspace.

See the public setup docs below for install, private workspace, and tool authoring
guidance.

## Choose Your Path

Use Workshop when you want the desktop shell, local workspace picker, bundled
demo data, and one place to run multiple Marketing Builds tools.

Use Redline directly when you only need the CLI or package for source-backed
page and draft review.

Use Megaphone directly when you only need the package workflow for LinkedIn
corpus, brief, draft, review, and post-package generation.

For a first run, start with Workshop's checked-in demo data. For real work,
create a private workspace outside the repo and point Workshop at that root.

## Repository Layout

```text
apps/
  marketing-builds-desktop/   Workshop Tauri app
packages/
  core/                       Redline schemas, packet validation, audits, reports
clients/
  demo-redline/               Fictional Redline demo packet and report artifacts
  demo-megaphone/             Fictional Megaphone demo corpus and package
  template-redline/           Empty Redline packet template
  template-megaphone/         Empty Megaphone corpus template
  fixture/                    Minimal second-client packet for isolation tests
docs/
  client-onboarding-design.md
  redline-packet-building.md
  megaphone-corpus-building.md
  public-quickstart.md
  private-workspaces.md
  public-clean-clone-install.md
  public-release-checklist.md
  troubleshooting-public-workspaces.md
  contributing-tools.md
  marketing-builds-workbench.md
  workshop-updates.md
bin/
  redline.js                  CLI entrypoint
```

## Client Isolation

The hard boundary is `clients/<clientId>/`.

Every client packet owns its own:

- `client.yaml`
- `source-manifest.json`
- canonical modules
- source snapshots
- audit targets
- report outputs
- edit briefs

Source and canonical entries carry `clientId`, and validation rejects
cross-client references. Workshop may eventually remember recent clients, but
Redline should only load one active client packet at a time.

The desktop Redline UI includes a client switcher. Tests prove that the fixture
client renders from its own packet paths and does not leak demo report paths or
copy.

## Private Client Migration

Keep real client folders outside this repository. A practical local layout is:

```text
~/Documents/marketing-builds-private/
  clients/
    <real-client>/
```

Use `clients/template-redline/` and `clients/template-megaphone/` as folder
contracts, then copy the template into a private workspace before adding source
snapshots, proof notes, generated reports, or post examples.

Public setup docs:

- [docs/public-quickstart.md](docs/public-quickstart.md): fresh clone through
  demo data and private local workspace setup
- [docs/private-workspaces.md](docs/private-workspaces.md): local workspace
  layout, tool contracts, runtime guardrails, and git ignore expectations
- [docs/redline-packet-building.md](docs/redline-packet-building.md): how to
  collect sources, write canonical modules, define targets, and validate a
  Redline packet
- [docs/megaphone-corpus-building.md](docs/megaphone-corpus-building.md): how
  to build a Megaphone corpus, taxonomy, proof policy, examples, and local AI
  credential setup
- [docs/troubleshooting-public-workspaces.md](docs/troubleshooting-public-workspaces.md):
  fixes for thin sources, stale material, proof gaps, missing examples, and
  unsafe claims
- [docs/contributing-tools.md](docs/contributing-tools.md): how future agents
  should add Workshop tools

## Prerequisites

- Node.js 20+
- npm
- Rust and the Tauri prerequisites for native desktop builds

Install dependencies:

```sh
npm install
```

## Common Commands

Run all tests:

```sh
npm test
```

Run the public-safe test subset used by clean-clone verification:

```sh
npm run test:public
```

Run the public clean-clone proof:

```sh
npm run public:check
```

Typecheck all workspaces:

```sh
npm run typecheck
```

Build all TypeScript / frontend artifacts:

```sh
npm run build
```

Run the Workshop frontend dev server:

```sh
npm run desktop:dev
```

Then open the local dev URL, choose `Add New Tools` if no tools are installed,
and install Redline or Megaphone from the picker. Use each tool's three-dot menu
to select a private workspace when you are ready to use real client data.

Run Tauri commands for Workshop:

```sh
npm run desktop:tauri -- info
```

Build the native Workshop app:

```sh
npm run desktop:tauri -- build
```

## CLI

The current CLI supports preparing a Codex-ready edit brief from an agent edit
plan:

```sh
npm run redline -- prepare-edit-brief \
  --report clients/demo-redline/reports/launch-review/agent-edit-plan.json
```

Write the brief to a file:

```sh
npm run redline -- prepare-edit-brief \
  --report clients/demo-redline/reports/launch-review/agent-edit-plan.json \
  --out clients/demo-redline/reports/launch-review/edit-brief.md
```

## Workshop Desktop App

Workshop is the local Tauri app. It is intended to host multiple Marketing
Builds tools over time:

- Redline
- future independent sub-tools

Redline is the first tool. The current desktop screen shows the Northstar Demo
Co. audit packet or the fixture isolation packet, source readiness, findings,
and report artifacts.

## Signed Updates

Workshop uses Tauri signed updates. The checked-in config contains the public
updater key only. The private signing key must stay out of git and live in the
release environment.

Release helpers:

```sh
npm run updater:bump-version --workspace @marketing-builds/desktop -- 0.2.0
npm run updater:manifest --workspace @marketing-builds/desktop -- --help
```

Full update instructions live in [docs/workshop-updates.md](docs/workshop-updates.md).
Routine signed releases should use the manual `Release Workshop` GitHub Actions
workflow so tests, signing, manifest generation, Netlify publishing, and
artifact upload happen together.

## Key Docs

- [docs/public-quickstart.md](docs/public-quickstart.md): public demo and
  private-workspace setup
- [docs/private-workspaces.md](docs/private-workspaces.md): private workspace
  layout, selector behavior, runtime guardrails, and git rules
- [docs/public-clean-clone-install.md](docs/public-clean-clone-install.md):
  clone/install/test/package proof for public Workshop users
- [docs/public-release-checklist.md](docs/public-release-checklist.md):
  source, app, verification, and updater release checklist
- [docs/redline-packet-building.md](docs/redline-packet-building.md): Redline
  packet-building guide
- [docs/megaphone-corpus-building.md](docs/megaphone-corpus-building.md):
  Megaphone corpus-building guide
- [packages/core/docs/client-packet.md](packages/core/docs/client-packet.md):
  client packet contract
- [docs/client-onboarding-design.md](docs/client-onboarding-design.md):
  onboarding model for turning messy context into audit-ready packets
- [docs/marketing-builds-workbench.md](docs/marketing-builds-workbench.md):
  Workshop app architecture
- [docs/workshop-updates.md](docs/workshop-updates.md):
  signed desktop update workflow

## License

Workshop is licensed under the MIT License. See [LICENSE](LICENSE).

## Development Notes

- Keep generated build outputs out of git.
- Keep external connector data snapshot-first; Notion and similar services are
  source adapters, not the runtime source of truth.
- Prefer adding tests around schemas, packet boundaries, source validation,
  report stability, and release workflow contracts.
- Do not let client-specific assumptions enter generic code. Public examples
  should use fictional demo/template data. Real client language belongs in a
  private local workspace, not this repo.
