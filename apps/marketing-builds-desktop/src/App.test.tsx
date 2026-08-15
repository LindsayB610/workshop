import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(testDir, "styles/app.css"), "utf8");
const appSource = readFileSync(path.join(testDir, "App.tsx"), "utf8");
const workbenchShellSource = readFileSync(path.join(testDir, "app-shell/WorkbenchShell.tsx"), "utf8");
const toolShelfSource = readFileSync(path.join(testDir, "app-shell/ToolShelf.tsx"), "utf8");
const nativeShellSource = readFileSync(path.join(testDir, "../src-tauri/src/lib.rs"), "utf8");

describe("Workshop desktop app", () => {
  it("opens to an empty shelf and defers all tools to Add New Tools", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Personal app platform");
    expect(markup).toContain("Workshop");
    expect(markup).toContain("Add New Tools");
    expect(markup).toContain("Choose apps from Add New Tools.");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("Slate");
    expect(markup).not.toContain("Pulse");
    expect(markup).not.toContain(">Install<");
    expect(markup).not.toContain("Redline");
    expect(markup).not.toContain("Megaphone");
    expect(markup).not.toContain(["clients", ["para", "sail"].join("")].join("/"));
    expect(markup).not.toContain("Export Reports");
    expect(markup).not.toContain("Updates check on launch.");
  });

  it("does not render Slate before the user opens Add New Tools", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("aria-label=\"Workshop mark\"");
    expect(markup).not.toContain("personal brand mark");
    expect(markup).not.toContain("tool-logo-slate");
    expect(markup).not.toContain("Slate tool actions");
  });

  it("scales tool logos as a whole mark in workbench headers", () => {
    expect(styles).toContain("--tool-logo-size: 4.25rem");
    expect(styles).toContain("--tool-logo-frame-size: 2.65rem");
    expect(styles).toContain(".workspace-title .tool-logo");
    expect(styles).toContain("--tool-logo-size: 3.2rem");
    expect(styles).toContain("--tool-logo-frame-size: 2rem");
    expect(styles).not.toContain(".workspace-title .tool-logo-frame");
  });

  it("includes Workshop's default semantic appearance tokens", () => {
    expect(styles).toContain("--workshop-canvas: #000000");
    expect(styles).toContain("--workshop-accent: #ff1b8d");
    expect(styles).toContain("--workshop-accent-warm: #ffdd00");
    expect(styles).toContain("--dark-bg: var(--workshop-canvas)");
    expect(styles).toContain("Space Grotesk");
    expect(styles).toContain("font-family: \"Inter\", \"Space Grotesk\"");
  });

  it("has narrow-width navigation rules", () => {
    expect(styles).toContain("@media (max-width: 880px)");
    expect(styles).toContain("@media (max-width: 620px)");
  });

  it("does not keep the retired launcher layout styles around", () => {
    expect(styles).not.toContain(".tool-launcher");
    expect(styles).not.toContain(".tool-tile");
    expect(styles).not.toContain(".shell-sidebar");
    expect(styles).not.toContain(".tool-nav");
  });

  it("keeps workbench route controls as in-app buttons", () => {
    expect(styles).toContain(".workbench-route-nav button");
    expect(styles).toContain(".workbench-route-nav button[aria-current=\"page\"]");
    expect(styles).not.toContain(".workbench-route-nav a");
  });

  it("uses the manifest navigation contract rather than a plugin-id exception", () => {
    expect(appSource).toContain('showRouteNav={activeTool.navigationMode === "host"}');
    expect(appSource).not.toContain('activeTool.id !== "slate"');
    expect(workbenchShellSource).toContain('activeTool.navigationMode === "host"');
    expect(workbenchShellSource).not.toContain('activeTool.id !== "slate"');
  });

  it("keeps Preferences in the native Workshop menu and targets the active webview", () => {
    expect(toolShelfSource).not.toContain("preferences-trigger");
    expect(workbenchShellSource).not.toContain("preferences-trigger");
    expect(styles).not.toContain(".preferences-trigger");
    expect(appSource).toContain('listen("workshop:open-preferences", openPreferences)');
    expect(appSource).not.toContain("window.__TAURI_INTERNALS__");
    expect(nativeShellSource).toContain('app.get_webview_window("main")');
    expect(nativeShellSource).toContain("emit_workshop_menu_event(app, event.id().0.as_str())");
  });
});
