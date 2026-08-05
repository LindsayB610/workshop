# Pulse

Pulse tracks persistent recurring obligations that keep notifying until the
current occurrence is marked Done.

Workshop hosts Pulse as an external self-hosted tool. The public Pulse repo and
private runner remain the source of truth for:

- private `pulses.yaml`,
- private state and completion history,
- ntfy topic and access token,
- a separate Pulse API bearer token,
- cloud runner setup and Android push delivery.

Use the packaged Pulse view in Workshop to enter the private runner URL and
bearer token for the current session, then inspect due, schedule, history, and
runner status. For a VPS deployment, the runner API stays loopback-only;
Workshop's native proxy connects over the documented SSH tunnel instead of
using browser CORS or exposing the API publicly. The optional
completion note is sent with Done, and Done is the only control that stops a
due occurrence’s repeated notifications.

Pulse data should live outside the Workshop shared tool roots. Disabling Pulse
in Workshop only hides the tool from the picker. It does not stop the runner,
delete private state, or change notification credentials.
