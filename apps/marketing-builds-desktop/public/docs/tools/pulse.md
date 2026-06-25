# Pulse

Pulse tracks persistent recurring obligations that keep notifying until the
current occurrence is marked Done.

Workshop hosts Pulse as an external self-hosted tool. The public Pulse repo and
private runner remain the source of truth for:

- private `pulses.yaml`,
- private state and completion history,
- Twilio credentials,
- notification recipients,
- cloud runner setup.

Use the Pulse view in Workshop to inspect due, schedule, history, and runner
status once a private local Pulse workspace root is selected.

Pulse data should live outside the Workshop shared tool roots. Disabling Pulse
in Workshop only hides the tool from the picker. It does not stop the runner,
delete private state, or change notification credentials.
