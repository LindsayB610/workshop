import { describe, expect, it, vi } from "vitest";
import { browseMarkdownFile } from "./markdownFileBrowse";

describe("browseMarkdownFile", () => {
  it("asks the native dialog for exactly one Markdown file and returns its absolute path", async () => {
    const picker = vi.fn().mockResolvedValue("/Users/example/private/notes.md");

    await expect(browseMarkdownFile(undefined, picker)).resolves.toEqual({
      ok: true,
      path: "/Users/example/private/notes.md",
    });
    expect(picker).toHaveBeenCalledWith({
      directory: false,
      multiple: false,
      title: "Choose Markdown file",
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
  });

  it("seeds the picker with a valid current Markdown path without reading or changing it", async () => {
    const picker = vi.fn().mockResolvedValue("/Users/example/private/next.markdown");

    await expect(browseMarkdownFile("/Users/example/private/current.md", picker)).resolves.toEqual({
      ok: true,
      path: "/Users/example/private/next.markdown",
    });
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: "/Users/example/private/current.md",
    }));
  });

  it("does not pass malformed or non-Markdown current paths to the native picker", async () => {
    const picker = vi.fn().mockResolvedValue(null);

    await browseMarkdownFile("relative.txt", picker);

    expect(picker).toHaveBeenCalledWith(expect.not.objectContaining({ defaultPath: expect.anything() }));
  });

  it("reports cancellation without selecting or changing a file", async () => {
    await expect(browseMarkdownFile(undefined, vi.fn().mockResolvedValue(null))).resolves.toEqual({
      ok: false,
      canceled: true,
    });
  });

  it("returns a useful generic error when the native picker fails", async () => {
    await expect(browseMarkdownFile(undefined, vi.fn().mockRejectedValue(new Error("unavailable")))).resolves.toEqual({
      ok: false,
      message: "Workshop could not open the Markdown file picker. Please try again.",
    });
  });

  it("rejects a multiple, relative, or non-Markdown selection instead of exposing it", async () => {
    await expect(browseMarkdownFile(undefined, vi.fn().mockResolvedValue([
      "/Users/example/private/one.md",
      "/Users/example/private/two.md",
    ]))).resolves.toEqual({ ok: false, message: "Workshop could not use the selected Markdown file." });
    await expect(browseMarkdownFile(undefined, vi.fn().mockResolvedValue("relative.md"))).resolves.toEqual({
      ok: false,
      message: "Workshop could not use the selected Markdown file.",
    });
    await expect(browseMarkdownFile(undefined, vi.fn().mockResolvedValue("/Users/example/private/notes.txt"))).resolves.toEqual({
      ok: false,
      message: "Workshop could not use the selected Markdown file.",
    });
  });
});
