# Workshop Completion Plan

## Purpose

Bring the existing Workshop desktop app to a defensible public-release-ready
state. This plan begins from the current working product; it does not recreate
the historical Redline, client-onboarding, or initial Workshop phases.

Workshop is release ready when a clean public clone can install, test, build,
run its public-safe checks, and package without real client data or private
signing material. Releasing or publishing remains a separate, explicit owner
decision.

## Principles

- Public source contains code, tests, documentation, synthetic demos, and
  templates—not real client material, credentials, or production state.
- A script is not proof until its commands have run and the result is recorded.
- Write focused tests before changing deterministic behavior, public-boundary
  policy, tool contracts, or file-access rules.
- Preserve the current private-workspace boundary: a missing private workspace
  affects only its tool and must never trigger a fallback to unrelated data.
- Do not publish, tag, deploy, or create a release as part of this plan without
  explicit owner approval.

## Phases at a glance

| Phase | Status | Name | Outcome | Gate / next action |
| --- | --- | --- | --- | --- |
| 0 | Complete | Release baseline | Current code, manifest contracts, docs, and staged-boundary validation are understood. | Maintain the verified baseline; no historical work needs reopening. |
| 1 | Complete | Full clean-clone rehearsal | Install, tests, build, E2E, and a native app bundle passed inside a staged public tree. | Evidence feeds the Phase 4 release handoff. |
| 2 | Complete | Legacy-reference policy | Option A: remove legacy client-specific public references. | Policy is recorded and enforced by the scanner. |
| 3 | Complete | Implement and verify the policy | Legacy modules/fixtures were removed and generic coverage replaced them. | Proceed to release-readiness handoff. |
| 4 | Complete | Release-readiness handoff | Local checklist, workflow, CI-secret presence, and release evidence are recorded. | Workshop v0.1.27 published on 2026-07-21. |
| Product A | Ongoing | Registered tools | Maintain Redline, Megaphone, and Pulse contracts. | Covered by tool-manifest and tool-specific tests. |
| Product B | Ongoing | Slate | Independently versioned Slate plugin is consumed through Workshop's generic Markdown host capabilities. | Maintain the package pin and cross-repository integration coverage. |
| Product C | Deferred | SEO review surface | Design a shared automation-output review experience. | Do not register SEO Tools before that product brief exists. |

## Phase 0 — Release baseline

**Status: complete**

### Goal

Establish what already works so release-readiness work is narrowly scoped and
does not reopen completed product development.

### Current baseline

- Workshop registers Redline, Megaphone, and Pulse through the manifest at
  `apps/marketing-builds-desktop/src/tool-registry/toolManifest.ts`.
- Real client work is external to Workshop; `workspace.example.yaml` documents
  the public-safe client-index shape.
- `npm test`, `npm run typecheck`, and `npm run public:check` pass in the
  current development tree.
- The staged public-source check permits only the approved demo/template client
  folders and reports no blocking boundary findings.
- Slate is registered as an external plugin through generic Markdown-source host
  capabilities. SEO Tools is intentionally deferred.

### Ongoing guardrails

- Keep the tool-manifest contract tests green when a registered tool changes.
- Keep public/private docs and `workspace.example.yaml` aligned with runtime
  behavior.
- Do not treat the Phase 0 evidence as proof that the full staged command plan
  has run; that is Phase 1.

## Phase 1 — Full clean-clone rehearsal

**Status: complete**

### Goal

Run the same practical workflow a public contributor would use, from a staged
source tree that excludes private folders and build output.

### Command

```sh
npm run public:clean-clone -- --run-commands --keep
```

### Required checks

- The staged clone completes `npm ci` from its own lockfile.
- Unit tests and public-safe tests pass in the staged clone.
- The production build completes.
- Desktop E2E completes against the public-safe fixture set.
- The Tauri app-bundle build completes with updater signing disabled only in
  the temporary staged clone. DMG creation and signing remain release-workflow
  checks because they require the host macOS disk-image environment.
