# Adding A Workshop Tool

Workshop is a host app for focused Marketing Builds tools. Each tool should own
its data contracts, docs, tests, and UI routes without leaking assumptions into
other tools.

## Tool Requirements

Every tool needs:

- a unique `id`,
- display name and description,
- logo variant,
- docs path,
- workspace requirements,
- install safety copy,
- route definitions,
- import and export actions,
- tests for registry behavior.

## Data Boundaries

Do not share private data roots across tools. A tool may read its selected local
workspace, but it should not scan unrelated client folders or other tools'
corpora.

Use these rules:

- demo data belongs under a clearly named demo folder,
- templates must contain placeholders only,
- real user data belongs outside the public repo,
- generated output should stay local unless sanitized,
- credentials must never be committed.

## Docs

Add:

- a packaged docs page under `apps/marketing-builds-desktop/public/docs/tools/`,
- a deeper guide under `docs/` when users need to build a corpus or packet,
- README links when the workflow is part of public setup.

## Tests

Add tests for:

- registry metadata,
- route screen switching,
- install/disable behavior,
- workspace validation,
- import and export guards,
- privacy scanner classification,
- public docs links.

## Public Release Check

Before a new tool is considered public-ready:

- `npm test` passes,
- `npm run typecheck` passes,
- `npm run build` passes,
- Playwright covers the core UI route,
- privacy scan has no unreviewed private findings,
- templates parse,
- docs explain how a new user builds their own local context.
