# Contributing

Workshop is the public app shell for installing and launching marketing-build
tools. Contributions should keep the app shell separate from tool-specific
private data.

Before opening a pull request:

1. Run `npm test`.
2. Run `npm run typecheck`.
3. Run `npm run public:check`.
4. Confirm new tools install through the Add New Tools flow instead of being
   installed by default.
5. Keep real client packets, corpora, source snapshots, reports, generated
   outputs, local absolute paths, and credentials out of the repo.

Workshop should not carry Redline-specific attribution or claims. Tool-specific
license and attribution notes belong in the relevant tool repo.
