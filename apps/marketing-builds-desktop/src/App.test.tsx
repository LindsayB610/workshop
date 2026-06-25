import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(testDir, "styles/app.css"), "utf8");

describe("Workshop desktop app", () => {
  it("opens to the Workshop tool shelf instead of a tool workspace", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Marketing builds");
    expect(markup).toContain("Workshop");
    expect(markup).toContain("Redline");
    expect(markup).toContain("Megaphone");
    expect(markup).toContain("Pulse");
    expect(markup).toContain("Audit client pages against trusted source packets");
    expect(markup).toContain("Plan and shape campaign messages");
    expect(markup).toContain("Track persistent recurring obligations");
    expect(markup).toContain("Redline tool actions");
    expect(markup).toContain("Megaphone tool actions");
    expect(markup).toContain("Pulse tool actions");
    expect(markup).not.toContain("Add New Tools");
    expect(markup).not.toContain(["clients", ["para", "sail"].join("")].join("/"));
    expect(markup).not.toContain("Export Reports");
    expect(markup).not.toContain("Updates check on launch.");
  });

  it("renders a differentiated logo mark for each tool", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("aria-label=\"Lindsay Brunner brand mark\"");
    expect(markup).toContain("tool-logo-redline");
    expect(markup).toContain("tool-logo-megaphone");
    expect(markup).toContain("role=\"tooltip\"");
  });

  it("includes the Lindsay Brunner brand tokens", () => {
    expect(styles).toContain("--color-red: #ff0037");
    expect(styles).toContain("--color-pink: #ff1b8d");
    expect(styles).toContain("--color-yellow: #ffdd00");
    expect(styles).toContain("--dark-bg: #000000");
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
});
