/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel, useWorkshopUpdater, type WorkshopUpdaterController } from "./SettingsPanel";
import { automaticUpdateCheckIntervalMs, updateScheduleStorageKey } from "./updater/updateSchedule";
import type { WorkshopUpdaterClient } from "./updater/types";

function UpdaterHarness({ client }: { client: WorkshopUpdaterClient }) {
  const updater = useWorkshopUpdater(client);
  return <><output>{updater.updateState.status}</output><button type="button" onClick={() => { void updater.checkNow(); }}>Manual check</button></>;
}

afterEach(() => { cleanup(); window.localStorage.clear(); vi.useRealTimers(); });

describe("Workshop update scheduler", () => {
  it("checks once on first launch, saves a successful schedule record, and schedules one later check", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-08-14T12:00:00Z"));
    const client = { check: vi.fn(async () => ({ available: false as const })), install: vi.fn(async () => undefined) } satisfies WorkshopUpdaterClient;
    render(<UpdaterHarness client={client} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(client.check).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem(updateScheduleStorageKey) ?? "null")).toMatchObject({ version: 1, lastAttemptAt: Date.now(), lastSuccessfulCheckAt: Date.now() });
    await act(async () => { await vi.advanceTimersByTimeAsync(automaticUpdateCheckIntervalMs - 1); });
    expect(client.check).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(client.check).toHaveBeenCalledTimes(2);
  });

  it("checks again after an actual app remount, then resumes the daily cadence", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-08-14T12:00:00Z"));
    window.localStorage.setItem(updateScheduleStorageKey, JSON.stringify({ version: 1, lastAttemptAt: Date.now(), lastSuccessfulCheckAt: Date.now() }));
    const client = { check: vi.fn(async () => ({ available: false as const })), install: vi.fn(async () => undefined) } satisfies WorkshopUpdaterClient;
    const firstLaunch = render(<UpdaterHarness client={client} />);
    await act(async () => {});
    expect(client.check).toHaveBeenCalledTimes(1);
    firstLaunch.unmount();
    render(<UpdaterHarness client={client} />);
    await act(async () => {});
    expect(client.check).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(automaticUpdateCheckIntervalMs - 1); });
    expect(client.check).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Manual check" }));
    await act(async () => {});
    expect(client.check).toHaveBeenCalledTimes(3);
  });

  it("keeps automatic check failures quiet and cleans up timers on unmount", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-08-14T12:00:00Z"));
    const client = { check: vi.fn(async () => { throw new Error("offline"); }), install: vi.fn(async () => undefined) } satisfies WorkshopUpdaterClient;
    const rendered = render(<UpdaterHarness client={client} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("status").textContent).toBe("idle");
    rendered.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(automaticUpdateCheckIntervalMs * 2); });
    expect(client.check).toHaveBeenCalledTimes(1);
  });

  it("does not create a second schedule when it receives the app-owned controller", () => {
    vi.useFakeTimers();
    const timer = vi.spyOn(window, "setTimeout");
    const controller: WorkshopUpdaterController = { updateState: { currentVersion: "0.1.5", status: "not_available" }, checkNow: vi.fn(async () => undefined), installUpdate: vi.fn(async () => undefined) };
    render(<SettingsPanel controller={controller} />);
    expect(timer).not.toHaveBeenCalled();
  });
});
