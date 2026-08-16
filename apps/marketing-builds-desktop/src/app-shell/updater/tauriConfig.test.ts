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
const nativeHostPath = resolve(testDir, "../../../src-tauri/src/lib.rs");
const iconSourcePath = resolve(testDir, "../../../src-tauri/icons/workshop-mark.svg");
const iconPath = resolve(testDir, "../../../src-tauri/icons/icon.png");

describe("Workshop updater Tauri config", () => {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const capabilities = JSON.parse(readFileSync(capabilitiesPath, "utf8"));
  const cargoToml = readFileSync(cargoTomlPath, "utf8");
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
  const nativeHost = readFileSync(nativeHostPath, "utf8");
  const iconSource = readFileSync(iconSourcePath, "utf8");
  const icon = readFileSync(iconPath);

  it("keeps package, Tauri, and UI versions synchronized", () => {
    expect(tauriConfig.version).toBe(packageJson.version);
    expect(WORKSHOP_VERSION).toBe(packageJson.version);
  });

  it("generates signed updater artifacts during desktop builds", () => {
    expect(tauriConfig.bundle.createUpdaterArtifacts).toBe(true);
  });

  it("ships a clean, composed drag-to-Applications DMG installer", () => {
    const dmg = tauriConfig.bundle.macOS.dmg;

    expect(dmg).toEqual({
      windowSize: { width: 640, height: 400 },
      appPosition: { x: 170, y: 160 },
      applicationFolderPosition: { x: 470, y: 160 },
    });
    expect(dmg).not.toHaveProperty("background");
  });

  it("ships the fixed borderless Workshop mark as a transparent macOS app icon", () => {
    expect(tauriConfig.bundle.icon).toContain("icons/icon.png");
    expect(iconSource).toContain('aria-label="Workshop mark"');
    expect(iconSource).toContain('stroke="#FF1B8D"');
    expect(iconSource).toContain('stroke="#FFD900"');
    expect(iconSource).not.toContain("<rect");
    expect(iconSource).not.toMatch(/>LB</);
    expect(icon.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(icon.readUInt32BE(16)).toBe(512);
    expect(icon.readUInt32BE(20)).toBe(512);
    expect(icon[25]).toBe(6); // RGBA: transparent canvas, no icon container.
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
    expect(packageJson.dependencies["@tauri-apps/plugin-opener"]).toBeDefined();
    expect(cargoToml).toContain("tauri-plugin-process");
    expect(cargoToml).toContain("tauri-plugin-opener");
    expect(capabilities.permissions).toContain("process:allow-restart");
    expect(capabilities.permissions).toContain("opener:default");
  });

  it("keeps the native directory picker in Workshop with only open-dialog permission", () => {
    expect(packageJson.dependencies["@tauri-apps/plugin-dialog"]).toBeDefined();
    expect(cargoToml).toContain("tauri-plugin-dialog");
    expect(nativeHost).toContain("tauri_plugin_dialog::init()");
    expect(capabilities.permissions).toContain("dialog:allow-open");
    expect(capabilities.permissions).not.toContain("dialog:allow-save");
  });
});
