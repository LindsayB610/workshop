# Agent Guide

This repo contains Redline plus Workshop, the Tauri desktop app that hosts
Redline and future Marketing Builds tools.

Read this before adding or changing Workshop tools.

## Workshop Product Shape

- The desktop app is named Workshop.
- Workshop opens to a tool picker shelf, not directly into any one tool.
- The picker should feel like a compact creative studio tool shelf:
  - brand header
  - chiclet-style tool buttons
  - differentiated tool logos that are visibly part of one set
  - hover/focus tooltip explaining each tool
  - no sidebar, recent-workspace list, or tool-specific content on first open
- Tool workspaces open only after a user chooses a tool.
- The global update affordance belongs on the picker only when it is actionable:
  show the blue `Update available` button if an update exists; keep the picker
  quiet when no update is available.

## Brand Rules

Workshop follows the Lindsay Brunner visual system:

- black base: `#000000`
- red: `#ff0037`
- pink: `#ff1b8d`
- yellow: `#ffdd00`
- primary gradient:
  `linear-gradient(135deg, var(--color-red) 0%, var(--color-pink) 50%, var(--color-yellow) 100%)`
- use `Inter` first for app UI, with `Space Grotesk` as fallback
- keep cards/chiclets at `0.5rem` / 8px radius or less
- do not add decorative orbs, bokeh, or one-off SaaS gradients
- do not make tool logos random icon-library marks; use the shared Workshop
  logo family in `src/app-shell/ToolLogo.tsx`

## Adding A Workshop Tool

Workshop tools are registry-driven. Do not add new hardcoded
`activeToolId === "..."` branches in `App.tsx`.

To add a tool:

1. Add a `ToolDefinition` in
   `apps/marketing-builds-desktop/src/tool-registry/tools.ts`.
2. Assign a `logoVariant` in
   `apps/marketing-builds-desktop/src/tool-registry/types.ts`.
3. Add the matching visual treatment in
   `apps/marketing-builds-desktop/src/app-shell/ToolLogo.tsx` and
   `apps/marketing-builds-desktop/src/styles/app.css`.
4. Create the tool view under
   `apps/marketing-builds-desktop/src/tools/<tool-id>/`.
5. Register the tool view in
   `apps/marketing-builds-desktop/src/tools/toolViews.tsx`.
6. Keep tool-specific state inside the tool view unless it truly must be shared.
7. Keep tool-specific CSS prefixed with the tool id or a short namespace.

Use `ToolPlaceholder` for planned tools whose behavior is not implemented yet.
Megaphone is currently the next planned tool.

## Boundaries

- Workshop is the host shell. It should not know domain details about how a tool
  audits, drafts, scores, crawls, or reports.
- Redline-specific logic belongs under `packages/core`, `packages/cli`,
  `clients/`, or `apps/marketing-builds-desktop/src/tools/redline/`.
- Future tools should get their own tool folder and, when needed, their own core
  package or module.
- Visible controls must either do real work, be disabled with clear copy, or be
  omitted until the behavior exists.
- Client data must stay separated by client folder. Do not mix Redline client
  packets or shared context across clients.

## Current Tool Registry

- `redline`: ready. Audits client pages against trusted source packets and
  prepares reports.
- `megaphone`: planned. Intended for campaign/message planning from a source
  brief.

## Files Agents Usually Need

- `apps/marketing-builds-desktop/src/App.tsx`: app-level shelf vs workspace
  routing.
- `apps/marketing-builds-desktop/src/app-shell/ToolShelf.tsx`: opening tool
  picker.
- `apps/marketing-builds-desktop/src/app-shell/WorkbenchShell.tsx`: shared
  workspace frame after a tool is selected.
- `apps/marketing-builds-desktop/src/app-shell/SettingsPanel.tsx`: updater UI.
- `apps/marketing-builds-desktop/src/app-shell/ToolLogo.tsx`: shared tool-logo
  system.
- `apps/marketing-builds-desktop/src/tool-registry/tools.ts`: registered tools.
- `apps/marketing-builds-desktop/src/tools/toolViews.tsx`: tool view registry.
- `apps/marketing-builds-desktop/src/tools/README.md`: short authoring notes.
- `project-plan.md`: phase plan and status.

## Verification

Before handing work back, run the smallest relevant slice plus broader checks
when shared Workshop behavior changed.

For desktop-only changes:

```sh
npm run test --workspace @marketing-builds/desktop
npm run typecheck --workspace @marketing-builds/desktop
npm run build --workspace @marketing-builds/desktop
git diff --check
```

For core Redline or cross-workspace changes:

```sh
npm test
npm run typecheck
npm run build
git diff --check
```

Browser visual QA may be unavailable in the current Codex environment because of
a known browser sandbox bug. If browser inspection fails, say so plainly and rely
on tests/build/static review rather than pretending the UI was visually checked.

## Git Hygiene

- Do not revert user changes.
- Keep unrelated refactors out of tool implementation work.
- Commit/push only when explicitly asked or when the active task says to do so.
- If release workflows fail, check the latest GitHub Actions run history before
  drawing conclusions from email notifications.
