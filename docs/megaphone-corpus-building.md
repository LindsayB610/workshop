# Building a Megaphone Corpus

Megaphone turns a source-backed corpus into campaign briefs, drafts, calendar
ideas, measurement notes, and post packages. A corpus should live in a private
local workspace unless it is intentionally sanitized demo data.

Start from `clients/template-megaphone/` and copy it to a private folder:

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
    icp.md
    positioning.md
    buyer-language.md
    proof-library.md
    objections.md
    content-priorities.md
  linkedin/
    strategy.yaml
    post-pillars.yaml
    claims-policy.yaml
    post-type-taxonomy.yaml
    measurement-plan.yaml
    voice-guidance.md
    do-not-say.md
  corpus/
    examples/
  sources/
    local/
    linkedin-research/
  post-packages/
  onboarding/
```

## Source Collection

Collect sources before collecting examples. The corpus needs to know what the
client is trying to say before it can judge which examples are useful.

Useful source classes:

- approved positioning,
- ideal-customer notes,
- buyer-language excerpts,
- proof and claim rules,
- objection notes,
- content pillars,
- prior campaign learnings,
- audience research,
- examples that are safe to adapt.

Each source should have a stable ID, path, owner, review status, privacy status,
and freshness status.

## Buyer-Language Extraction

Extract phrases that describe real buyer problems, not generic marketing copy.

Good buyer language:

- names a job, tension, risk, or decision point,
- uses language a buyer might actually say,
- avoids unapproved customer details,
- keeps context attached to the source.

Bad buyer language:

- turns a source into a slogan too early,
- invents urgency,
- copies private comments into public examples,
- strips away who said it and why it mattered.

## Proof Library

The proof library is where Megaphone learns what claims can be made safely.
Separate claims into:

- approved public proof,
- internal-only evidence,
- provisional claims needing review,
- blocked claims.

For every metric or comparison, record the approval owner, source ID, date, and
allowed wording. If that metadata is missing, treat the claim as unsafe for
public drafting.

## Objections

Objections help Megaphone avoid cheerful but empty posts. Capture:

- why a buyer might not believe the claim,
- what they tried before,
- what risk they are protecting against,
- which proof would make the claim credible.

## Content Pillars

Use a small set of pillars. Each pillar should connect an audience, a recurring
problem, a source-backed point of view, and a proof boundary.

Example pillars:

- operational visibility,
- customer handoff quality,
- proof-aware workflow claims.

## Post-Type Taxonomy

Define post types before generating packages. At minimum, give each post type:

- `id`,
- purpose,
- allowed source types,
- allowed proof risk,
- preferred format,
- adjacent post types that may provide examples.

Common post types:

- `evaluation_guide`,
- `visual_explainer`,
- `proof_note`,
- `objection_handler`,
- `launch_update`.

## Example Selection And Scoring

Examples should teach structure, not copy voice blindly.

Score examples on:

- relevance to the audience,
- fit with the post type,
- clarity of the opening,
- evidence quality,
- usefulness of the format,
- whether the example is safe to adapt.

Keep examples out if they include private client details, personal data,
unapproved customer quotes, or claims that cannot be supported.

## Safe-To-Adapt Labels

Use these classifications:

- `safe_to_adapt`: structure and framing can be reused.
- `structure_only`: useful format, but wording should not be copied.
- `internal_reference`: useful for strategy, not public drafting.
- `do_not_use`: retain for history only.

Megaphone should prefer `safe_to_adapt` and `structure_only` examples.

## Example Metadata Fields

For every example, capture:

- `id`,
- `clientId`,
- `postType`,
- `sourceRefs`,
- `audience`,
- `contentPillar`,
- `proofRisk`,
- `adaptationSafety`,
- `freshness`,
- `notes`.

The example body can live beside metadata, but metadata should be enough to
filter examples before any drafting begins.

## Freshness And Maintenance

Review the corpus on a schedule. Mark old examples as stale when strategy,
positioning, market category, proof, or audience assumptions change.

Maintained examples can remain useful. Unmaintained examples should lose trust
over time.

## Local AI Credentials

Keep AI credentials out of the corpus and out of git.

Use local secure storage or environment variables managed outside the repo.
Never commit:

- API keys,
- `.env` files,
- model-provider tokens,
- update signing keys,
- copied credential screenshots.

The public template may mention credential setup, but it must not include real
values.

## Validation Workflow

1. Copy `clients/template-megaphone/` to a private workspace.
2. Fill in `client.yaml`.
3. Add canonical modules and LinkedIn strategy files.
4. Add source snapshots.
5. Create `source-manifest.json`.
6. Add a small, scored example set.
7. Generate a post package from the demo corpus first.
8. Generate from the private corpus only after proof and safety labels are in
   place.
