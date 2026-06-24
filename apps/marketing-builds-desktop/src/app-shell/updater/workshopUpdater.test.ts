import { describe, expect, it, vi } from "vitest";
import {
  checkForWorkshopUpdate,
  installWorkshopUpdate,
  runStartupWorkshopUpdateCheck,
  updateErrorMessage,
} from "./workshopUpdater";
import type { WorkshopUpdaterClient, WorkshopUpdateState } from "./types";

describe("Workshop updater state", () => {
  it("reports available updates", async () => {
    const client = {
      check: vi.fn(async () => ({
        available: true,
        version: "0.2.0",
        notes: "Updater ready.",
      })),
    } satisfies Pick<WorkshopUpdaterClient, "check">;

    await expect(checkForWorkshopUpdate("0.1.0", client)).resolves.toEqual({
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
      notes: "Updater ready.",
      status: "available",
    });
  });

  it("reports when no update is available", async () => {
    const client = {
      check: vi.fn(async () => ({ available: false as const })),
    } satisfies Pick<WorkshopUpdaterClient, "check">;

    await expect(checkForWorkshopUpdate("0.1.0", client)).resolves.toEqual({
      currentVersion: "0.1.0",
      status: "not_available",
    });
  });

  it("surfaces update check errors", async () => {
    const client = {
      check: vi.fn(async () => {
        throw new Error("network unavailable");
      }),
    } satisfies Pick<WorkshopUpdaterClient, "check">;

    await expect(checkForWorkshopUpdate("0.1.0", client)).resolves.toEqual({
      currentVersion: "0.1.0",
      status: "error",
      error: "network unavailable",
    });
  });

  it("surfaces non-Error plugin failures", () => {
    expect(updateErrorMessage("permission denied", "fallback")).toBe("permission denied");
    expect(updateErrorMessage({ message: "plugin denied" }, "fallback")).toBe(
      '{"message":"plugin denied"}',
    );
  });

  it("installs an available update", async () => {
    const state: WorkshopUpdateState = {
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
      status: "available",
    };
    const client = {
      install: vi.fn(async () => undefined),
    } satisfies Pick<WorkshopUpdaterClient, "install">;

    await expect(installWorkshopUpdate(state, client)).resolves.toEqual({
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
      status: "installed",
      error: undefined,
    });
  });

  it("detects available updates on startup without installing them", async () => {
    const client = {
      check: vi.fn(async () => ({
        available: true as const,
        version: "0.2.0",
        notes: "Ready.",
      })),
      install: vi.fn(async () => undefined),
    } satisfies WorkshopUpdaterClient;

    await expect(runStartupWorkshopUpdateCheck("0.1.0", client)).resolves.toEqual({
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
      notes: "Ready.",
      status: "available",
    });
    expect(client.install).not.toHaveBeenCalled();
  });

  it("does not prompt when no update is available on startup", async () => {
    const client = {
      check: vi.fn(async () => ({ available: false as const })),
      install: vi.fn(async () => undefined),
    } satisfies WorkshopUpdaterClient;

    await expect(runStartupWorkshopUpdateCheck("0.1.0", client)).resolves.toEqual({
      currentVersion: "0.1.0",
      status: "not_available",
    });
    expect(client.install).not.toHaveBeenCalled();
  });
});
