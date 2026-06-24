import { beforeEach, describe, expect, it, vi } from "vitest";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { createTauriUpdaterClient } from "./tauriUpdaterClient";

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

describe("Tauri updater client", () => {
  beforeEach(() => {
    vi.mocked(check).mockReset();
    vi.mocked(relaunch).mockClear();
  });

  it("downloads, installs, and relaunches an available update", async () => {
    const downloadAndInstall = vi.fn(async () => undefined);
    const update = {
      available: true,
      body: "Release notes.",
      close: vi.fn(async () => undefined),
      currentVersion: "0.1.0",
      date: "2026-06-22",
      download: vi.fn(async () => undefined),
      downloadAndInstall,
      install: vi.fn(async () => undefined),
      rawJson: {},
      version: "0.2.0",
    } as unknown as Awaited<ReturnType<typeof check>>;
    vi.mocked(check).mockResolvedValue(update);

    const client = createTauriUpdaterClient();

    await expect(client.check()).resolves.toEqual({
      available: true,
      notes: "Release notes.",
      version: "0.2.0",
    });
    await client.install();

    expect(downloadAndInstall).toHaveBeenCalledOnce();
    expect(relaunch).toHaveBeenCalledOnce();
  });
});
