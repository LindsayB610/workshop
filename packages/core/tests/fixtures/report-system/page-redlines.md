# Fixture Audit - Page Redlines

## Targets

- homepage: https://example.test/
- pricing: https://example.test/pricing

## Findings

### HIGH: Hero claim needs proof
**Finding ID:** finding-high
**Target:** homepage
**Mode:** proof_gap
**Confidence:** high
**Edit readiness:** open_question
**Quoted text:**
> Old hero claim.
**Issue:** The hero makes a claim that needs approved proof.
**Suggested fix:** Replace the claim or attach approved evidence.
**Sources:** source-proof-library
**Proof needed:** Approved public proof for the hero claim.
**Claim category:** metric
**Approval status:** needs_client_approval
**Proof owner:** Client proof owner
**Can agent edit:** false
**Agent instruction:** Needs client proof approval. Do not repeat or strengthen the metric.

---

### LOW: Pricing language is generic
**Finding ID:** finding-low
**Target:** pricing
**Mode:** buyer_language
**Confidence:** medium
**Edit readiness:** ready
**Quoted text:**
> Simple pricing for every team.
**Issue:** The pricing page does not reflect buyer-specific triggers.
**Suggested fix:** Anchor pricing copy to workload urgency and approval paths.
**Sources:** source-buyer-language
**Proof needed:** Confirm pricing proof with sales.
