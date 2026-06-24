import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanelView } from "./SettingsPanel";

describe("SettingsPanelView", () => {
  it("shows the blue update button when a signed update is available", () => {
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
    expect(markup).toContain("Updates check on launch and restart after install.");
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
});
