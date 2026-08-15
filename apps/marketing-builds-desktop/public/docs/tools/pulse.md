# Pulse

Pulse is an independently versioned recurring-reminder app. It is already on
the Workshop shelf; choose a private Pulse folder containing `pulse.config.json`
when you open it.

Pulse owns its reminder UI, private runner, Android Done/Snooze actions, and
all service-specific behavior. Workshop provides only the desktop frame and a
generic secure-service capability: it reads private connection metadata and
uses the operating-system keychain credential without returning that credential
to the Pulse webview.

For private-folder setup, service deployment, Android verification, and backup
instructions, use the [Pulse repository](https://github.com/LindsayB610/pulse).
