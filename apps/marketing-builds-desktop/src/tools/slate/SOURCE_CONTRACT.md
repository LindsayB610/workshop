# Slate source and rendering contract

## Private configuration

Slate's initial selected private root directory is:

```text
../workshop-private/slate/
```

Workshop passes the selected private Slate root to the native bridge, which
reads only `slate.config.json` directly beneath that root. The file has this
exact version-one shape:

```json
{
  "version": 1,
  "ucPath": "/absolute/path/to/uc.md",
  "freezerPath": "/absolute/path/to/freezer-storage.md"
}
```

`ucPath` and `freezerPath` must each be non-empty absolute paths to regular
Markdown files. The paths must be distinct. Version one does not support
symlinked source files or directories.

Slate must reject the configuration without reading a source when any of these
conditions apply:

- the configuration is missing, malformed, or has an unsupported version;
- either path is missing, relative, duplicated, or does not end in `.md`;
- either path does not exist, is not a regular file, or is a symlink;
- a source cannot be read as UTF-8 text.

The bridge may read only these two validated paths. It must not perform
directory browsing, globbing, fallback discovery, remote synchronization, or
source-file writes.

## Refresh contract

Slate watches the minimum parent directories necessary to survive an editor's
atomic-save rename behavior, then filters every event to the source file whose
own parent directory produced it. A directory event must never authorize a
directory scan or a read of a neighboring file.

A matching source change from the currently selected private root schedules a reload after a **provisional 300 ms**
debounce window. Phase 1 treats that value as its test baseline; Phase 5 may
adjust it after live validation. A successful reload reads and replaces only
the changed tab's data and updates its timestamp. A failed reload retains the last
successful render for that tab and displays its current error state.

## UC rendering contract

UC is a hierarchical Markdown ledger. Its headings define the structure in the
source; Slate does not impose a fixed taxonomy or reject unexpected heading
levels.

| Source pattern | Slate output |
| --- | --- |
| Top-level heading (`#`) | A top-level source section beneath Slate's stable UC page title. |
| Nested headings (`##` through `######`) | Nested semantic sections with a visible hierarchy. |
| Unordered or ordered lists | Task rows that preserve nesting and order. |
| Paragraph text under a section | Supporting context, visually secondary to task rows. |
| Strong text, emphasis, inline code, and links | Safe semantic inline HTML. Only safe external link protocols become links. |
| Empty section | Visible section heading with an intentional empty state only when the source contains it. |

Raw HTML in Markdown is rendered as text, never injected into the application.
Unsafe link protocols are rendered as inert text. Slate does not infer
completion, priority, dates, or status that is absent from the source.

## Freezer rendering contract

The freezer source contains one `Storage Table`. Slate renders it as an HTML
table with header cells and the fixed visible columns below.

| Source column | Display treatment |
| --- | --- |
| Item | Primary inventory label. |
| Count | Quantity text; preserve the source wording. |
| Weight | Secondary quantity text; retain an empty value as an em dash. |
| Date Stored | Human-readable date when the cell is a valid ISO date; otherwise preserve the source text. |
| Storage | A restrained inside/outside location label; preserve any unfamiliar source value as text. |

Rows stay in source order. Slate does not merge similar items, calculate totals,
or modify inventory values. Missing or malformed table structure results in a
clear tab-specific error instead of a guessed inventory.

## Phase 1 acceptance targets

The first tests must cover the configuration failures, the provisional 300 ms
refresh behavior, atomic-save file replacement, event filtering, raw-HTML and
unsafe-link escaping, UC hierarchy and nested lists, freezer headers and empty
cells, malformed-table errors, and preservation of a last successful render
after a read failure.