- The retained staging directory contains only approved client folders and no
  private workspace, reference, dependency, or generated-build inputs.

### TDD / verification approach

- If staging omits a required public file, add a failing clean-clone test that
  demonstrates the omission before changing the staging allow/deny logic.
- If a command needs a release-only exception, encode the narrowest possible
  test and document why it is safe in the staged clone.
- Do not hide a failure by excluding more source without first classifying the
  file and deciding whether it belongs in public source.

### Result

Re-verified on 2026-07-21 after Phase 3 sanitization in retained staged clone
`/var/folders/vl/87__7z_d50b49y8frgs2f2_m0000gn/T/workshop-public-clone-I8EMge`:

- Environment: macOS 26.5.2 (25F84), Node 22.12.0, npm 10.9.0, and Rust
  1.96.0.

- `npm ci` passed.
- The staged tree passed 59 core and 176 desktop unit tests.
- The production build passed.
- All 14 desktop Playwright E2E tests passed.
- The native `Workshop.app` bundle passed with updater artifacts disabled only
  in that temporary clone; the app is retained at
  `apps/marketing-builds-desktop/src-tauri/target/release/bundle/macos/Workshop.app`.

Two clean-clone defects were found and fixed during this rehearsal: the
external Pulse contract test no longer assumes a sibling Pulse repository in a
public clone, and the staged native-build command now forwards its app-bundle
argument through nested npm scripts correctly.

### Exit criteria

- The complete command plan succeeds against the sanitized final source.
  **Met 2026-07-21.**
- Command output, environment notes, and the retained staging path are recorded
  in the release handoff.
- Any failure is converted into a scoped Phase 1 follow-up with a regression
  test before retrying. **Met:** both rehearsal defects above are covered by
  the registry and clean-clone test suites.

## Phase 2 — Decide the legacy-reference policy

**Status: complete — Option A (sanitize)**

### Context

The boundary inventory previously reported legacy pilot references in code,
tests, and boundary documentation. The owner selected Option A on 2026-07-21.

### Decision options

| Option | Scope | Benefits | Cost / risk |
| --- | --- | --- | --- |
| A. Sanitize | Rename/remove client-specific modules, fixtures, test labels, and nonessential docs; replace them with synthetic equivalents. | Cleanest public source and lowest ongoing privacy-review burden. | Requires careful regression coverage for legacy audit behavior. |
| B. Retain with justification | Keep only references that are necessary historical or test context; document each retained class and tighten the inventory allowance. | Smaller refactor and preserves context. | Requires recurring review and a clear public-safe rationale. |

### Decision record

- Owner decision: Option A — sanitize.
- Date: 2026-07-21.
- Included: client-specific core modules, private-fixture tests, generic test
  labels and URLs, boundary docs, and the inventory rule that named the legacy
  client.
- Excluded: synthetic demo/template fixtures and generic scanner regression
  coverage.
- Policy: real client material and identifying references do not belong in the
  public repository; the boundary scanner blocks the former client identifier,
  and unknown client folders fail unless classified as a synthetic demo or
  template.

### Exit criteria

- **Met 2026-07-21.** The owner selected Option A; the decision record and a
  scanner regression guard prohibit legacy client references rather than
  relying on an exception.

## Phase 3 — Implement and verify the legacy-reference policy

**Status: complete**

### Goal

Apply the selected policy with the smallest safe change set and prove that the
public boundary behaves exactly as intended.

### Implemented Option A

- Removed legacy client-specific modules and their private-fixture test suites.
- Replaced reusable audit, packet, crawl, onboarding, live-target, and Notion
  test inputs with synthetic examples.
- Updated boundary docs and the client-packet guide to use generic examples.
- Removed the obsolete client-specific inventory classification; an obfuscated
  scanner rule now blocks the legacy identifier, and the scanner rejects any
  unclassified client folder.

