import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { tools } from "../tool-registry/tools";
import { ToolShelf } from "./ToolShelf";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(testDir, "../styles/app.css"), "utf8");

describe("ToolShelf", () => {
  it("renders Workshop as a tool picker with tooltip-backed chiclets", () => {
    const markup = renderToStaticMarkup(<ToolShelf onSelectTool={() => undefined} />);

    expect(markup).toContain("aria-label=\"Workshop tools\"");
    expect(markup).toContain("class=\"tool-chiclet\"");
    expect(markup).toContain("aria-describedby=\"redline-tooltip\"");
    expect(markup).toContain("aria-describedby=\"megaphone-tooltip\"");
    expect(markup).toContain("role=\"tooltip\"");
    expect(markup).toContain("Redline");
    expect(markup).toContain("Megaphone");
    expect(markup).toContain("Ready");
    expect(markup).toContain("Redline tool actions");
    expect(markup).toContain("Megaphone tool actions");
    expect(markup).toContain("Open workspace");
    expect(markup).toContain("Set private workspace");
    expect(markup).toContain("Use demo workspace");
    expect(markup).toContain("Demo root");
    expect(markup).toContain("clients/demo-redline");
    expect(markup).toContain("clients/demo-megaphone");
    expect(markup).toContain("Reset local state");
    expect(markup).toContain("Disable tool");
    expect(markup).toContain("target=\"_blank\"");
    expect(markup).toContain("href=\"/docs/tools/redline.md\"");
    expect(markup).toContain("href=\"/docs/tools/megaphone.md\"");
    expect(markup).toContain("Local client packets stay untouched");
    expect(markup).not.toContain("Planned");
    expect(markup).not.toContain("Add New Tools");
    expect(markup).not.toContain("Updates check on launch.");
  });

  it("shows the Add New Tools catalog when a bundled tool is disabled", () => {
    const redline = tools.find((tool) => tool.id === "redline");
    const megaphone = tools.find((tool) => tool.id === "megaphone");
    if (!redline || !megaphone) {
      throw new Error("Expected Redline and Megaphone tools.");
    }

    const markup = renderToStaticMarkup(
      <ToolShelf
        availableTools={[redline]}
        catalogInitiallyOpen
        installedTools={[megaphone]}
        onEnableTool={() => undefined}
        onSelectTool={() => undefined}
      />,
    );

    expect(markup).toContain("Add New Tools");
    expect(markup).toContain("aria-label=\"Add New Tools catalog\"");
    expect(markup).toContain("Bundled tool");
    expect(markup).toContain("Needs a local client packet");
    expect(markup).toContain("Install");
    expect(markup).toContain("href=\"/docs/tools/redline.md\"");
    expect(markup).not.toContain("Redline tool actions");
    expect(markup).toContain("Megaphone tool actions");
  });

  it("positions tool picker hover tooltips below each chiclet", () => {
    expect(styles).toContain("top: calc(100% + 0.55rem);");
    expect(styles).not.toContain("bottom: calc(100% + 0.55rem);");
  });

  it("bottom-aligns the LB mark with the Workshop title line", () => {
    expect(styles).toContain(".tool-shelf-header {\n  gap: 1rem;\n  align-items: end;");
    expect(styles).toContain(".tool-shelf-header .brand-mark {\n  margin-bottom: 0.52rem;");
  });
});
