import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findMegaphoneRoot, normalizeSmokePath } from "./megaphone-packaged-smoke.mjs";

describe("Megaphone packaged smoke helpers", () => {
  it("accepts generated package files inside the active client workspace", () => {
    expect(
      normalizeSmokePath("clients/demo-megaphone/post-packages/2026-06-22-smoke/brief.md", "demo-megaphone"),
    ).toBe("clients/demo-megaphone/post-packages/2026-06-22-smoke/brief.md");

    expect(
      normalizeSmokePath("clients/demo-megaphone/post-packages/2026-06-22-smoke/package.json", "demo-megaphone"),
    ).toBe("clients/demo-megaphone/post-packages/2026-06-22-smoke/package.json");
  });

  it("rejects generated package paths that could escape the smoke workspace", () => {
    const unsafePaths = [
      "/tmp/brief.md",
      "clients/demo-megaphone/post-packages/../brief.md",
      "clients/other/post-packages/brief.md",
      "clients/demo-megaphone/sources/source.md",
      "clients/demo-megaphone/post-packages/brief.txt",
    ];

    for (const unsafePath of unsafePaths) {
      expect(() => normalizeSmokePath(unsafePath, "demo-megaphone")).toThrow(
        "Unsafe Megaphone smoke file path",
      );
    }
  });

  it("finds a sibling Megaphone repo while walking upward from a desktop app path", async () => {
    const root = await mkdtemp(join(tmpdir(), "megaphone-root-"));
    const desktopPath = join(root, "content-redline/apps/marketing-builds-desktop/scripts");
    const megaphonePath = join(root, "megaphone");

    mkdirSync(desktopPath, { recursive: true });
    mkdirSync(megaphonePath, { recursive: true });
    writeFileSync(join(megaphonePath, "package.json"), "{}");

    expect(findMegaphoneRoot(desktopPath)).toBe(megaphonePath);
  });
});
