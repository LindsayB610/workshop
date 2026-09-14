# Workshop window restoration

## Product contract

Workshop should remember where its main macOS window belongs without asking the
user to configure anything. This is durable shell behavior, owned by Workshop;
plugins, selected folders, appearance, and private workspace data are unrelated.
The source of truth is a small local file in the app configuration directory.
There is no network service, telemetry, or new Preferences control.

Use Tauri's official window-state plugin for lifecycle tracking and persistence.
Restore the ordinary window bounds from a worker before revealing the window.
Native setters cross both Tauri's event loop and macOS's main dispatch queue.
Wait for both queues from the worker before reading bounds, fitting the window,
or showing it. Fit to the current display's usable area, then restore maximization. Only size,
position, and maximization are remembered. Hidden/minimized state, decoration
changes, and fullscreen Spaces are not restored; a deliberate launch must produce
a visible, reachable window. Fullscreen remains an OS interaction during use.

## State and interaction coverage

| Situation | Expected behavior |
| --- | --- |
| First launch | Use the existing default size, fitted to the available screen. |
| Move/resize, close, reopen | Restore the last ordinary size and position. |
| Quit or updater restart | Persist through the native app exit lifecycle. |
| Maximized at quit | Restore maximization after preparing reachable ordinary bounds. |
| Minimized/hidden at quit | Reopen visibly with ordinary bounds available. |
| Disconnected or rearranged display | Recover onto an available display; keep the title bar and full window reachable. |
| Smaller screen or changed display scale | Fit within the usable work area, including the title bar, menu bar, and Dock; reduce the minimum size if needed. |
| Negative display coordinates | Preserve valid placements on displays left of or above the primary screen. |
| Missing/corrupt state file | Fall back to the default window without blocking startup. |
| Saving fails | The current session keeps working; the plugin retries on the next normal exit. |

## Design decision

Automatic native restoration fits this job. A Preferences toggle or a visible
save action would make the user manage routine window behavior. No visual
redesign, extra screen, new keyboard interaction, or prototype gallery is needed.
The geometry tests are the prototype for recovery states; native macOS acceptance
is the final proof of window-manager behavior.

## Acceptance

Run `npm run test:native --workspace @marketing-builds/desktop` on macOS. It
runs the Rust suite and nine actual native smoke checks: Quit/save and restore,
close-button/save and restore, maximization and return to normal bounds,
malformed JSON, overflowing numeric coordinates, off-screen placement, and an
unwritable state file. The
smoke harness sets Prohibited activation before starting its event loop, uses
only a hidden, unfocused incognito webview with an isolated test app identifier,
and stores its state in a temporary directory removed afterward. It never loads
the installed Workshop profile or opens a GUI browser. Each scenario times out
after ten seconds. The Rust geometry suite also exercises 420 combinations of
screen sizes, scales, and saved positions. GitHub's native verification job runs
this same command.

The native checks verify real persisted bounds after the process exits. They
also verify that maximization preserves the ordinary frame and that the window
stays hidden throughout the test. Pure geometry tests do not cover the native
queue ordering or close lifecycle. Numeric saved-state validation prevents
integer overflow in the plugin's monitor-intersection arithmetic.

Then use the installed macOS app to move/resize and relaunch, quit while maximized
or minimized, and reopen after disconnecting an external display. Browser tests
cannot prove native placement. Do not claim these hands-on checks from a web
preview or launch GUI browsers as part of this feature's verification.
