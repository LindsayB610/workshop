# Slate project plan

## At a glance

| Phase | Focus | Status |
| --- | --- | --- |
| 0 — Discovery and rendering contract | Locate the three Guppi sources, define the local configuration, and agree the rendering rules. | Complete |
| 1 — Test foundation | Specify path-boundary, parsing, rendering, refresh, and navigation behavior through tests. | Complete — red baseline |
| 2 — Local data bridge and refresh | Read only the approved files and refresh Slate when they change. | Complete |
| 3 — Slate shell and UC first pass | Register the tool and build the default UC experience. | Complete |
| 4 — Freezer view | Add the Chest Freezer Inventory view and its content-specific formatting. | Complete |
| 5 — Validation and refinement | Verify real local changes, failure recovery, accessibility, and polish. | Complete |

## Purpose

Slate is a small, local-first Workshop tool for viewing three Markdown-based
reference sources from the Guppi project:

1. **UC** — the primary reference view.
2. **Chest Freezer Inventory** — the inventory table.
3. **Opportunities** — the opportunity tracking table.

Slate turns the source Markdown into clean, useful HTML without creating a
second copy of either inventory. It displays the approved local files only:
UC is GUPPI's active local operational ledger, and freezer storage is its local
working copy.

## Product scope

### Included

- A new Workshop tool named **Slate** in the shared tool shelf.
- A Slate home view with **UC**, **Chest Freezer Inventory**, and **Opportunities** choices.
- Chrome-style top-level source tabs within the UC view.
- A polished UC list view with clear hierarchy and HTML formatting based on the
  actual Guppi conventions.
- A well-formatted freezer inventory view, tailored to its own source content.
- Local-only reading of the three approved Markdown files.
- Automatic refresh when any local source file changes.
- A visible last-updated state and clear loading, missing-file, unreadable-file,
  and malformed-content states.
- Tests written before implementation where behavior can be specified.
- An iterative visual-review loop after the first usable UC rendering.

### Not included in the first release

- Editing either inventory from Slate.
- Cloud sync, uploads, accounts, sharing, or a remote copy of the inventories.
- General-purpose Markdown browsing beyond the three approved files.
- A mobile-specific interface or reporting/dashboard features.

## Product principles

- **Local display inputs:** Slate displays the current content of the three
  approved local Guppi files and does not maintain competing inventory data.
- **UC first:** UC opens by default and receives the more considered visual
  treatment.
- **Always current:** a source-file change is reflected without restarting
  Workshop.
- **Purposeful formatting:** HTML emphasizes scanability and useful structure;
  it should not merely reproduce raw Markdown styling.
- **Safe failure:** Slate explains when a file cannot be found or read without
  losing the last successfully rendered view unnecessarily.
- **Iterate from real content:** the Guppi formatting instructions and the
  actual Markdown files determine the rendering rules; visual details will be
  refined through review rather than guessed in advance.

## Workspace integration

- Slate's canonical public source, Workshop tool id, and directory are all
  `slate`.
- The three Guppi Markdown files remain in their existing local project and are
  Slate's only approved display inputs. Slate must not copy them into Workshop,
  `workshop-private`, cloud storage, or generated application state. UC is
  locally authoritative within GUPPI; freezer storage's remote canonical state
  remains outside Slate's scope.
- `../workshop-private/slate/` is reserved only for a future local path
  configuration or non-source state if Phase 0 establishes that it is needed.
- Slate joins the Workshop roster as an approved tool, but registration waits for
  the Phase 0 source map and Phase 1 tests below.

## Local configuration and data-boundary contract

Before Slate is registered, define a versioned local-only configuration under
`../workshop-private/slate/`. It must contain only the three approved source-file
paths and any non-source local state; it must never contain copied inventory
content. The public repository may include an empty/example schema, but never a
filled-in configuration or real Guppi paths.

Slate must resolve and read only the three configured Markdown files. It must not
offer arbitrary file selection, directory browsing, recursive scans, uploads,
or fallback discovery. Path validation must reject traversal, missing paths,
directories, and any path outside the approved resolved source locations.

Public fixtures are sanitized structural examples only. Real Guppi text, local
paths, screenshots, snapshots, and generated render output must remain outside
the public repository. A public-boundary check must reject them if they appear
in source, tests, fixtures, snapshots, or built output.

## Phase 0 source record

The approved source types are now confirmed:

- **UC:** a local Markdown task ledger with nested headings, unordered lists,
  ordered lists, inline emphasis, and occasional links. Slate must preserve the
  source hierarchy rather than infer a fixed set of headings from the UC spec.
- **Chest Freezer Inventory:** a local Markdown document containing one
  `Storage Table` with the fixed columns `Item`, `Count`, `Weight`, `Date
  Stored`, and `Storage`. Slate must render that table semantically and retain
  blank cells as intentionally unspecified values.
- **Opportunities:** a local Markdown document containing one `Opportunity Table`
  with fixed tracking columns. Slate must preserve its source order and render it
  as a read-only semantic table.

