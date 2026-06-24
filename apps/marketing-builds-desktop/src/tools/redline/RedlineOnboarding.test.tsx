import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RedlineOnboarding } from "./RedlineOnboarding";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(testDir, "../../styles/app.css"), "utf8");

describe("RedlineOnboarding", () => {
  it("renders the guided onboarding path and required setup fields", () => {
    const markup = renderToStaticMarkup(<RedlineOnboarding />);

    expect(markup).toContain("Redline onboarding workflow");
    expect(markup).toContain("Client Setup");
    expect(markup).toContain("Client name");
    expect(markup).toContain("Client folder");
    expect(markup).toContain("Primary audience");
    expect(markup).toContain("Exclusions");
    expect(markup).not.toContain("readOnly");
  });

  it("renders source intake, trust review, canonical review, and export preview", () => {
    const markup = renderToStaticMarkup(<RedlineOnboarding />);

    expect(markup).toContain("Source Intake");
    expect(markup).toContain("Trust Review");
    expect(markup).toContain("possibly_stale");
    expect(markup).toContain("Canonical Drafts");
    expect(markup).toContain("Packet Export");
    expect(markup).toContain("Export Packet");
    expect(markup).toContain("clients/demo-onboarding-draft/client.yaml");
    expect(markup).toContain("clients/demo-onboarding-draft/source-manifest.json");
    expect(markup).toContain(
      "clients/demo-onboarding-draft/prompts/messaging-alignment.yaml",
    );
    expect(markup).toContain("Existing files are not overwritten.");
  });

  it("keeps the onboarding surface responsive in Workshop styles", () => {
    expect(styles).toContain(".onboarding-grid");
    expect(styles).toContain(".onboarding-field-grid");
    expect(styles).toContain(".onboarding-brief-panel pre");
    expect(styles).toContain("@media (max-width: 880px)");
  });
});
