import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { summarizeCanonicalReadiness } from "../src/canonical.js";
import { extractPageFromHtml, pageIncludesExactQuote } from "../src/extract.js";
import { loadClientPacket } from "../src/loadClientPacket.js";
import {
  buildParasailLaunchDeltaReport,
  createParasailLaunchDeltaFindings,
  createParasailLaunchDeltaItems,
} from "../src/parasailLaunchDelta.js";
import { privateFixtureDescribe } from "./privateFixtures.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const parasailDir = path.join(repoRoot, "clients/parasail");
const launchedFixturePath = path.join(
  parasailDir,
  "targets/fixtures/launched-production-homepage-2026-06-22.html",
);
const launchedReportDir = path.join(
  parasailDir,
  "reports/launch-delta-2026-06-22",
);

async function buildLaunchDeltaReport() {
  const packet = await loadClientPacket(parasailDir);
  const page = extractPageFromHtml({
    id: "launched-production-homepage-2026-06-22",
    url: "https://www.parasail.io/",
    html: readFileSync(launchedFixturePath, "utf8"),
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

  return buildParasailLaunchDeltaReport({
    page,
    findings: createParasailLaunchDeltaFindings(),
    sourceReadiness,
    deltaItems: createParasailLaunchDeltaItems(),
  });
}

privateFixtureDescribe("Parasail launch delta audit", () => {
  it("audits the launched homepage with exact launched-page quotes", () => {
    const page = extractPageFromHtml({
      id: "launched-production-homepage-2026-06-22",
      url: "https://www.parasail.io/",
      html: readFileSync(launchedFixturePath, "utf8"),
    });

    expect(page.bodyText).toContain("The Inference Cloud for AI-native startups");

    for (const finding of createParasailLaunchDeltaFindings()) {
      expect(finding.targetId).toBe("launched-production-homepage-2026-06-22");
      expect(pageIncludesExactQuote(page, finding.quotedText)).toBe(true);
    }
  });

  it("classifies baseline findings without falsely carrying retired findings forward", () => {
    const findings = createParasailLaunchDeltaFindings();
    const labels = findings.map((finding) => finding.label);
    const deltaItems = createParasailLaunchDeltaItems();

    expect(labels).not.toEqual(
      expect.arrayContaining([
        "Hero is too generic for the new ICP",
        "Dedicated Serverless is underused as the strategic bridge",
        "Use-case section leans broad instead of buyer-pain specific",
      ]),
    );
    expect(deltaItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "resolved_from_prior_baseline",
          priorFindingId: "parasail-homepage-f1",
        }),
        expect.objectContaining({
          classification: "still_open",
          priorFindingId: "parasail-homepage-f3",
        }),
        expect.objectContaining({
          classification: "new_issue_introduced_by_launch",
          label: "750B token metric adds a new approval dependency",
        }),
        expect.objectContaining({
          classification: "claim_proof_approval_needed",
        }),
      ]),
    );
  });

  it("routes high-risk launch claims to proof or client approval", async () => {
    const report = await buildLaunchDeltaReport();
    const agentEditPlan = JSON.parse(report.agentEditPlanJson);

    expect(agentEditPlan.runId).toBe("parasail-launch-delta-2026-06-22");
    expect(agentEditPlan.targets).toEqual([
      expect.objectContaining({ id: "launched-production-homepage-2026-06-22" }),
    ]);
    expect(agentEditPlan.publicClaimFlags.map((claim: { claimId: string }) => claim.claimId))
      .toEqual([
        "claim-750b-tokens-daily",
        "claim-30x-cheaper",
        "claim-day-0-frontier-models",
        "claim-26-data-centers-15-regions",
        "claim-same-day-endpoints",
        "claim-customer-quotes",
      ]);
    expect(agentEditPlan.publicClaimFlags[0]).toMatchObject({
      claimCategory: "metric",
      approvalStatus: "needs_client_approval",
      proofOwner: "Parasail client proof owner",
      canAgentEdit: false,
    });
    expect(agentEditPlan.proofGateSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "parasail-launch-f1",
          claimCategory: "metric",
          approvalStatus: "needs_client_approval",
          proofOwner: "Parasail client proof owner",
          canAgentEdit: false,
        }),
        expect.objectContaining({
          id: "parasail-launch-f6",
          claimCategory: "support_sla_promise",
          canAgentEdit: true,
          instruction:
            "Rewrite structure only. Do not add new response-time, Slack, or staffing promises.",
        }),
      ]),
    );
    expect(agentEditPlan.openQuestions.map((item: { findingId: string }) => item.findingId))
      .toEqual(
        expect.arrayContaining([
          "parasail-launch-f1",
          "parasail-launch-f2",
          "parasail-launch-f3",
          "parasail-launch-f4",
          "parasail-launch-f5",
        ]),
      );
    expect(agentEditPlan.openQuestions.map((item: { findingId: string }) => item.findingId))
      .not.toContain("parasail-launch-f6");
  });

  it("generates a client-usable launch delta report bundle", async () => {
    const report = await buildLaunchDeltaReport();

    expect(report.executiveSummary).toContain(
      "Parasail Launch Delta Audit - Executive Summary",
    );
    expect(report.pageRedlines).toContain("750B daily-token claim needs approved public proof");
    expect(report.findingsCsv).toContain("parasail-launch-f1");
    expect(report.openQuestions).toContain("claim-750b-tokens-daily");
    expect(report.proofGateSummary).toContain("parasail-launch-f1");
    expect(report.proofGateSummary).toContain("Claim category: metric");
    expect(report.proofGateSummary).toContain("Can agent edit: false");
    expect(report.sourceReadiness).toContain("| proof-library | partial |");
    expect(report.editBrief).toContain(
      "parasail parasail-launch-delta-2026-06-22 - Edit Brief",
    );
    expect(report.launchDelta).toContain("Resolved From Prior Baseline");
    expect(report.launchDelta).toContain("Claim / Proof Approval Needed");
  });

  it("keeps checked-in Phase 15 artifacts synchronized with the generator", async () => {
    const report = await buildLaunchDeltaReport();

    expect(
      readFileSync(path.join(launchedReportDir, "executive-summary.md"), "utf8"),
    ).toBe(report.executiveSummary);
    expect(
      readFileSync(path.join(launchedReportDir, "page-redlines.md"), "utf8"),
    ).toBe(report.pageRedlines);
    expect(
      readFileSync(path.join(launchedReportDir, "source-readiness.md"), "utf8"),
    ).toBe(report.sourceReadiness);
    expect(
      readFileSync(path.join(launchedReportDir, "agent-edit-plan.json"), "utf8"),
    ).toBe(`${report.agentEditPlanJson}\n`);
    expect(
      readFileSync(path.join(launchedReportDir, "findings.csv"), "utf8"),
    ).toBe(report.findingsCsv);
    expect(
      readFileSync(path.join(launchedReportDir, "open-questions.md"), "utf8"),
    ).toBe(report.openQuestions);
    expect(
      readFileSync(path.join(launchedReportDir, "edit-brief.md"), "utf8"),
    ).toBe(report.editBrief);
    expect(
      readFileSync(path.join(launchedReportDir, "launch-delta.md"), "utf8"),
    ).toBe(report.launchDelta);
    expect(
      readFileSync(path.join(launchedReportDir, "proof-gate-summary.md"), "utf8"),
    ).toBe(report.proofGateSummary);
  });
});
