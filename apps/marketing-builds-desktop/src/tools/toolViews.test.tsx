import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getToolById } from "../tool-registry/tools";
import { getToolViewById, ToolView } from "./toolViews";

describe("tool views", () => {
  it("renders Redline through the shared tool view registry", () => {
    const redline = getToolById("redline");

    if (!redline) {
      throw new Error("Redline tool is not registered.");
    }

    const markup = renderToStaticMarkup(<ToolView tool={redline} />);

    expect(markup).toContain("Client workspaces");
    expect(markup).toContain("Run Audit");
  });

  it("renders Megaphone through the shared tool view registry", () => {
    const megaphone = getToolById("megaphone");

    if (!megaphone) {
      throw new Error("Megaphone tool is not registered.");
    }

    const markup = renderToStaticMarkup(<ToolView tool={megaphone} />);

    expect(markup).toContain("Megaphone");
    expect(markup).toContain("Client Mode");
    expect(markup).not.toContain("Active Post Package");
    expect(markup).not.toContain("empty-tool");
  });

  it("exposes the fallback view for every registered tool id", () => {
    expect(getToolViewById("redline")).toBeDefined();
    expect(getToolViewById("megaphone")).toBeDefined();
    expect(getToolViewById("missing-tool")).toBeUndefined();
  });
});
