import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WORKSHOP_VERSION } from "../appVersion";
import { WORKSHOP_UPDATE_ENDPOINT } from "./updateMetadata";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(testDir, "../../../package.json");
const cargoTomlPath = resolve(testDir, "../../../src-tauri/Cargo.toml");
const capabilitiesPath = resolve(testDir, "../../../src-tauri/capabilities/default.json");
const tauriConfigPath = resolve(testDir, "../../../src-tauri/tauri.conf.json");

describe("Workshop updater Tauri config", () => {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const capabilities = JSON.parse(readFileSync(capabilitiesPath, "utf8"));
  const cargoToml = readFileSync(cargoTomlPath, "utf8");
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));

  it("keeps package, Tauri, and UI versions synchronized", () => {
    expect(tauriConfig.version).toBe(packageJson.version);
    expect(WORKSHOP_VERSION).toBe(packageJson.version);
  });

  it("generates signed updater artifacts during desktop builds", () => {
    expect(tauriConfig.bundle.createUpdaterArtifacts).toBe(true);
  });

  it("bundles only safe demo and template client artifacts", () => {
    const privateClientId = ["para", "sail"].join("");

    expect(tauriConfig.bundle.resources).toEqual(
      expect.arrayContaining([
        "../../../clients/demo-redline",
        "../../../clients/demo-megaphone",
        "../../../clients/fixture",
        "../../../clients/template-redline",
        "../../../clients/template-megaphone",
      ]),
    );
    expect(tauriConfig.bundle.resources).not.toContain("../../../clients");
    expect(tauriConfig.bundle.resources.join("\n").toLowerCase()).not.toContain(privateClientId);
  });

  it("pins a public updater key and the Workshop update endpoint", () => {
    expect(tauriConfig.plugins.updater.pubkey).toMatch(/^dW50cnVzdGVk/);
    expect(tauriConfig.plugins.updater.endpoints).toEqual([WORKSHOP_UPDATE_ENDPOINT]);
  });

  it("allows installed updates to restart Workshop automatically", () => {
    expect(packageJson.dependencies["@tauri-apps/plugin-process"]).toBeDefined();
    expect(cargoToml).toContain("tauri-plugin-process");
    expect(capabilities.permissions).toContain("process:allow-restart");
  });
});
