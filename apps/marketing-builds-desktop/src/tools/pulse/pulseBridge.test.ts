import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { completePulseOccurrence, isPulseProxyAvailable, loadPulseSnapshot } from "./pulseBridge";

describe("Pulse native bridge", () => {
  beforeEach(() => {
    invoke.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { __TAURI_INTERNALS__: {} },
    });
  });

  it("uses the native snapshot command instead of browser fetch", async () => {
    invoke.mockResolvedValue({ status: 200, body: { checkedAt: "2026-08-04T00:00:00.000Z" } });

    await expect(loadPulseSnapshot("http://127.0.0.1:8787", "private-token-with-at-least-32-characters")).resolves.toMatchObject({ status: 200 });
    expect(invoke).toHaveBeenCalledWith("pulse_load_snapshot", {
      runnerUrl: "http://127.0.0.1:8787",
      apiToken: "private-token-with-at-least-32-characters",
    });
  });

  it("sends Done and the optional note through the native command", async () => {
    invoke.mockResolvedValue({ status: 200, body: { occurrence: { state: "done" } } });

    await completePulseOccurrence("http://127.0.0.1:8787", "private-token-with-at-least-32-characters", "weekly:2026-08-04", "Finished");
    expect(invoke).toHaveBeenCalledWith("pulse_mark_done", {
      runnerUrl: "http://127.0.0.1:8787",
      apiToken: "private-token-with-at-least-32-characters",
      occurrenceId: "weekly:2026-08-04",
      completionNote: "Finished",
    });
  });

  it("refuses private connection work outside packaged Workshop", async () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });

    expect(isPulseProxyAvailable()).toBe(false);
    await expect(loadPulseSnapshot("http://127.0.0.1:8787", "private-token-with-at-least-32-characters")).rejects.toThrow(/packaged Workshop/);
    expect(invoke).not.toHaveBeenCalled();
  });
});
