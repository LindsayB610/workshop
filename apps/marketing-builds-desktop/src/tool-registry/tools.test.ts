import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { dataRootsAreIsolated, getToolById, tools } from "./tools";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testDir, "../..");

describe("tool registry", () => {
  it("registers Redline as a ready sub-tool", () => {
    const tool = getToolById("redline");

    expect(tool?.status).toBe("ready");
    expect(tool?.logoVariant).toBe("redline");
    expect(tool?.installMode).toBe("bundled");
    expect(tool?.defaultInstalled).toBe(true);
    expect(tool?.docsPath).toBe("/docs/tools/redline.md");
    expect(tool?.workspaceRequirement).toContain("local client packet");
    expect(tool?.uninstallSafetyCopy).toContain("Local client packets stay untouched");
    expect(tool?.routes.map((route) => route.id)).toEqual([
      "audit",
      "review",
      "packet",
      "onboarding",
    ]);
    expect(tool?.routes.map((route) => route.sectionId)).toEqual([
      "redline-audit",
      "redline-review",
      "redline-packet",
      "redline-onboarding",
    ]);
    expect(tool?.exportActions).toEqual(
      expect.arrayContaining(["Export report bundle", "Export edit brief"]),
    );
  });

  it("registers Megaphone as a ready Workshop tool", () => {
    const tool = getToolById("megaphone");

    expect(tool?.status).toBe("ready");
    expect(tool?.logoVariant).toBe("megaphone");
    expect(tool?.installMode).toBe("bundled");
    expect(tool?.defaultInstalled).toBe(true);
    expect(tool?.docsPath).toBe("/docs/tools/megaphone.md");
    expect(tool?.workspaceRequirement).toContain("campaign corpus");
    expect(tool?.uninstallSafetyCopy).toContain("Local corpora and packages stay untouched");
    expect(tool?.description).toContain("campaign messages");
    expect(tool?.routes.map((route) => route.id)).toEqual([
      "sources",
      "onboarding",
      "strategy",
      "briefs",
      "drafts",
      "calendar",
      "measurement",
    ]);
    expect(tool?.dataRoots).toEqual(["tools/megaphone"]);
  });

  it("registers Pulse as an external self-hosted Workshop tool", () => {
    const tool = getToolById("pulse");

    expect(tool?.status).toBe("ready");
    expect(tool?.installMode).toBe("external");
    expect(tool?.defaultInstalled).toBe(true);
    expect(tool?.docsPath).toBe("/docs/tools/pulse.md");
    expect(tool?.description).toContain("recurring obligations");
    expect(tool?.workspaceRequirement).toContain("private Pulse runner");
    expect(tool?.routes.map((route) => route.id)).toEqual([
      "active",
      "schedule",
      "history",
      "runner",
    ]);
    expect(tool?.routes.map((route) => route.path)).toEqual([
      "/pulse/active",
      "/pulse/schedule",
      "/pulse/history",
      "/pulse/runner",
    ]);
    expect(tool?.requiredLocalCapabilities).toEqual([
      "local-workspace",
      "connector-status",
      "run-history",
    ]);
    expect(tool?.dataRoots).toEqual(["tools/pulse"]);
    expect(tool?.importActions).toEqual([]);
    expect(tool?.exportActions).toEqual([]);
  });

  it("keeps tool data roots isolated", () => {
    expect(dataRootsAreIsolated(tools)).toBe(true);
  });

  it("keeps domain logic out of shared app services", () => {
    for (const tool of tools) {
      expect(tool.dataRoots.every((root) => root.length > 0)).toBe(true);
      expect(tool.requiredLocalCapabilities).not.toContain("judge-validation");
      expect(tool.requiredLocalCapabilities).not.toContain("source-distillation");
    }
  });

  it("keeps tool docs links inside packaged Workshop docs", () => {
    for (const tool of tools) {
      expect(tool.docsPath.startsWith("/docs/tools/"), tool.id).toBe(true);
      expect(tool.docsPath.includes(".."), tool.id).toBe(false);
      expect(existsSync(path.join(appRoot, "public", tool.docsPath)), tool.docsPath).toBe(true);
    }
  });
});
