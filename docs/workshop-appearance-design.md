# Workshop Appearance: Product and Interaction Contract

## Locked contract

**Job:** a Workshop user personalizes the dark shell and manages remembered private app folders without contaminating app data or losing their current work context.

**Ownership:** Workshop owns the Preferences surface, ten palette definitions, validation, local appearance storage, runtime initials mark, and semantic CSS tokens. Apps own their domain UI and may progressively read host tokens with fallbacks. Folder selections stay in Workshop's existing versioned local workspace state; no preference action reads, changes, moves, discovers, or deletes private files.

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
| Save initials | Appearance form | Two normalized visible characters update the runtime mark | Existing initials remain active while invalid draft is corrected |
| Reset appearance | Reset action | Restores Workshop palette and LB locally | No tool state is changed |
| Change/reconnect folder | Folders row | Existing generic lifecycle validates and remembers only the selected root | Cancel/validation error keeps prior local selection; access can be reauthorized by selecting the folder again |
| Forget folder | Confirmed Forget action | Resets only host local selection | Files and contents remain untouched |
| Restart | Local storage | Valid preferences and remembered roots restore | Corrupt/future appearance state falls back without breaking startup |

## Runtime icon boundary

The generated in-app `LB` mark changes anywhere Workshop renders that mark. The signed app bundle icon, macOS Dock icon, installer art, and repository image assets are compiled/distributed assets and intentionally do not change at runtime.