### TDD / verification approach

- Add or update scanner tests before changing the relevant scanner rule or
  inventory classification.
- Add regression tests before renaming/removing code that supports audit or
  packet behavior.
- Run `npm test`, `npm run typecheck`, `npm run build`, and
  `npm run public:check` after each coherent change slice.

### Exit criteria

- **Met 2026-07-21.** Scanner findings match the generic policy and contain no
  unreviewed items; the staged public tree has only approved demo/template
  folders.
- **Met 2026-07-21.** Public docs no longer contain client-specific
  instructions.
- **Met 2026-07-21.** Synthetic regression coverage preserves connector
  snapshot/workflow validation, crawl-state resume behavior, onboarding
  blockers and caveats, and all audit prompt modes. The current verification
  set passed 59 core tests, 176 desktop tests, typechecks, production build,
  and `npm run public:check`.

## Phase 4 — Release-readiness handoff

**Status: complete — release workflow dispatched**

### Goal

Turn the passing rehearsal and boundary decision into a release-ready handoff.

### Tasks

- **Met 2026-07-21.** Ran every applicable local item in
  `docs/public-release-checklist.md`, including public tests, E2E, Megaphone
  smoke, and all Rust tests.
- **Met 2026-07-21.** Confirmed the workflow includes dependency install,
  tests, public boundary checks, signed Tauri build, updater manifest
  generation, deployment, and artifact upload; required secret names exist.
- **Met 2026-07-21.** Confirmed public docs describe registered Redline,
  Megaphone, and Pulse tools and Slate as planned.
- **Met 2026-07-21.** Recorded exact results, versions, boundary findings, and
  retained staged-bundle evidence in
  `docs/release-readiness-handoff-2026-07-21.md`.
- **Met 2026-07-21.** Reviewed the diff for scope and whitespace errors.

### Explicit non-actions

This phase does not automatically commit, tag, publish, deploy, or release
Workshop without an explicit user instruction. The user approved and initiated
that release flow on 2026-07-21; Workshop v0.1.27 was published successfully.

### Exit criteria

- **Met 2026-07-21.** The release checklist is complete with evidence.
- **Met 2026-07-21.** The project has a reviewed, release-ready baseline.
- **Met 2026-07-21.** The owner can approve a specific commit/release scope
  using the handoff, without unanswered local-boundary or verification
  questions.

## Product A — Registered-tool maintenance

**Status: ongoing; not a Phase 1–4 release blocker unless a tool contract changes**

| Tool | Public/runtime contract | Boundary rule |
| --- | --- | --- |
| Redline | Bundled `@redline/core` | Client packets remain in the selected private workspace. |
| Megaphone | Native `@megaphone/core/bridgeCli` adapter | Corpora and generated post packages remain private. |
| Pulse | Native bridge over a local SSH tunnel | Runner definitions, credentials, and state remain in Pulse’s private runner; Workshop keeps only session connection inputs in memory. |

Any change to these contracts requires a manifest test, affected tool tests, and
an updated private-workspace doc where behavior changes.

## Product B — Slate

**Status: ongoing; outside the public-release critical path**

Slate’s source, tests, and authoritative documentation live in the
[Slate repository](https://github.com/LindsayB610/slate). Workshop owns only
the generic Markdown host capabilities, package pin, promotion state, and the
external-view adapter.

- Keep private source content, paths, screenshots, and generated output out of
  both repositories.
- When Slate changes its exported plugin surface, update the pinned revision in
  Workshop and run the cross-repository integration tests.

## Product C — SEO review surface

**Status: deferred**

SEO Tools is not a standalone Workshop tool yet. Revisit it only after a shared
automation-output review surface has a product brief, a private-data contract,
and a test strategy.

## Completion rule

This plan is complete when Phases 1–4 have passed their exit criteria. At that
point Workshop is ready for an owner-approved public release; it is not
automatically released by completing this plan.
