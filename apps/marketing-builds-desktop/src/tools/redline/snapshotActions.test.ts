import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoRedlineWorkspace } from "./redlineData";
import { snapshotLiveTarget } from "./snapshotActions";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("Redline snapshot actions", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a deterministic mocked live snapshot without Tauri or network", async () => {
    const queuedTarget = demoRedlineWorkspace.targets.find(
      (target) => target.id === "queued-demo-page",
    );

    await expect(snapshotLiveTarget(demoRedlineWorkspace, queuedTarget)).resolves.toEqual(
      expect.objectContaining({
        status: "snapshotted",
        fileCount: 3,
        target: expect.objectContaining({
          id: "demo-page-2026-06-23",
          path: "clients/demo-redline/targets/fixtures/demo-page-2026-06-23.html",
          sourceUrl: "workshop://demo-redline/landing-page",
          finalUrl: "workshop://demo-redline/landing-page",
          snapshotAt: "2026-06-23T12:00:00.000Z",
        }),
      }),
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("fetches and writes snapshots through constrained Tauri commands when packaged", async () => {
    const queuedTarget = demoRedlineWorkspace.targets.find(
      (target) => target.id === "queued-demo-page",
    );
    invokeMock
      .mockResolvedValueOnce({
        url: "workshop://demo-redline/landing-page",
        finalUrl: "workshop://demo-redline/landing-page",
        fetchedAt: "2026-06-24T08:00:00.000Z",
        html: "<!doctype html><title>Northstar Demo Co.</title><main><h1>Live</h1><p>Snapshot text.</p></main>",
      })
      .mockResolvedValueOnce(3);
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });

    const result = await snapshotLiveTarget(demoRedlineWorkspace, queuedTarget);

    expect(result).toMatchObject({
      status: "snapshotted",
      target: {
        id: "demo-page-2026-06-24",
        snapshotAt: "2026-06-24T08:00:00.000Z",
      },
    });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "redline_fetch_live_url", {
      url: "workshop://demo-redline/landing-page",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "redline_write_target_snapshot_files", {
      clientId: "demo-redline",
      files: expect.arrayContaining([
        expect.objectContaining({
          path: "clients/demo-redline/targets/fixtures/demo-page-2026-06-24.html",
        }),
        expect.objectContaining({
          path: "clients/demo-redline/targets/snapshots/demo-page-2026-06-24.md",
          contents: expect.stringMatching(
            /Final URL: workshop:\/\/demo-redline\/landing-page[\s\S]+Checksum: (sha256|fnv32):/,
          ),
        }),
      ]),
      overwrite: true,
    });
  });

  it("blocks snapshotting non-URL targets", async () => {
    await expect(
      snapshotLiveTarget(demoRedlineWorkspace, demoRedlineWorkspace.targets[0]),
    ).resolves.toEqual({
      status: "blocked",
      message: "Snapshot Live URL is only available for queued URL targets.",
    });
  });
});
