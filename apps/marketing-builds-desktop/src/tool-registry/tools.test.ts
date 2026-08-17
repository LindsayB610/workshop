import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getToolManifest, toolManifests } from "./toolManifest";
import { dataRootsAreIsolated, getToolById, tools } from "./tools";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testDir, "../..");

describe("tool registry", () => {
  it("declares stable runtime and private-workspace contracts for registered tools", () => {
    expect(toolManifests.map((manifest) => manifest.id)).toEqual([
      "slate",
      "pulse",
      "redline",
      "megaphone",
    ]);

    expect(getToolManifest("redline")).toMatchObject({
      displayName: "Redline",
      runtime: { kind: "bundled-core", entryPoint: "@redline/core" },
      privateWorkspace: { kind: "client-index", requiredFields: ["workspace.yaml", "client.yaml"] },
    });
    expect(getToolManifest("slate")).toMatchObject({
      displayName: "Slate",
      status: "ready",
      runtime: { kind: "native-bridge", entryPoint: "read-configured-markdown-source" },
      privateWorkspace: { kind: "runner-root", requiredFields: ["slate.config.json"] },
    });
    expect(getToolManifest("megaphone")).toMatchObject({
      runtime: { kind: "bridge-cli", entryPoint: "@megaphone/core/bridgeCli" },
    });
    expect(getToolManifest("pulse")).toMatchObject({
      status: "ready",
      navigationMode: "plugin",
      runtime: { kind: "generic-secure-service", entryPoint: "request_configured_secure_service" },
      privateWorkspace: { kind: "plugin-config", requiredFields: ["pulse.config.json"] },
    });
  });

  it("keeps the UI registry aligned with the manifest", () => {
    expect(tools.map((tool) => tool.id).sort()).toEqual(toolManifests.map((manifest) => manifest.id).sort());
    for (const tool of tools) {
      const manifest = getToolManifest(tool.id);
      expect(manifest).toBeDefined();
      expect(tool.runtime).toEqual(manifest?.runtime);
      expect(tool.privateWorkspace).toEqual(manifest?.privateWorkspace);
    }
  });

  it("declares navigation ownership instead of special-casing a tool in the host", () => {
    expect(getToolManifest("slate")?.navigationMode).toBe("plugin");
    expect(
      toolManifests
        .filter((manifest) => !["slate", "pulse"].includes(manifest.id))
        .every((manifest) => manifest.navigationMode === "host"),
    ).toBe(true);
  });

  it("matches declared runtime entry points to their adapter implementations", () => {
    const desktopPackage = JSON.parse(
      readFileSync(path.join(appRoot, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const nativeAdapter = readFileSync(path.join(appRoot, "src-tauri", "src", "lib.rs"), "utf8");

    const redline = getToolManifest("redline");
    const megaphone = getToolManifest("megaphone");
    const pulse = getToolManifest("pulse");

    expect(desktopPackage.dependencies?.[redline?.runtime.entryPoint ?? ""]).toBeDefined();
    expect(megaphone?.runtime.entryPoint).toBe("@megaphone/core/bridgeCli");
    expect(nativeAdapter).toContain("packages/core/dist/bridgeCli.js");
    expect(pulse?.runtime.entryPoint).toBe("request_configured_secure_service");
    expect(nativeAdapter).toContain("fn request_configured_secure_service");
    expect(nativeAdapter).toContain("fn open_external_url");
    expect(nativeAdapter).not.toMatch(/\bfn slate_/);
    expect(nativeAdapter).not.toMatch(/\bfn pulse_/);
    expect(nativeAdapter).not.toContain("workshop-private/pulse");

    const markdownFileBrowser = readFileSync(path.join(appRoot, "src", "tools", "markdownFileBrowse.ts"), "utf8");
    expect(markdownFileBrowser).toContain('"browse_markdown_file"');
    expect(markdownFileBrowser).toContain("extensions: MARKDOWN_EXTENSIONS");
    expect(markdownFileBrowser).not.toMatch(/slate|slate\.config|sourceId/i);
  });

  it("registers Redline as a ready sub-tool", () => {
    const tool = getToolById("redline");

    expect(tool?.status).toBe("planned");
    expect(tool?.logoVariant).toBe("redline");
    expect(tool?.installMode).toBe("bundled");
    expect(tool?.defaultInstalled).toBe(false);
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

    expect(tool?.status).toBe("planned");
    expect(tool?.logoVariant).toBe("megaphone");
    expect(tool?.installMode).toBe("bundled");
    expect(tool?.defaultInstalled).toBe(false);
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
    expect(tool?.defaultInstalled).toBe(false);
    expect(tool?.docsPath).toBe("/docs/tools/pulse.md");
    expect(tool?.description).toContain("recurring reminders");
    expect(tool?.workspaceRequirement).toContain("pulse.config.json");
    expect(tool?.routes.map((route) => route.id)).toEqual([
      "reminders",
      "history",
      "settings",
    ]);
    expect(tool?.routes.map((route) => route.path)).toEqual([
      "/pulse/reminders",
      "/pulse/history",
      "/pulse/settings",
    ]);
    expect(tool?.requiredLocalCapabilities).toEqual([
      "local-workspace",
      "read_secure_service_metadata",
      "request_configured_secure_service",
    ]);
    expect(tool?.dataRoots).toEqual([]);
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
