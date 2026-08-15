import { describe, expect, it, vi } from "vitest";
import { browseWorkspaceRoot } from "./workspaceRootBrowse";

describe("browseWorkspaceRoot", () => {
  it("asks the native dialog for one directory only and returns its absolute path", async () => {
    const openDirectoryPicker = vi.fn().mockResolvedValue("/Users/example/workshop-private/slate");

    await expect(browseWorkspaceRoot(openDirectoryPicker)).resolves.toEqual({
      ok: true,
      root: "/Users/example/workshop-private/slate",
    });
    expect(openDirectoryPicker).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "Choose private folder",
    });
  });

  it("reports cancellation without selecting or changing a folder", async () => {
    await expect(browseWorkspaceRoot(vi.fn().mockResolvedValue(null))).resolves.toEqual({
      ok: false,
      canceled: true,
    });
  });

  it("returns a useful generic error when the native picker fails", async () => {
    await expect(browseWorkspaceRoot(vi.fn().mockRejectedValue(new Error("unavailable")))).resolves.toEqual({
      ok: false,
      message: "Workshop could not open the folder picker. Please try again.",
    });
  });

  it("rejects a malformed picker result instead of exposing it as a workspace root", async () => {
    await expect(browseWorkspaceRoot(vi.fn().mockResolvedValue("relative-folder"))).resolves.toEqual({
      ok: false,
      message: "Workshop could not use the selected folder.",
    });
  });
});