The private configuration is `slate.config.json` in the private Slate root. It
uses `version: 2` and exactly three absolute Markdown-file paths: `ucPath`,
`freezerPath`, and `opportunitiesPath`. The checked-in example below is structural only; the filled-in
local configuration is never part of the Workshop repository.

Phase 0 does not authorize a remote read, GitHub synchronization, source-file
write, or bundled fallback. Slate reads the configured local files only.

## Phased delivery plan

### Phase 0 — Discovery and rendering contract

**Goal:** establish the actual local inputs and define a testable rendering
contract before building the tool.

Tasks:

- Locate the Guppi project, its formatting instructions, and the exact UC and
  freezer Markdown paths.
- Read the relevant instructions and inspect representative source content.
- Identify supported Markdown patterns: headings, ordered or unordered lists,
  checkboxes, status markers, tables, quantities, dates, notes, and links.
- Decide which formatting rules are shared and which are specific to each tab.
- Record agreed path configuration and file-access boundaries.
- Define the local configuration filename, version, schema, and validation
  errors for the three source paths.
- Decide whether symlinked source paths are supported; if they are, resolve and
  validate their final locations before reading.

Deliverables:

- A concise source map: project location, instruction files, and three source
  files.
- A local configuration contract and public-safe example schema with no real
  Guppi path or inventory content.
- A rendering specification with example input and expected semantic HTML.
- A prioritized list of acceptance criteria.

Exit criteria:

- The three source files and their local locations are confirmed.
- The three approved paths, their validation behavior, and the no-copy boundary
  are documented.
- Rendering rules can be expressed as automated tests.

### Phase 1 — Test foundation

**Goal:** create fast, focused tests before the feature implementation.

Tasks:

- Add fixtures representing real, sanitized Markdown structures from UC and
  the freezer inventory.
- Write unit tests for parsing and semantic rendering before writing the
  corresponding renderer.
- Write tests for source path validation and file-read error states.
- Write tests proving Slate rejects arbitrary paths, traversal, directories,
  unapproved resolved paths, and unsupported symlink targets.
- Define behavior tests for file-change refreshes, including retaining the last
  successful view if a refresh temporarily fails.
- Define behavior tests for an editor's atomic-save rename flow and ensure the
  watcher reloads only the three configured paths.
- Define rendering tests that reject unsafe Markdown link protocols.
- Define a public-boundary test that fails on Guppi-specific paths, real
  inventory text, screenshots, snapshots, and generated render output.
- Add tool-registration and tab-navigation tests.

Core test cases:

- UC headings and item groups render in the intended hierarchy.
- UC entries preserve useful labels, statuses, notes, and links.
- Freezer categories, items, quantities, and dates render predictably.
- Empty or incomplete Markdown produces a useful empty state.
- Missing, unreadable, and malformed files show actionable status copy.
- Only the three configured source files can be read; a rejected path never
  triggers a fallback search or bundled-inventory fallback.
- Changes to UC refresh the displayed UC content.
- Changes to freezer inventory refresh that tab’s content.
- Refresh is debounced to the agreed latency and preserves the last successful
  render through a temporary read failure.
- An atomic file replacement refreshes the configured source without allowing a
  neighboring file to be read.
- Unsafe link protocols are rendered as inert text rather than live links.
- Slate opens on UC by default and tab selection behaves correctly after refresh.

Exit criteria:

- The test suite captures the agreed behavior and initially fails only because
  the implementation has not yet been added.

Phase 1 result:

- Sanitized UC and freezer fixtures cover the agreed source structures without
  including GUPPI data.
- `slateModel.test.ts` defines the configuration, source-validation, UC, link,
  and freezer acceptance tests.
- `slateRefresh.test.ts` defines the approved-path and atomic-save refresh
  behavior.
- `slatePublicBoundary.test.ts` guards Slate's checked-in fixtures and example
  configuration against a personal local path.
- The initial targeted run is intentionally red until Phases 2–4 replace the
  typed throwing seams with production behavior.

### Phase 2 — Local data bridge and refresh behavior

**Goal:** safely read the approved files and keep Slate synchronized with local
changes.

Tasks:

- Implement the smallest local file-access surface needed for the three explicit
  source paths.
- Validate and resolve the private Slate configuration before reading either
  file; return actionable configuration errors without reading any fallback.
- Read source content on Slate load.
- Watch or subscribe to changes for those files only.
- Refresh the relevant rendered content when a change is detected, using the
  agreed debounce latency.
- Provide last-updated timestamps and loading/error data for the Phase 3 view
  to surface.

Acceptance criteria:

- No source file is copied to a cloud service or persisted as separate inventory
  data.
- The bridge cannot read a path outside the two resolved, configured sources.
- Editing and saving any configured Markdown file updates Slate without restarting
  Workshop.
- A temporary read failure does not erase the last good render.

Phase 2 result:

- The native bridge reads only `slate.config.json` under the selected private
  Slate root and then only its three validated, distinct Markdown paths.
- It rejects malformed configuration, traversal, symlinks, directories,
  non-Markdown files, and unreadable sources before returning content.
- The bridge returns source timestamps and starts a non-recursive watcher on
  only the necessary parent directories. Events are filtered to the three exact
  approved paths before `slate://source-changed` is emitted.
