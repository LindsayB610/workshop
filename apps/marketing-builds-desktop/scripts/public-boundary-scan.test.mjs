import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  auditPublicBoundary,
  classifyPath,
  loadInventory,
  parseArgs,
} from "./public-boundary-scan.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const inventory = loadInventory(path.join(repoRoot, "docs/data-boundary-inventory.json"));
const privateClientId = ["para", "sail"].join("");
const privateClientName = ["Para", "sail"].join("");

describe("public boundary scanner", () => {
  it("parses strict scan options", () => {
    expect(parseArgs(["--strict", "--root", "/tmp/workshop"])).toEqual({
      strict: true,
      json: true,
      root: "/tmp/workshop",
    });
  });

  it("classifies checked-in client roots before public release", () => {
    expect(classifyPath("clients/fixture/client.yaml", inventory)).toMatchObject({
      classification: "safe-demo-fixture",
      publicSafe: true,
    });
    expect(classifyPath("clients/demo-redline/client.yaml", inventory)).toMatchObject({
      classification: "safe-demo-fixture",
      publicSafe: true,
    });
    expect(classifyPath("clients/demo-megaphone/client.yaml", inventory)).toMatchObject({
      classification: "safe-demo-fixture",
      publicSafe: true,
    });
    expect(classifyPath("clients/template-redline/client.yaml", inventory)).toMatchObject({
      classification: "template",
      publicSafe: true,
    });
    expect(classifyPath(`clients/${privateClientId}/source-manifest.json`, inventory)).toMatchObject({
      classification: "private-excluded",
      publicSafe: false,
      remediationPhase: 23,
    });
  });

  it("keeps demo and template folders free of private-client findings", () => {
    const result = auditPublicBoundary();
    const demoPrivateFindings = result.findings.filter((finding) => {
      return (
        finding.severity === "private-client" &&
        /^(clients\/demo-|clients\/template-)/.test(finding.path)
      );
    });

    expect(demoPrivateFindings).toEqual([]);
  });

  it("detects private client terms, source snapshots, and generated reports", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "workshop-public-boundary-"));
    mkdirSync(path.join(root, "docs"), { recursive: true });
    mkdirSync(path.join(root, "clients", privateClientId, "sources/notion"), { recursive: true });
    mkdirSync(path.join(root, "clients", privateClientId, "reports/run"), { recursive: true });
    writeFileSync(
      path.join(root, "docs/data-boundary-inventory.json"),
      JSON.stringify(inventory, null, 2),
    );
    writeFileSync(
      path.join(root, "clients", privateClientId, "sources/notion/page.md"),
      `${privateClientName} private Notion snapshot`,
    );
    writeFileSync(
      path.join(root, "clients", privateClientId, "reports/run/executive-summary.md"),
      "Generated client report",
    );

    const result = auditPublicBoundary({ root });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "blocked-term",
          status: "reviewed-private-excluded",
        }),
        expect.objectContaining({
          type: "blocked-path",
          ruleId: "notion-snapshot-content",
          status: "reviewed-private-excluded",
        }),
        expect.objectContaining({
          type: "blocked-path",
          ruleId: "generated-client-report",
          status: "reviewed-private-excluded",
        }),
      ]),
    );
  });

  it("flags Tauri resources that bundle private client roots", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "workshop-tauri-boundary-"));
    mkdirSync(path.join(root, "docs"), { recursive: true });
    mkdirSync(path.join(root, "apps/marketing-builds-desktop/src-tauri"), { recursive: true });
    writeFileSync(
      path.join(root, "docs/data-boundary-inventory.json"),
      JSON.stringify(inventory, null, 2),
    );
    writeFileSync(
      path.join(root, "apps/marketing-builds-desktop/src-tauri/tauri.conf.json"),
      JSON.stringify({
        bundle: {
          resources: ["../../../clients"],
        },
      }),
    );

    const result = auditPublicBoundary({ root });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "tauri-private-resource",
          severity: "bundle-private-client-root",
          resource: "../../../clients",
          status: "reviewed-not-public-safe",
        }),
      ]),
    );
  });

  it("allows Tauri resources that bundle only classified demo and template clients", () => {
    const result = auditPublicBoundary();
    const tauriFindings = result.findings.filter(
      (finding) => finding.type === "tauri-private-resource",
    );

    expect(tauriFindings).toEqual([]);
  });

  it("keeps MIT license metadata on publishable packages", () => {
    const licenseText = readFileSync(path.join(repoRoot, "LICENSE"), "utf8");
    const packagePaths = [
      "package.json",
      "apps/marketing-builds-desktop/package.json",
      "packages/core/package.json",
    ];

    expect(licenseText).toContain("MIT License");
    expect(licenseText).toContain("Copyright (c) 2026 Lindsay Brunner");

    for (const packagePath of packagePaths) {
      const manifest = JSON.parse(readFileSync(path.join(repoRoot, packagePath), "utf8"));
      expect(manifest.license, packagePath).toBe("MIT");
    }
  });
});
