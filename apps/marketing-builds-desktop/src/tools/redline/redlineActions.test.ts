import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openRedlineArtifact } from "./redlineActions";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("Redline desktop actions", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens artifacts through the constrained Tauri command in Workshop", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });

    await expect(
      openRedlineArtifact("clients/demo-redline/reports/launch-review/executive-summary.md"),
    ).resolves.toEqual({
      status: "opened",
      path: "clients/demo-redline/reports/launch-review/executive-summary.md",
    });

    expect(invokeMock).toHaveBeenCalledWith("redline_open_path", {
      path: "clients/demo-redline/reports/launch-review/executive-summary.md",
    });
  });

  it("returns a clear unavailable result outside Tauri and clipboard contexts", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {});

    await expect(
      openRedlineArtifact("clients/demo-redline/reports/launch-review/executive-summary.md"),
    ).resolves.toEqual({
      status: "unavailable",
      path: "clients/demo-redline/reports/launch-review/executive-summary.md",
      message: "Artifact opening is available in the packaged Workshop app.",
    });
  });
});
