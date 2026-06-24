# Troubleshooting Public Workspaces

Use this guide when a demo packet works but your private local workspace does
not.

## Not Enough Source Material

Symptoms:

- canonical modules are empty,
- source readiness is missing or partial,
- audit findings feel generic,
- Megaphone cannot retrieve useful examples.

Fix:

- add approved positioning and buyer-language notes,
- add proof and claim rules,
- add objections,
- capture the date and owner for every source,
- mark weak sources provisional instead of pretending they are approved.

## Stale Sources

Symptoms:

- old language keeps winning over newer direction,
- proof claims conflict,
- source freshness warnings appear.

Fix:

- update `source-manifest.json`,
- mark stale material `stale` or `rejected`,
- add a newer canonical module,
- keep old snapshots for history but stop treating them as source truth.

## Proof Gaps

Symptoms:

- Redline routes findings to proof review,
- edit briefs say not to strengthen a claim,
- Megaphone avoids a metric or comparison.

Fix:

- add approved proof,
- record the proof owner,
- define allowed public wording,
- soften the claim until proof exists.

## Missing Examples

Symptoms:

- Megaphone says no client-local example corpus is imported,
- post packages use fallback guidance,
- adjacent-example retrieval has nothing useful to draw from.

Fix:

- add a small set of scored examples,
- label examples by post type,
- include adaptation-safety labels,
- keep unsafe examples as `internal_reference` or `do_not_use`.

## Unsafe Claims

Symptoms:

- generated copy sounds too strong,
- proof policy blocks public use,
- claims imply guarantees or unsupported outcomes.

Fix:

- add a claims policy,
- mark claim categories,
- use qualitative wording until proof is approved,
- keep absolute guarantees out of drafts.

## Local Workspace Not Found

Symptoms:

- Workshop can open demo data but not your private workspace,
- exported files point to the wrong folder.

Fix:

- keep the private workspace outside the repo,
- make sure `client.yaml` and `source-manifest.json` are at the client root,
- use lowercase hyphenated client IDs,
- avoid nested client folders inside another client folder.
