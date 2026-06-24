# fixture run-2026-06-20 - Edit Brief

Client: fixture
Run: run-2026-06-20
Generated: 2026-06-20T12:00:00.000Z

## Guardrails

- This brief prepares Codex-assisted rewriting only.
- Do not automatically edit or publish page content from this brief.
- Rewrite only the locator text shown for approved rewrite instructions.
- Keep manual-review and proof-gated items out of rewrite drafts until resolved.

## Targets

- homepage: https://example.test/

## Rewrite Instructions

### Hero misses the ICP
- Finding ID: finding-ready
- Target: homepage
- URL: https://example.test/
- Locator text: "Build faster AI."
- Instruction: Rewrite the hero around production inference teams.
- Rationale: The hero does not name the production buyer or workload.
- Sources: source-positioning
- Proof needed: Confirm final ICP language.

## Manual Review

### Speed claim needs proof
- Finding ID: finding-proof
- Target: homepage
- URL: https://example.test/
- Locator text: "Fastest inference."
- Instruction: Do not rewrite automatically. Review this finding first: Attach proof or soften the claim.
- Rationale: The claim needs approved public evidence before rewriting.
- Sources: source-proof-library
- Proof needed: Approved benchmark and public-use permission.
- Claim category: metric
- Approval status: needs_client_approval
- Proof owner: Client proof owner
- Can agent edit: false
- Agent instruction: Needs client proof approval. Do not repeat or strengthen the metric.
- Risk reason: Claim approval is needs_client_approval.

### Use-case phrasing may be too broad
- Finding ID: finding-uncertain
- Target: homepage
- URL: https://example.test/
- Locator text: "Every AI workflow."
- Instruction: Do not rewrite automatically. Review this finding first: Consider replacing with narrower workload language.
- Rationale: The finding is useful but needs stronger buyer evidence.
- Sources: source-buyer-language
- Proof needed: Confirm top public-safe workload examples.
- Risk reason: Finding confidence is medium.

## Public Claim Flags

- claim-fastest: "Fastest inference."
  Claim category: metric.
  Proof status: weak_proof; public-use approved: false.
  Approval status: needs_client_approval.
  Proof owner: Client proof owner.
  Can agent edit: false.
  Notes: Needs substantiation before public copy.

## Proof Gate Summary

- finding-proof: Needs client proof approval. Do not repeat or strengthen the metric. (owner: Client proof owner; canAgentEdit: false)
