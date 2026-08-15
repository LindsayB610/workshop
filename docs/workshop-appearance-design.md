# Workshop Appearance: Product and Interaction Contract

## Locked contract

**Job:** a Workshop user personalizes the dark shell and manages remembered private app folders without contaminating app data or losing their current work context.

**Ownership:** Workshop owns the Preferences surface, ten palette definitions, validation, local appearance storage, its fixed tabletop-and-W product mark, and semantic CSS tokens. Apps own their domain UI and may progressively read host tokens with fallbacks. Folder selections stay in Workshop's existing versioned local workspace state; no preference action reads, changes, moves, discovers, or deletes private files.

**Non-goals:** light/system modes, bundle/Dock icon replacement, cloud sync, palette sharing, a tool-specific settings exception, and mandatory plugin adoption.

## Directions compared

| | Inline drawer | Chosen: control-room preferences |
| --- | --- | --- |
| Composition | Shelf-adjacent panel | Focused modal, two-column desktop surface |
| Best at | One quick setting | Appearance, custom validation, and folders together |
| Risk | Hides important safety copy and collapses paths | A deliberate interruption, mitigated by preserving the active app underneath |
| Workshop fit | Feels like catalog filtering | Feels like host-level ownership |

The control-room direction wins: preferences are host configuration, not a tool action. The left rail keeps Appearance and Folders distinct; the appearance pane gives presets a scanable grid and gives the custom editor its own correction space.

## Interaction/state matrix

| Job | Entry | Success | Failure/recovery |
| --- | --- | --- | --- |
| Open Preferences | Workshop → Preferences… or ⌘, | Opens over the exact current shelf or workbench state | A failed native event leaves the current app state untouched; no duplicate in-app Preferences control is shown |
| Select preset | Accessible radio card | Applies and persists immediately | Invalid stored preset resolves to Workshop default |
| Draft custom colors | Custom palette tab | Preview appears only for a valid four-color palette | Draft remains visible; syntax, count, duplicate, and contrast errors explain the fix |
| Migrate prior appearance | Local storage read | V1 themes become v2 themes while the fixed Workshop mark replaces initials | Corrupt or future state resolves to the default palette |
| Reset appearance | Reset action | Restores the Workshop palette locally | No tool state is changed |
| Change/reconnect folder | Folders row | Existing generic lifecycle validates and remembers only the selected root | Cancel/validation error keeps prior local selection; access can be reauthorized by selecting the folder again |
| Forget folder | Confirmed Forget action | Resets only host local selection | Files and contents remain untouched |
| Restart | Local storage | Valid preferences and remembered roots restore | Corrupt/future appearance state falls back without breaking startup |

## Product-mark boundary

The fixed in-app Workshop mark uses semantic host tokens, so it reflects a
selected palette without becoming plugin-specific. The signed app bundle icon,
macOS Dock icon, and installer art use the shipped mark at build time and do
not change at runtime.
