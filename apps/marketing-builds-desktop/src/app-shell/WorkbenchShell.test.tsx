import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getToolById } from "../tool-registry/tools";
import { WorkbenchShell } from "./WorkbenchShell";

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

  it("renders Pulse routes as self-hosted function screen controls", () => {
    const pulse = getToolById("pulse");

    if (!pulse) {
      throw new Error("Pulse tool is not registered.");
    }

    const markup = renderToStaticMarkup(
      <WorkbenchShell activeTool={pulse} onBackToTools={() => undefined}>
        <p>Pulse body</p>
      </WorkbenchShell>,
    );

    expect(markup).toContain("aria-label=\"Pulse functions\"");
    expect(markup).toContain("data-route-path=\"/pulse/active\"");
    expect(markup).toContain("data-route-path=\"/pulse/runner\"");
    expect(markup).toContain("Active");
    expect(markup).toContain("Schedule");
    expect(markup).toContain("History");
    expect(markup).toContain("Runner");
  });
});
