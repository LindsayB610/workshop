# Adding A Workshop Tool

Workshop is a host app for focused tools. Each tool should live in its own
repository and own its data contracts, docs, tests, UI, and domain behavior.
Workshop owns only the desktop frame, promotion/install state, shared host
capabilities, and the plugin contract. Read
[the Workshop plugin host contract](workshop-plugin-contract.md) before adding
or migrating a tool.

## Tool Requirements

Every standalone tool package needs a declaration with:

- a unique `id`,
- display name and description,
- docs path,
- workspace requirements,
- install safety copy,
- route definitions,
- import and export actions,
- tests for its declared behavior and private-data boundary.

Workshop’s own registry adds host-only metadata such as the shelf icon, install
mode, and default-install choice. Do not make a tool package depend on that
metadata or import Workshop source to obtain it.

For a standalone tool, the declaration and view come from the tool package;
Workshop must not duplicate its routes, configuration schema, parsers, or
private-data assumptions. A temporary compatibility adapter is acceptable only
while a migration is in progress and should be removed with its local tool
implementation.

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
