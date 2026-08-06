# Workshop Theme Preferences Plan

## Purpose

Add a Workshop-owned appearance system that every installed app inherits. Users
open it through **Workshop → Preferences…**, choose a color mode and a bundled
theme, or create a small custom palette with hex values. Themes are local UI
preferences: they never enter a tool workspace, private app configuration, or
Git-tracked user data.

## Product boundary

Workshop owns:

- the native **Preferences…** menu entry and preferences surface;
- color-mode selection, bundled themes, validation, persistence, and CSS-token
  application;
- accessibility guardrails and the plugin theme contract.

An app owns its domain-specific presentation. It inherits Workshop tokens for
canvas, controls, text, borders, focus, and shared chrome, but may retain its
own semantic visualization colors where necessary.

Theme inheritance is progressive enhancement. A new or existing app can run
inside Workshop before it adopts host tokens, and it can run standalone without
Workshop. Workshop must never treat missing theme-token support as a failed
capability or block an app from loading.

## Decisions for version one

- Preferences has three sections: **Appearance**, **Updates**, and **About**.
  Appearance is the only section implemented in this feature; the other two
  are reserved navigation slots, not placeholder product work.
- The Appearance screen offers **System**, **Dark**, and **Light** modes.
- Ship six curated presets: Workshop, Lagoon, Evergreen, Aubergine, Ember, and
  Indigo. The existing Workshop black/pink/yellow presentation is the Workshop
  preset and default.
- A custom palette accepts exactly four colors: canvas, surface, primary
  accent, and warm accent. Text, muted text, borders, focus rings, and semantic
  success/warning/danger values are derived or remain protected host tokens.
- The custom editor uses native color inputs plus validated hex fields. It does
  not need a third-party color-picker library.
- Use Radix primitives already appropriate to the React app: `Dialog`, `Tabs`,
  `RadioGroup`, `Switch`, and `Tooltip`. Add only the Radix packages required
  by the implementation.
- Store the versioned preference in local application UI storage under
  `workshop.appearance.v1`. Do not sync, export, or share custom themes in
  version one.
- Theme tokens are optional for plugins in version one. Apps adopt them on
  their own schedules by supplying CSS fallbacks, for example
  `var(--workshop-surface, #111111)`. Workshop will not require a plugin
  manifest version bump, a new capability, or a theme-acknowledgement field.

## TDD rules

For every phase, write the failing test first, make the smallest change that
passes it, then refactor only while the relevant suite remains green. Tests
must assert observable behavior or a stable public contract—not CSS class names
unless a selector itself is the contract.

Run the focused test file after each red/green/refactor loop. At each phase
gate, run `npm test`, `npm run typecheck`, and the applicable desktop/Rust
tests. Before release, also run `npm run build` and `npm run public:check`.

## Phases at a glance

| Phase | Status | Outcome | TDD gate |
| --- | --- | --- | --- |
| 0 | Planned | Lock the token and preference contracts | Model tests written before provider code |
| 1 | Planned | Apply a persisted host theme to Workshop | Provider/storage tests pass |
| 2 | Planned | Open Preferences from the native Workshop menu | Native-event and dialog tests pass |
| 3 | Planned | Ship accessible preset selection and preview | Interaction and contrast tests pass |
| 4 | Planned | Add safe custom hex palettes | Validation, persistence, and reset tests pass |
| 5 | Planned | Make external apps inherit tokens and publish the app-builder guidance | Slate/Pulse contract and documentation-example tests pass |
| 6 | Planned | Document, audit, and release | Full suite and public-boundary checks pass |

## Phase 0 — Contract and token inventory

### Build

1. Inventory every current Workshop color token and hardcoded shared-chrome
   color in `src/styles/app.css`.
2. Define a typed `ThemeDefinition`, `ThemePreference`, color-mode type, and a
   stable semantic token list:

   ```text
   canvas, surface, surfaceRaised, border, text, textMuted,
   accent, accentStrong, accentWarm, focusRing,
   success, warning, danger
   ```

3. Put bundled themes in a pure data module. Keep color derivation and contrast
   calculation in pure functions separate from React and local storage.

### Tests first

- A default preference resolves to the existing Workshop preset and system
  color mode.
- Every bundled theme supplies every required token.
- Invalid/missing stored preferences resolve safely to the default.
- Custom-palette derivation produces the full token set without mutating input.
- Contrast helpers correctly accept and reject known WCAG examples.

### Exit criteria

- No UI changes yet.
- Theme model tests describe the durable host contract.

## Phase 1 — Theme provider and local persistence

### Build

1. Add a `ThemeProvider` near the application root.
2. Resolve system mode with `matchMedia`, apply the selected semantic variables
   to the Workshop root element, and set a mode/theme data attribute for
   non-color styling.
3. Persist only the validated versioned preference in local storage.
4. Replace shared Workshop shell colors with semantic variables, keeping the
   current appearance visually unchanged under the default theme.

### Tests first

- Default rendering applies Workshop tokens without a stored preference.
- A saved preset is restored on a new provider instance.
- System mode reacts to a simulated OS color-mode change.
- Invalid stored JSON neither crashes the app nor writes private data.
- The default theme visual-token snapshot matches the current intended palette.

### Exit criteria

- Changing the in-memory preference updates the root variables.
- Restarting Workshop preserves a valid selection.

## Phase 2 — Native Preferences entry point

### Build

1. Add **Preferences…** to the macOS Workshop application menu in Tauri.
2. Emit a neutral `workshop:open-preferences` event; do not expose a tool- or
   macOS-specific event to plugins.
