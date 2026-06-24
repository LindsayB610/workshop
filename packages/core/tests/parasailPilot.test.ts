import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { summarizeCanonicalReadiness } from "../src/canonical.js";
import { extractPageFromHtml, pageIncludesExactQuote } from "../src/extract.js";
import { loadClientPacket } from "../src/loadClientPacket.js";
import {
  buildParasailHomepagePilotReport,
  createParasailHomepagePilotFindings,
} from "../src/parasailPilot.js";
import { privateFixtureDescribe } from "./privateFixtures.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const parasailDir = path.join(repoRoot, "clients/parasail");
const fixturePath = path.join(
  parasailDir,
  "targets/fixtures/current-production-homepage-2026-06-20.html",
);

async function buildPilotReport() {
  const packet = await loadClientPacket(parasailDir);
  const page = extractPageFromHtml({
    id: "current-production-homepage",
    url: "https://parasail.io/",
    html: readFileSync(fixturePath, "utf8"),
  });
  const readiness = summarizeCanonicalReadiness(
    packet.manifest,
    packet.client.requiredCanonicalModules,
  );
  const sourceReadiness = [
    ...readiness.strong.map((moduleId) => ({ moduleId, readiness: "strong" as const })),
    ...readiness.partial.map((moduleId) => ({
      moduleId,
      readiness: "partial" as const,
    })),
    ...readiness.missing.map((moduleId) => ({
      moduleId,
      readiness: "missing" as const,
    })),
  ];

  return buildParasailHomepagePilotReport({
    page,
    findings: createParasailHomepagePilotFindings(),
    sourceReadiness,
  });
}

privateFixtureDescribe("Parasail homepage pilot", () => {
  it("audits a saved homepage fixture with exact quoted text", () => {
    const html = readFileSync(fixturePath, "utf8");
    const page = extractPageFromHtml({
      id: "current-production-homepage",
      url: "https://parasail.io/",
      html,
    });
    const findings = createParasailHomepagePilotFindings();

    expect(page.title).toBe("Parasail - AI Inference Network");
    expect(page.bodyText).toContain("No limits. No contracts. Priced right.");

    for (const finding of findings) {
      expect(pageIncludesExactQuote(page, finding.quotedText)).toBe(true);
    }
  });

  it("preserves the known manual-audit findings as regression expectations", () => {
    const labels = createParasailHomepagePilotFindings().map(
      (finding) => finding.label,
    );

    expect(labels).toEqual(
      expect.arrayContaining([
        "Hero is too generic for the new ICP",
        "Dedicated Serverless is underused as the strategic bridge",
        "Engineering support is present but buried",
        "Fastest and cheapest claims need approved proof",
        "Use-case section leans broad instead of buyer-pain specific",
      ]),
    );
  });

  it("requires every high-priority finding to cite page text and source refs", () => {
    const highPriority = createParasailHomepagePilotFindings().filter(
      (finding) => finding.priority === "high",
    );

    expect(highPriority.length).toBeGreaterThan(0);
    for (const finding of highPriority) {
      expect(finding.quotedText).toBeTruthy();
      expect(finding.sourceRefs.length).toBeGreaterThan(0);
      expect(finding.sourceRefs).toEqual(
        expect.arrayContaining(["parasail-source-homepage-baseline-audit"]),
      );
    }
  });

  it("routes weak or unapproved proof to open questions or manual review", () => {
    const proofFindings = createParasailHomepagePilotFindings().filter(
      (finding) => finding.mode === "proof_gap",
    );

    expect(proofFindings).toHaveLength(2);
    expect(proofFindings.map((finding) => finding.editReadiness)).toEqual(
      expect.arrayContaining(["open_question", "manual_review"]),
    );
  });

  it("generates the Phase 3 report bundle outputs", async () => {
    const report = await buildPilotReport();
    const agentEditPlan = JSON.parse(report.agentEditPlanJson);

    expect(report.executiveSummary).toContain(
      "Parasail Homepage Pilot - Executive Summary",
    );
    expect(report.pageRedlines).toContain("Hero is too generic for the new ICP");
    expect(report.sourceReadiness).toContain("| proof-library | partial |");
    expect(report.findingsCsv).toContain("parasail-homepage-f1");
    expect(report.openQuestions).toContain("claim-30x-cheaper");
    expect(report.editBrief).toContain("parasail homepage-pilot - Edit Brief");
    expect(agentEditPlan.findings).toHaveLength(6);
  });

  it("keeps checked-in Phase 3 artifacts synchronized with the generator", async () => {
    const report = await buildPilotReport();

    expect(
      readFileSync(
        path.join(parasailDir, "reports/homepage-pilot/executive-summary.md"),
        "utf8",
      ),
    ).toBe(report.executiveSummary);
    expect(
      readFileSync(
        path.join(parasailDir, "reports/homepage-pilot/page-redlines.md"),
        "utf8",
      ),
    ).toBe(report.pageRedlines);
    expect(
      readFileSync(
        path.join(parasailDir, "reports/homepage-pilot/source-readiness.md"),
        "utf8",
      ),
    ).toBe(report.sourceReadiness);
    expect(
      readFileSync(
        path.join(parasailDir, "reports/homepage-pilot/agent-edit-plan.json"),
        "utf8",
      ),
    ).toBe(`${report.agentEditPlanJson}\n`);
    expect(
      readFileSync(
        path.join(parasailDir, "reports/homepage-pilot/findings.csv"),
        "utf8",
      ),
    ).toBe(report.findingsCsv);
    expect(
      readFileSync(
        path.join(parasailDir, "reports/homepage-pilot/open-questions.md"),
        "utf8",
      ),
    ).toBe(report.openQuestions);
    expect(
      readFileSync(
        path.join(parasailDir, "reports/homepage-pilot/edit-brief.md"),
        "utf8",
      ),
    ).toBe(`${report.editBrief}\n`);
  });
});
