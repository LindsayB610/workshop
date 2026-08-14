import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanelView } from "./SettingsPanel";

const testDir = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(testDir, "../styles/app.css"), "utf8");

describe("SettingsPanelView", () => {
  it("shows the Pulse-style update button when a signed update is available", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanelView
        updateState={{
          currentVersion: "0.1.5",
          latestVersion: "0.2.0",
          notes: "Release notes.",
          status: "available",
        }}
        onInstallUpdate={vi.fn()}
      />,
    );

    expect(markup).toContain("update-available-button");
    expect(markup).toContain("Install and restart");
    expect(markup).toContain("Update ready");
    expect(markup).toContain("v0.2.0 is available");
    expect(markup).toContain("Installing it will restart Workshop.");
  });

  it("keeps install controls hidden when no update is available", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanelView
        updateState={{ currentVersion: "0.1.5", status: "not_available" }}
        onInstallUpdate={vi.fn()}
      />,
    );

    expect(markup).not.toContain("update-available-button");
    expect(markup).toContain("you&#x27;re up to date");
    expect(markup).not.toContain("not_available");
    expect(markup).toContain("Checks daily while Workshop is open and restarts after install.");
  });

  it("renders nothing in actionable mode when no update is available", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanelView
        updateState={{ currentVersion: "0.1.5", status: "not_available" }}
        onInstallUpdate={vi.fn()}
        visibility="actionable"
      />,
    );

    expect(markup).toBe("");
  });

  it("shows the update button in actionable mode when an update is available", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanelView
        updateState={{
          currentVersion: "0.1.5",
          latestVersion: "0.2.0",
          notes: "Release notes.",
          status: "available",
        }}
        onInstallUpdate={vi.fn()}
        visibility="actionable"
      />,
    );

    expect(markup).toContain("update-available-button");
    expect(markup).toContain("Install and restart");
  });

  it("shows visible progress while an update is installing", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanelView
        updateState={{
          currentVersion: "0.1.5",
          latestVersion: "0.2.0",
          status: "installing",
        }}
        onInstallUpdate={vi.fn()}
        visibility="actionable"
      />,
    );

    expect(markup).toContain("Installing and restarting");
    expect(markup).toContain("disabled=\"\"");
  });

  it("tells the user Workshop should restart automatically after install", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanelView
        updateState={{
          currentVersion: "0.1.5",
          latestVersion: "0.2.0",
          status: "installed",
        }}
        onInstallUpdate={vi.fn()}
        visibility="actionable"
      />,
    );

    expect(markup).toContain("Update installed");
    expect(markup).toContain("Workshop should restart automatically.");
  });

  it("keeps the update action aligned with Pulse’s primary-button feedback", () => {
    expect(styles).toMatch(/\.update-available-button\s*\{[^}]*background:\s*#ffe600[^}]*box-shadow:\s*0 7px 24px rgba\(255, 230, 0, 0\.14\)/s);
    expect(styles).toMatch(/\.update-available-button:hover:not\(:disabled\)\s*\{[^}]*background:\s*#fff04a/s);
    expect(styles).toMatch(/\.update-available-button:active:not\(:disabled\)\s*\{[^}]*transform:\s*translateY\(1px\)/s);
    expect(styles).toMatch(/\.settings-panel\s*\{[^}]*max-width:\s*65rem/s);
  });
});
