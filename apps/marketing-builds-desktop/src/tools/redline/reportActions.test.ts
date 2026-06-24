import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildReportExportFiles, demoRedlineWorkspace, runSavedAudit } from "./redlineData";
import { exportRedlineReports } from "./reportActions";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("Redline report actions", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports generated local run reports through the constrained Tauri command", async () => {
    const run = runSavedAudit(demoRedlineWorkspace, "pasted-demo-draft");
    const files = buildReportExportFiles(demoRedlineWorkspace, run);
    invokeMock.mockResolvedValue(files.length);
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });

    await expect(exportRedlineReports(demoRedlineWorkspace, files)).resolves.toEqual({
      status: "exported",
      clientId: "demo-redline",
      fileCount: files.length,
    });

    expect(invokeMock).toHaveBeenCalledWith("redline_write_packet_files", {
      clientId: "demo-redline",
      files,
      overwrite: true,
    });
  });

  it("returns a clear unavailable result when no run files exist", async () => {
    await expect(exportRedlineReports(demoRedlineWorkspace, [])).resolves.toEqual({
      status: "unavailable",
      clientId: "demo-redline",
      message: "Run an audit before exporting reports.",
    });
  });
});
