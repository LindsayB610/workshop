# Workshop Update Scheduling Scope

## Product contract

**Job:** Workshop should discover a signed update for a person who leaves the
app open, without turning a small release feed into a noisy background service.

**Ownership:** Workshop owns the check schedule, local schedule record, native
**Check for Updates…** event, update status, download, and restart. Plugins do
not participate. The updater still validates signed release metadata through
Tauri before an install.

**Source of truth:** a versioned local UI record holds only `lastAttemptAt` and
`lastSuccessfulCheckAt`. It contains no URLs, credentials, release payloads, or
plugin state. An available update remains in the in-memory updater client until
the user chooses **Install and restart**.

**Non-goals:** automatic download/install/restart, update-channel selection,
telemetry, plugin update polling, or a server-side scheduler.

## Chosen behavior

- Check automatically on every app launch; then begin the 24-hour in-app
  cadence from that launch check.
- While Workshop remains open, schedule one subsequent check 24 hours after the
  current attempt. Use a chained timeout, never competing intervals.
- **Check for Updates…** in the native Workshop menu and the Updates preference
  pane bypass the throttle.
- Automatic checks update the UI only when an update is found. Their failures
  are recorded locally for scheduling but remain quiet.
- A manual check exposes checking, up-to-date, and error feedback in the
  Updates pane. No update is downloaded or installed without the existing
  explicit action.

## Interaction and state matrix

| Job | Entry | Success | Failure / recovery |
| --- | --- | --- | --- |
| First automatic check | App launch | Signed update becomes actionable; otherwise no interruption | Quiet failure; retry at the next window |
| Repeated launch | App launch before 24h | Signed update check runs again | Manual check remains available |
| Long-running app | 24h chained timeout | Same as launch | One later retry; no duplicate timers |
| Manual check | Workshop menu / Preferences | Truthful available or up-to-date state | Visible error and retry button |
| Install | Existing install action | Downloads, installs, restarts | Existing error surface; no automatic retry/install |
| Corrupt schedule state | Local startup | Falls back to first-check behavior | Never blocks startup |

## Test plan

1. Pure schedule tests: corrupt/future records, throttle boundary, manual
   bypass, success/error timestamps, and next-delay calculation.
2. Mounted updater tests: automatic quiet error, manual checking/error/success,
   single chained timer, cleanup, and explicit-only installation.
3. App integration: native and DOM update events call the shared updater once;
   opening Preferences does not reset the active tool.
4. Native unit test: the menu id emits only the generic host event.
5. Regression: existing updater client, release workflow, typecheck, desktop
   build, Rust, public-boundary, and clean-clone checks.