3. Add a Workshop-owned Radix `Dialog` preferences surface and close/focus
   behavior. It should open over either the shelf or an active app without
   changing that app’s route or local state.
4. Add the reserved left navigation and implement Appearance.

### Tests first

- The Rust menu/event unit test verifies Preferences emits the neutral event.
- The shell test verifies the event opens the dialog, Escape closes it, and
  focus returns to the invoking element.
- Opening/closing preferences does not reset installed tools, tool routes, or
  workspace selection.

### Exit criteria

- Preferences is reachable from the application menu and fully keyboard usable.

## Phase 3 — Presets, color mode, and preview

### Build

1. Use Radix `RadioGroup` for color mode and preset cards, with visible names,
   selected state, and color swatches.
2. Add a compact live Workshop preview showing shelf, card, button, text, and
   focus states.
3. Use Radix `Tabs` for Presets and Custom, and Radix `Tooltip` only where a
   color/mode needs brief explanation.
4. Add an optional subtle-gradient switch only if it works across every preset;
   otherwise defer it.

### Tests first

- Each preset card has an accessible name and changes the resolved preference.
- System/Dark/Light controls expose correct radio semantics.
- Preview receives the same token set as the app root.
- Keyboard navigation selects a preset and never traps focus outside the
  dialog.
- Each bundled preset meets contrast requirements for primary text, muted text,
  and interactive controls.

### Exit criteria

- All bundled themes are selectable, legible, and survive restart.

## Phase 4 — Custom palette editor

### Build

1. Add four labeled hex inputs with synchronized native color inputs.
2. Validate six-digit hex values as the user edits; preserve unsaved invalid
   text locally in the dialog without applying it to the app.
3. Derive protected tokens and show direct contrast guidance next to the
   affected field.
4. Add **Save custom theme**, **Reset to Workshop**, and a live preview. Do not
   add import/share/randomize until the core editor has shipped.

### Tests first

- Valid hex input updates only its intended custom-palette field.
- Invalid, shorthand, alpha, and malformed values never become root CSS
  variables or persisted preferences.
- A contrast failure blocks Save and explains which foreground/background pair
  fails.
- Reset restores the Workshop preset and removes custom values from storage.
- A saved custom palette restores after remount and derives all required
  tokens.

### Exit criteria

- Users can safely create, save, replace, and reset a readable custom palette.

## Phase 5 — External-app inheritance

### Build

1. Publish a small, linked documentation set for app authors:
   - `docs/workshop-plugin-contract.md`: the normative host contract and token
     ownership rules;
   - `docs/building-workshop-apps.md`: a practical start-to-finish guide,
     including the minimum CSS needed to inherit a host theme;
   - `docs/workshop-theme-tokens.md`: the versioned token reference, meanings,
     guaranteed formats, fallback values, and deprecation policy;
   - `docs/workshop-theme-migration.md`: a checklist for migrating an existing
     standalone app without making it depend on Workshop source.
2. Include a copyable, framework-neutral CSS example and a small React example
   that use `var(--workshop-...)` with standalone fallbacks. Explain which
   colors apps must not override (text, focus, and status semantics) and where
   app-specific data visualization colors are appropriate.
3. Add the semantic token table and fallback guidance to
   `docs/workshop-plugin-contract.md`, linking to the dedicated references.
4. Replace Slate’s shared presentation colors with `var(--workshop-...)` plus
   standalone fallbacks. Keep its app-specific table/data colors scoped to
   Slate.
5. Ensure Pulse uses the same variables for all shared surfaces and controls.
6. Add a minimal plugin fixture that proves an arbitrary future app can read
   host tokens without importing Workshop source.
7. Do not add theme support to `requiredLocalCapabilities`, plugin status, or
   install eligibility. Apps that have not yet migrated continue to render with
   their existing styles; migrated apps gain host-theme colors when available.

### Tests first

- Slate and Pulse render with injected host variables and retain readable
  standalone fallback styles.
- Plugin source contains no imports from Workshop implementation files.
- A change of Workshop preset changes app shell/control tokens without changing
  tool data or plugin persistence.
- The same fixture renders correctly when every `--workshop-*` variable is
  absent, proving an app can be installed before it implements inheritance or
  run outside Workshop after it does.
- An unmigrated fixture remains installable and visible in the catalog, proving
  the host does not gate apps on theme adoption.
- The documentation examples are tested or compiled as part of the plugin
  fixture, so a copied example cannot silently drift from the host contract.
- Public-doc tests verify every app-builder document is linked from the plugin
  contract and contains no personal paths, credentials, or private app data.

### Exit criteria

- Theme inheritance is a documented, tested host capability rather than a
  Slate/Pulse exception, with a clear path for a new app author to adopt it.

## Phase 6 — Documentation, audit, and release

### Build

1. Update the README and user guide with Preferences access, color-mode
   behavior, local-only persistence, and reset instructions.
2. Update public-document checks and the clean-clone smoke expectation if they
   describe the default appearance.
3. Add release notes describing appearance preferences and the fact that app
   data is unaffected.

### Required verification

```sh
npm test
npm run typecheck
npm run build
npm run public:check
cargo test --manifest-path apps/marketing-builds-desktop/src-tauri/Cargo.toml
```

Perform a manual keyboard and visual pass for each preset in light, dark, and
system modes, including the shelf, an installed Slate view, an installed Pulse
view, the preferences dialog, focus indicators, and the update panel.

### Exit criteria

- Documentation and plugin contract match shipped behavior.
- No private theme data is introduced.
- A user can change or reset appearance without affecting app data, routes, or
  installation state.
