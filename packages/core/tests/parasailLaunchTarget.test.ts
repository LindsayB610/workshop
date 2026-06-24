import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { extractPageFromHtml } from "../src/extract.js";
import { privateFixtureDescribe } from "./privateFixtures.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const parasailDir = path.join(repoRoot, "clients/parasail");
const launchedFixturePath = path.join(
  parasailDir,
  "targets/fixtures/launched-production-homepage-2026-06-22.html",
);
const launchedTextPath = path.join(
  parasailDir,
  "targets/extracted/launched-production-homepage-2026-06-22.txt",
);
const previousFixturePath = path.join(
  parasailDir,
  "targets/fixtures/current-production-homepage-2026-06-20.html",
);
const sitePagesPath = path.join(parasailDir, "targets/site-pages.yaml");
const sourceManifestPath = path.join(parasailDir, "source-manifest.json");

function sha256ForFile(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

privateFixtureDescribe("Parasail launched homepage target", () => {
  it("loads and extracts the launched production homepage deterministically", () => {
    const page = extractPageFromHtml({
      id: "launched-production-homepage-2026-06-22",
      url: "https://www.parasail.io/",
      html: readFileSync(launchedFixturePath, "utf8"),
    });

    expect(page.title).toBe("Parasail — The Inference Cloud for AI-native startups");
    expect(page.metaDescription).toContain("The managed inference partner");
    expect(page.headings).toEqual(
      expect.arrayContaining([
        "The Inference Cloud for AI-native startups",
        "Inference that scales with you",
        "What our customers are saying",
        "One API for any model",
        "Questions, answered",
      ]),
    );
    expect(page.bodyText).toContain("750B");
    expect(page.bodyText).toContain("30×");
    expect(page.bodyText).toContain("Cheaper than legacy clouds");
    expect(page.bodyText).toContain("Day 0");
    expect(page.bodyText).toContain("Day-0 access to frontier open models");
    expect(page.wordCount).toBeGreaterThan(700);
    expect(page.isEmptyShell).toBe(false);
  });

  it("keeps the June 20 baseline fixture available for before and after comparison", () => {
    const previousPage = extractPageFromHtml({
      id: "previous-production-homepage-2026-06-20",
      url: "https://parasail.io/",
      html: readFileSync(previousFixturePath, "utf8"),
    });
    const launchedPage = extractPageFromHtml({
      id: "launched-production-homepage-2026-06-22",
      url: "https://www.parasail.io/",
      html: readFileSync(launchedFixturePath, "utf8"),
    });

    expect(previousPage.bodyText).toContain("No limits. No contracts. Priced right.");
    expect(previousPage.bodyText).toContain("10B+ tokens");
    expect(launchedPage.title).not.toBe(previousPage.title);
    expect(launchedPage.bodyText).toContain("Trusted by these companies");
  });

  it("documents the launched homepage as an audit target, not source truth", () => {
    const sitePages = readFileSync(sitePagesPath, "utf8");
    const sourceManifest = readFileSync(sourceManifestPath, "utf8");

    expect(sitePages).toContain("launched-production-homepage-2026-06-22-fixture");
    expect(sitePages).toContain("role: current_reproducible_audit_target");
    expect(sitePages).toContain(
      "Audit target only; do not cite as canonical messaging evidence.",
    );
    expect(sourceManifest).not.toContain("launched-production-homepage-2026-06-22");
  });

  it("keeps launched fixture and extracted text checksums stable", () => {
    expect(sha256ForFile(launchedFixturePath)).toBe(
      "6647ea3b7cc8d2de04a3185669f25a97324958e8fc4b48f6f0c15437e82192aa",
    );
    expect(sha256ForFile(launchedTextPath)).toBe(
      "4339400561d748859de3aa27ac988a9fad137a5b0e92b1daf5ebdf08c08910bc",
    );
  });
});
