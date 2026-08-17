# Pulse

Pulse is an independently versioned recurring-reminder app. Install it from
**Add New Tools**, then use its guided setup. A private folder is not required
for that standard path. If you already run Pulse through a manual or
self-hosted installation, you can instead choose a private folder containing
`pulse.config.json`.

Pulse owns its reminder UI, private runner, Android Done/Snooze actions, and
all service-specific behavior. Workshop provides only the desktop frame and a
generic secure-service capability: it reads private connection metadata and
uses the operating-system keychain credential without returning that credential
to the Pulse webview.

For guided setup, optional private-folder setup, service deployment, Android
verification, and backup instructions, use the
[Pulse repository](https://github.com/LindsayB610/pulse).
