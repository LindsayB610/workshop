# Client Onboarding Design

## Why Onboarding Matters

Randall Redline is strongest when the canonical messaging and GEO prompts are already high quality. Redline needs to solve the step before that: helping a consultant turn messy client context into a source-backed audit packet.

The audit engine should not be asked to infer the client's strategy from a website alone. It needs approved positioning, target prompts, buyer language, proof rules, objections, and "do not say this" boundaries.

## Target Outcome

For each client, onboarding should produce:

- Redline-compatible `prompts.yaml`
- approved canonical messaging blocks
- source snapshots and provenance
- proof / claim inventory
- objection map
- buyer-language map
- edit rules and anti-patterns
- audit readiness report
- recommended first audit targets

## Phase 3 Gate Status

The core onboarding contract now supports the Phase 3 gate:

- source intake items with trust, freshness, privacy, and review status
- approved canonical drafts with source references
- generated Redline-compatible prompts with weights, tags, rationale, and source references
- claim inventory with proof status and public-use approval
- readiness reports with blocked / caveated / ready states
- Redline-compatible `prompts.yaml` export

The richer guided desktop UX remains part of the Marketing Builds workbench phase.

## Onboarding Flow

1. Create client
2. Add source material
3. Classify source trust and privacy
4. Extract candidate canonical messaging
5. Review / approve canonical modules
6. Generate GEO target prompts
7. Build proof and claim inventory
8. Capture objections and comparison language
9. Validate readiness
10. Export audit packet

## Source Types

| Source | Initial support | Notes |
| --- | --- | --- |
| Local Markdown / text | Yes | Good first implementation target. |
| Notion pages | Yes, after adapter phase | Snapshot before audit use. |
| Website pages | Audit target first | Promote to context only with explicit trust label. |
| Call transcripts | Later | High value for buyer language. |
| Google Docs | Later | Useful for client drafts. |
| PDFs / decks | Later | Useful but extraction quality varies. |

## Trust And Usage Labels

Every source should carry:

- tier: source of truth, canonical, foundational, context, audit target
- trust level: trusted, provisional, foundational, unverified
- freshness: current, possibly stale, stale, unknown
- privacy: public-safe, internal-only, private-sensitive
- approval: approved, needs review, rejected, unknown
- owner or reviewer when known

## Readiness Levels

`ready_to_audit`

The packet has approved canonical messaging, prompts, proof governance, and at least one audit target.

`auditable_with_caveats`

The packet is good enough to run, but some areas must route to manual review or open questions.

`blocked`

The audit would likely produce misleading output because canonical messaging, proof rules, or source trust is missing.

## Product Principle

The onboarding UX should preserve uncertainty. If a proof point is private, stale, or unapproved, the system should carry that status forward into reports instead of turning it into confident public copy.
