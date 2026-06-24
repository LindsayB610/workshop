import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getToolById } from "../../tool-registry/tools";
import { RedlineTool } from "./RedlineTool";

const redlineTool = getToolById("redline");

describe("RedlineTool", () => {
  it("renders Redline as a tool view with client switching available", () => {
    if (!redlineTool) {
      throw new Error("Redline tool is not registered.");
    }

    const markup = renderToStaticMarkup(<RedlineTool tool={redlineTool} />);

    expect(markup).toContain("Northstar Demo Co.");
    expect(markup).toContain("clients/demo-redline");
    expect(markup).toContain("Fixture Client");
    expect(markup).toContain("Client workspaces");
    expect(markup).toContain("Add new Redline client");
    expect(markup).toContain("Audit");
    expect(markup).not.toContain("Redline workspace sections");
  });

  it("renders Phase 11 local workflow controls", () => {
    if (!redlineTool) {
      throw new Error("Redline tool is not registered.");
    }

    const markup = renderToStaticMarkup(<RedlineTool tool={redlineTool} />);

    expect(markup).toContain("Audit target");
    expect(markup).toContain("Open Packet");
    expect(markup).toContain("Run Audit");
    expect(markup).toContain("Snapshot Live URL");
    expect(markup).toContain("Export Reports");
    expect(markup).toContain("Open Reports");
    expect(markup).toContain("saved fixture, local file, pasted draft, or queued URL");
    expect(markup).toContain("Role: current_reproducible_audit_target");
    expect(markup).not.toContain("Review Queue");
    expect(markup).not.toContain("Packet Health");
    expect(markup).not.toContain("Available in Phase 11");
    expect(markup).not.toContain("Report export and artifact opening are disabled");
  });

  it("renders available report artifacts as openable rows", () => {
    if (!redlineTool) {
      throw new Error("Redline tool is not registered.");
    }

    const markup = renderToStaticMarkup(<RedlineTool tool={redlineTool} />);

    expect(markup).toContain("Open Reports");
    expect(markup).not.toContain("executive-summary.md");
    expect(markup).not.toContain("Opening will be wired");
  });

  it("keeps the Phase 13 review workspace behind an explicit function screen", () => {
    if (!redlineTool) {
      throw new Error("Redline tool is not registered.");
    }

    const markup = renderToStaticMarkup(<RedlineTool tool={redlineTool} />);

    expect(markup).not.toContain("Review Queue");
    expect(markup).not.toContain("Review filters");
    expect(markup).not.toContain("Copy Brief");
    expect(markup).not.toContain("Available in Phase 13");
  });

  it("renders only the selected Redline function screen", () => {
    if (!redlineTool) {
      throw new Error("Redline tool is not registered.");
    }

    const reviewMarkup = renderToStaticMarkup(
      <RedlineTool activeRouteId="review" tool={redlineTool} />,
    );

    expect(reviewMarkup).toContain("Review Queue");
    expect(reviewMarkup).not.toContain("Run Audit");
    expect(reviewMarkup).not.toContain("Packet Health");

    const packetMarkup = renderToStaticMarkup(
      <RedlineTool activeRouteId="packet" tool={redlineTool} />,
    );

    expect(packetMarkup).toContain("Packet Health");
    expect(packetMarkup).not.toContain("Review Queue");
    expect(packetMarkup).not.toContain("Run Audit");
  });
});
