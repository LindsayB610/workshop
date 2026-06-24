# Workshop Tool Authoring

Workshop tools live under `apps/marketing-builds-desktop/src/tools/<tool-id>/`.

To add a tool:

1. Add a `ToolDefinition` in `src/tool-registry/tools.ts`.
2. Assign `installMode`, `defaultInstalled`, `docsPath`,
   `workspaceRequirement`, and `uninstallSafetyCopy` so the Workshop catalog can
   install, hide, and restore the tool without touching user data.
3. Assign a `logoVariant` and keep the mark in the shared Workshop logo family.
4. Create a tool view component under `src/tools/<tool-id>/`.
5. Register the component in `src/tools/toolViews.tsx`.
6. Keep tool-specific state inside the tool view unless it must be shared across
   tools.
7. Keep tool-specific styles prefixed by the tool id or a short namespace, such
   as `redline-*` or `cr-*`.

Tool view components receive:

```ts
type ToolViewProps = {
  tool: ToolDefinition;
};
```

Use `ToolPlaceholder` for planned tools whose behavior is not implemented yet.
Visible controls must either perform real behavior, be disabled with clear copy,
or be omitted until the behavior exists.

Do not add new `activeToolId === "..."` conditionals in `App.tsx`. The app shell
selects a registered tool and `ToolView` renders the matching component.

Workshop opens to the shared tool shelf. New tools should appear there as
chiclets with a short name, a ready/planned state, a hover tooltip, and a
differentiated logo that still follows the Lindsay Brunner brand palette.
Bundled tools default to installed only when `defaultInstalled` is true; disabled
bundled tools move into the Add New Tools catalog and can be restored locally.
