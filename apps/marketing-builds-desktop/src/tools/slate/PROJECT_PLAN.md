# Slate project plan

## Purpose

Slate is a small, local-first Workshop tool for viewing two Markdown-based
inventories from the Guppi project:

1. **UC** — the primary view and the default tab.
2. **Chest Freezer Inventory** — the secondary tab.

Slate turns the source Markdown into clean, useful HTML without creating a
second copy of either inventory. The local Markdown files remain the source of
truth.

## Product scope

### Included

- A new Workshop tool named **Slate** in the shared tool shelf.
- Two tabs: **UC** and **Chest Freezer Inventory**.
- A polished UC list view with clear hierarchy and HTML formatting based on the
  actual Guppi conventions.
- A well-formatted freezer inventory view, tailored to its own source content.
- Local-only reading of the two approved Markdown files.
- Automatic refresh when either local file changes.
- A visible last-updated state and clear loading, missing-file, unreadable-file,
  and malformed-content states.
- Tests written before implementation where behavior can be specified.
- An iterative visual-review loop after the first usable UC rendering.

### Not included in the first release

- Editing either inventory from Slate.
- Cloud sync, uploads, accounts, sharing, or a remote copy of the inventories.
- General-purpose Markdown browsing beyond the two approved files.
- A mobile-specific interface or reporting/dashboard features.

## Product principles

- **Local source of truth:** Slate displays the current content of the local
  Guppi files and does not maintain competing inventory data.
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
- The two Guppi Markdown files remain in their existing local project and are
  the only inventory source of truth. Slate must not copy them into Workshop,
  `workshop-private`, cloud storage, or generated application state.
- `../workshop-private/slate/` is reserved only for a future local path
  configuration or non-source state if Phase 0 establishes that it is needed.
- Slate joins the Workshop roster as an approved tool, but registration waits for
  the Phase 0 source map and Phase 1 tests below.

## Local configuration and data-boundary contract

Before Slate is registered, define a versioned local-only configuration under
`../workshop-private/slate/`. It must contain only the two approved source-file
paths and any non-source local state; it must never contain copied inventory
content. The public repository may include an empty/example schema, but never a
filled-in configuration or real Guppi paths.

Slate must resolve and read only the two configured Markdown files. It must not
offer arbitrary file selection, directory browsing, recursive scans, uploads,
or fallback discovery. Path validation must reject traversal, missing paths,
directories, and any path outside the approved resolved source locations.

Public fixtures are sanitized structural examples only. Real Guppi text, local
paths, screenshots, snapshots, and generated render output must remain outside
the public repository. A public-boundary check must reject them if they appear
in source, tests, fixtures, snapshots, or built output.

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
  errors for the two source paths.
- Decide whether symlinked source paths are supported; if they are, resolve and
  validate their final locations before reading.

Deliverables:

- A concise source map: project location, instruction files, and two source
  files.
- A local configuration contract and public-safe example schema with no real
  Guppi path or inventory content.
- A rendering specification with example input and expected semantic HTML.
- A prioritized list of acceptance criteria.

Exit criteria:

- The two source files and their local locations are confirmed.
- The two approved paths, their validation behavior, and the no-copy boundary
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
- Define a public-boundary test that fails on Guppi-specific paths, real
  inventory text, screenshots, snapshots, and generated render output.
- Add tool-registration and tab-navigation tests.

Core test cases:

- UC headings and item groups render in the intended hierarchy.
- UC entries preserve useful labels, statuses, notes, and links.
- Freezer categories, items, quantities, and dates render predictably.
- Empty or incomplete Markdown produces a useful empty state.
- Missing, unreadable, and malformed files show actionable status copy.
- Only the two configured source files can be read; a rejected path never
  triggers a fallback search or bundled-inventory fallback.
- Changes to UC refresh the displayed UC content.
- Changes to freezer inventory refresh that tab’s content.
- Refresh is debounced to the agreed latency and preserves the last successful
  render through a temporary read failure.
- Slate opens on UC by default and tab selection behaves correctly after refresh.

Exit criteria:

- The test suite captures the agreed behavior and initially fails only because
  the implementation has not yet been added.

### Phase 2 — Local data bridge and refresh behavior

**Goal:** safely read the approved files and keep Slate synchronized with local
changes.

Tasks:

- Implement the smallest local file-access surface needed for the two explicit
  source paths.
- Validate and resolve the private Slate configuration before reading either
  file; return actionable configuration errors without reading any fallback.
- Read source content on Slate load.
- Watch or subscribe to changes for those files only.
- Refresh the relevant rendered content when a change is detected, using the
  agreed debounce latency.
- Surface last-updated time and loading/error states.

Acceptance criteria:

- Neither file is copied to a cloud service or persisted as separate inventory
  data.
- The bridge cannot read a path outside the two resolved, configured sources.
- Editing and saving either Markdown file updates Slate without restarting
  Workshop.
- A temporary read failure does not erase the last good render.

### Phase 3 — Slate shell and UC first pass

**Goal:** integrate the tool in Workshop and create the first reviewable UC
experience.

Tasks:

- Register Slate in Workshop with an appropriate shelf label, icon variant, and
  install metadata.
- Build the two-tab Slate view, with UC selected initially.
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

### Phase 5 — Validation and refinement

**Goal:** confirm the real desktop experience and complete a small polishing
pass based on evidence.

Tasks:

- Run the full automated test suite.
- Manually change both source files while Workshop is open.
- Verify refresh timing, tab selection, status states, and practical readability
  at normal Workshop window sizes.
- Test missing-file and recovery flows.
- Make any approved visual refinements, adding regression tests first when they
  change behavior.

Release criteria:

- All tests pass.
- Both inventories reflect local changes without a restart.
- UC is the default, polished primary experience.
- Errors are understandable and recover gracefully.

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

## Decisions to make during Phase 0

- Exact Guppi project path and source filenames.
- The formatting-instruction file(s) that define the Markdown conventions.
- Whether source paths are fixed in the tool or configured during setup.
- Which UC fields or markers deserve badges, grouping, or emphasis.
- Whether the freezer inventory has quantities, dates, categories, or statuses
  that should receive dedicated UI treatment.
- The acceptable refresh latency and how Slate should communicate an in-progress
  reload.
- The local configuration filename, version, fields, and whether symlinks are
  supported.

## Definition of done

Slate is complete for its first release when Workshop provides a polished,
local-only two-tab viewer; UC opens first; each tab accurately renders its
corresponding local Markdown inventory; edits appear automatically; failure
states are clear; and the rendering and refresh behavior are protected by an
appropriate automated test suite.
