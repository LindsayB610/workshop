import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getToolById } from "../tool-registry/tools";
import { WorkbenchShell } from "./WorkbenchShell";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(testDir, "../styles/app.css"), "utf8");

describe("WorkbenchShell", () => {
  it("renders active tool routes as shared workbench navigation", () => {
    const megaphone = getToolById("megaphone");

    if (!megaphone) {
      throw new Error("Megaphone tool is not registered.");
    }

    const markup = renderToStaticMarkup(
      <WorkbenchShell activeTool={megaphone} onBackToTools={() => undefined}>
        <p>Megaphone body</p>
      </WorkbenchShell>,
    );

    expect(markup).toContain("aria-label=\"Megaphone functions\"");
    expect(markup).toContain("data-route-path=\"/megaphone/sources\"");
    expect(markup).not.toContain("aria-controls=");
    expect(markup).toContain("type=\"button\"");
    expect(markup).not.toContain("href=\"/megaphone/sources\"");
    expect(markup).toContain("aria-current=\"page\"");
    expect(markup).toContain("Sources");
    expect(markup).toContain("Strategy");
    expect(markup).toContain("Briefs");
    expect(markup).toContain("Drafts");
    expect(markup).toContain("Calendar");
    expect(markup).toContain("Measurement");
  });

  it("shows the shared connector and local capability status strip", () => {
    const megaphone = getToolById("megaphone");

    if (!megaphone) {
      throw new Error("Megaphone tool is not registered.");
    }

    const markup = renderToStaticMarkup(
      <WorkbenchShell activeTool={megaphone} onBackToTools={() => undefined}>
        <p>Megaphone body</p>
      </WorkbenchShell>,
    );

    expect(markup).toContain("Shared connector status");
    expect(markup).toContain("Local workspace");
    expect(markup).toContain("Connector status");
    expect(markup).toContain("File import");
    expect(markup).toContain("Report export");
    expect(markup).toContain("Pending workflow");
  });

  it("keeps plugin-owned navigation tools free of the shared workspace status strip", () => {
    const slate = getToolById("slate");

    if (!slate) {
      throw new Error("Slate tool is not registered.");
    }

    const markup = renderToStaticMarkup(
      <WorkbenchShell activeTool={slate} onBackToTools={() => undefined}>
        <p>Slate body</p>
      </WorkbenchShell>,
    );

    expect(markup).not.toContain("Shared connector status");
    expect(markup).not.toContain("Local workspace");
  });

  it("renders Redline routes as function screen controls", () => {
    const redline = getToolById("redline");

    if (!redline) {
      throw new Error("Redline tool is not registered.");
    }

    const markup = renderToStaticMarkup(
      <WorkbenchShell activeTool={redline} onBackToTools={() => undefined}>
        <p>Redline body</p>
      </WorkbenchShell>,
    );

    expect(markup).toContain("aria-label=\"Redline functions\"");
    expect(markup).toContain("data-route-path=\"/redline/audit\"");
    expect(markup).not.toContain("aria-controls=");
  });

  it("leaves Pulse navigation to its plugin", () => {
    const pulse = getToolById("pulse");

    if (!pulse) {
      throw new Error("Pulse tool is not registered.");
    }

    const markup = renderToStaticMarkup(
      <WorkbenchShell activeTool={pulse} onBackToTools={() => undefined}>
        <p>Pulse body</p>
      </WorkbenchShell>,
    );

    expect(markup).not.toContain("aria-label=\"Pulse functions\"");
    expect(markup).not.toContain("data-route-path=\"/pulse/");
    expect(markup).toContain("Pulse body");
  });

  it("gives every tool view a shared, responsive left reading inset", () => {
    expect(styles).toContain("--workshop-app-left-inset: clamp(2.5rem, 5vw, 5rem);");
    expect(styles).toContain("padding: 1rem 1.25rem 1rem var(--workshop-app-left-inset);");
    expect(styles).toContain(".shell-main,\n  .tool-shelf-screen {\n    padding: 0.75rem;");
  });
});