- The TypeScript bridge exposes the native read and watch commands, while the
  source model implements the 100 ms scheduling and last-good
  render recovery behavior.
- Phase 3 owns the visible timestamp, loading, and error presentation; Phase 2
  supplies the data and recovery contract without rendering UI.

### Phase 3 — Slate shell and UC first pass

**Goal:** integrate the tool in Workshop and create the first reviewable UC
experience.

Tasks:

- Register Slate in Workshop with an appropriate shelf label, icon variant, and
  install metadata.
- Build Slate’s source home view and its UC section tabs.
- Implement the UC renderer against the tests from Phase 1.
- Present UC as a clean, scan-friendly HTML list with semantic sections and
  restrained visual hierarchy.
- Add accessible keyboard and screen-reader behavior for tabs and status
  messages.

Review checkpoint:

- Review the live UC view against real content.
- Decide what should be more prominent, collapsed, grouped, labeled, or
  visually quieter.
- Capture any newly discovered Guppi formatting conventions as tests before
  making the next rendering adjustment.

Exit criteria:

- UC is useful as a daily local view and passes all agreed automated tests.

Phase 3 result:

- Slate is registered as a ready bundled Workshop tool and installs by default.
- UC is available from Slate’s source home view and has its own top-level section tabs.
- The UC renderer preserves the local heading hierarchy, paragraphs, nested
  task lists, and safe inline formatting while escaping raw HTML and unsafe
  link protocols.
- The view reads through the native bridge, starts the local watcher, reloads
  after the 100 ms debounce, and displays timestamps, loading, and error states.
- The freezer route remains visibly present but intentionally defers its table
  renderer to Phase 4.

### Phase 4 — Freezer view

**Goal:** add a fitting, equally reliable view for the freezer inventory.

Tasks:

- Implement the freezer renderer against its test fixtures.
- Use the actual source structure to choose readable item grouping and quantity
  treatment.
- Ensure it shares Slate’s refresh, timestamp, and error behavior while allowing
  content-specific formatting.

Exit criteria:

- The freezer tab reflects its local Markdown file accurately and refreshes on
  change.

Phase 4 result:

- The freezer source now renders as a semantic, horizontally scrollable table
  with its five configured columns.
- Empty weight and date values display as em dashes, valid ISO dates are made
  readable, and unfamiliar source text remains intact.
- Missing, empty, and malformed Storage Table states remain visible and do not
  affect UC's independently refreshed view.

### Phase 5 — Validation and refinement

**Goal:** confirm the real desktop experience and complete a small polishing
pass based on evidence.

Tasks:

- Run the full automated test suite.
- Manually change each configured source file while Workshop is open.
- Verify refresh timing, tab selection, status states, and practical readability
  at normal Workshop window sizes.
- Test missing-file and recovery flows.
- Make any approved visual refinements, adding regression tests first when they
  change behavior.

Release criteria:

- All tests pass.
- All three source views reflect local changes without a restart.
- UC is the default, polished primary experience.
- Errors are understandable and recover gracefully.

Phase 5 progress:

- The complete desktop unit, integration, public-boundary, and browser suites
  pass. The Slate-specific suite covers source isolation, rename events,
  debounce behavior, recovery state, malformed tables, and rendered empty
  states.
- The three configured local files were verified through the local preview. Live
  source saves repeatedly refreshed Slate during review.
- The Opportunities source was temporarily made unavailable through the local
  preview, returned the controlled error response, and recovered immediately
  after restoration. The component’s retained-last-good-view behavior remains
  protected by the targeted automated suite.

## TDD working agreement

TDD applies wherever the expected behavior is deterministic:

1. Write a failing test for a Markdown convention, data state, navigation
   behavior, or refresh condition.
2. Implement the smallest change that makes the test pass.
3. Refactor only with the suite green.
4. Add a regression test before fixing any discovered defect.

Visual decisions that cannot be meaningfully asserted by tests will be checked
with a live review of real UC and freezer content. Any resulting rule that can
be stated deterministically becomes a test for future protection.

## Phase 0 decisions

- The exact Guppi source paths are held only in the private Slate configuration.
- `docs/specs/UC_SPEC.md` supplies UC's structural guidance; the current local
  Markdown files supply the actual display structure.
- Source paths are configured in the private `slate.config.json`, not fixed in
  public source code.
- UC's first pass preserves the source hierarchy and does not invent badges or
  statuses.
- Freezer storage receives dedicated semantic table treatment for its item,
  count, weight, date-stored, and storage columns.
- Auto-refresh uses a 100 ms debounce baseline and a visible per-tab
  loading or error state.
- The version-two configuration has `ucPath`, `freezerPath`, and `opportunitiesPath` fields; source
  symlinks are unsupported.

## Definition of done

Slate is complete for its first release when Workshop provides a polished,
local-only three-source viewer; UC, freezer, and opportunities accurately
render their corresponding local Markdown sources; edits appear automatically;
failure states are clear; and the rendering and refresh behavior are protected
by an appropriate automated test suite.
