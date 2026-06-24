import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bumpWorkshopVersion, normalizeReleaseVersion } from "./bump-workshop-version.mjs";

describe("bump Workshop version", () => {
  it("normalizes release versions", () => {
    expect(normalizeReleaseVersion("v0.2.0")).toBe("0.2.0");
    expect(() => normalizeReleaseVersion("next")).toThrow("Expected a semver version");
  });

  it("updates package and Tauri config versions together", async () => {
    const root = await mkdtemp(join(tmpdir(), "workshop-version-"));
    mkdirSync(join(root, "src-tauri"));
    mkdirSync(join(root, "src/app-shell"), { recursive: true });
    const appVersionPath = join(root, "src/app-shell/appVersion.ts");
    const cargoTomlPath = join(root, "src-tauri/Cargo.toml");
    const packageJsonPath = join(root, "package.json");
    const tauriConfigPath = join(root, "src-tauri/tauri.conf.json");

    writeFileSync(appVersionPath, 'export const WORKSHOP_VERSION = "0.1.0";\n');
    writeFileSync(
      cargoTomlPath,
      ['[package]', 'name = "marketing-builds-desktop"', 'version = "0.1.0"', ""].join("\n"),
    );
    writeFileSync(packageJsonPath, `${JSON.stringify({ name: "desktop", version: "0.1.0" })}\n`);
    writeFileSync(
      tauriConfigPath,
      `${JSON.stringify({ productName: "Workshop", version: "0.1.0" })}\n`,
    );

    expect(
      bumpWorkshopVersion("v0.2.0", {
        appVersionPath,
        cargoTomlPath,
        packageJsonPath,
        tauriConfigPath,
      }),
    ).toBe("0.2.0");
    expect(readFileSync(appVersionPath, "utf8")).toBe('export const WORKSHOP_VERSION = "0.2.0";\n');
    expect(readFileSync(cargoTomlPath, "utf8")).toContain('version = "0.2.0"');
    expect(JSON.parse(readFileSync(packageJsonPath, "utf8")).version).toBe("0.2.0");
    expect(JSON.parse(readFileSync(tauriConfigPath, "utf8")).version).toBe("0.2.0");
  });
});
