import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateReportBundle,
  sortFindingsForReport,
  type ReportBundleInput,
} from "../src/report.js";
import { reportBundleSchema, type Finding } from "../src/schemas.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const goldenDir = path.join(testDir, "fixtures/report-system");

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "finding-low",
    clientId: "fixture",
    targetId: "pricing",
    url: "https://example.test/pricing",
    mode: "buyer_language",
    label: "Pricing language is generic",
    priority: "low",
    confidence: "medium",
    quotedText: "Simple pricing for every team.",
    issue: "The pricing page does not reflect buyer-specific triggers.",
    suggestedFix: "Anchor pricing copy to workload urgency and approval paths.",
    sourceRefs: ["source-buyer-language"],
    proofNeeded: "Confirm pricing proof with sales.",
    editReadiness: "ready",
    ...overrides,
  };
}

function reportInput(): ReportBundleInput {
  return {
    clientId: "fixture",
    runId: "run-2026-06-20",
    generatedAt: "2026-06-20T12:00:00.000Z",
    title: "Fixture Audit",
    pages: [
      {
        id: "pricing",
        url: "https://example.test/pricing",
        title: "Pricing",
        metaDescription: "",
        canonicalUrl: "",
        lastModified: "",
        publishedDate: "",
        headings: ["Pricing"],
        bodyText: "Simple pricing for every team.",
        wordCount: 5,
        isEmptyShell: false,
        links: [],
      },
      {
        id: "homepage",
        url: "https://example.test/",
        title: "Home",
        metaDescription: "",
        canonicalUrl: "",
        lastModified: "",
        publishedDate: "",
        headings: ["Home"],
        bodyText: "Old hero claim.",
        wordCount: 3,
        isEmptyShell: false,
        links: [],
      },
    ],
    findings: [
      finding(),
      finding({
        id: "finding-high",
        targetId: "homepage",
        url: "https://example.test/",
        mode: "proof_gap",
        label: "Hero claim needs proof",
        priority: "high",
        confidence: "high",
        quotedText: "Old hero claim.",
        issue: "The hero makes a claim that needs approved proof.",
        suggestedFix: "Replace the claim or attach approved evidence.",
        sourceRefs: ["source-proof-library"],
        proofNeeded: "Approved public proof for the hero claim.",
        editReadiness: "open_question",
        claimCategory: "metric",
        approvalStatus: "needs_client_approval",
        proofRequired: true,
        proofOwner: "Client proof owner",
        canAgentEdit: false,
        agentInstruction:
          "Needs client proof approval. Do not repeat or strengthen the metric.",
      }),
    ],
    sourceReadiness: [
      { moduleId: "proof-library", readiness: "partial" },
      { moduleId: "positioning", readiness: "strong" },
    ],
    publicClaims: [
      {
        id: "claim-hero",
        clientId: "fixture",
        claim: "Old hero claim.",
        claimCategory: "metric",
        proofStatus: "weak_proof",
        sourceRefs: ["source-proof-library"],
        publicUseApproved: true,
        approvalStatus: "needs_client_approval",
        proofRequired: true,
        proofOwner: "Client proof owner",
        canAgentEdit: false,
        riskNotes: "Needs public substantiation.",
      },
    ],
    recommendedNextStep: "Resolve the hero proof gap before editing.",
  };
}

function readGolden(fileName: string): string {
  return readFileSync(path.join(goldenDir, fileName), "utf8");
}

describe("report system", () => {
  it("generates golden report artifacts for each Phase 6 output", () => {
    const bundle = generateReportBundle(reportInput());

    expect(bundle.executiveSummary).toBe(readGolden("executive-summary.md"));
    expect(bundle.findingsCsv).toBe(readGolden("findings.csv"));
    expect(bundle.pageRedlines).toBe(readGolden("page-redlines.md"));
    expect(bundle.agentEditPlanJson).toBe(readGolden("agent-edit-plan.json").trimEnd());
    expect(bundle.sourceReadiness).toBe(readGolden("source-readiness.md"));
    expect(bundle.openQuestions).toBe(readGolden("open-questions.md"));
    expect(bundle.proofGateSummary).toBe(readGolden("proof-gate-summary.md"));
  });

  it("sorts findings by priority, target, and id", () => {
    expect(sortFindingsForReport(reportInput().findings).map((item) => item.id)).toEqual([
      "finding-high",
      "finding-low",
    ]);
  });

  it("includes every high-priority finding in human and machine reports", () => {
    const bundle = generateReportBundle(reportInput());
    const agentPlan = JSON.parse(bundle.agentEditPlanJson);

    expect(bundle.pageRedlines).toContain("finding-high");
    expect(agentPlan.findings.map((item: Finding) => item.id)).toContain("finding-high");
  });

  it("flags suggested public claims with weak proof", () => {
    const bundle = generateReportBundle(reportInput());
    const agentPlan = JSON.parse(bundle.agentEditPlanJson);

    expect(bundle.openQuestions).toContain(
      "claim-hero (metric, weak_proof, approval: needs_client_approval",
    );
    expect(agentPlan.publicClaimFlags).toEqual([
      expect.objectContaining({
        claimId: "claim-hero",
        claimCategory: "metric",
        proofStatus: "weak_proof",
        approvalStatus: "needs_client_approval",
        canAgentEdit: false,
      }),
    ]);
    expect(agentPlan.proofGateSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "finding-high",
          approvalStatus: "needs_client_approval",
          canAgentEdit: false,
        }),
      ]),
    );
  });

  it("flags approved-proof claims that still lack public-use approval", () => {
    const bundle = generateReportBundle({
      ...reportInput(),
      publicClaims: [
        {
          id: "claim-private-approval",
          clientId: "fixture",
          claim: "Approved internally, not public.",
          claimCategory: "broad_positioning",
          proofStatus: "approved_proof",
          sourceRefs: ["source-proof-library"],
          publicUseApproved: false,
          approvalStatus: "needs_client_approval",
          proofRequired: true,
          proofOwner: "Client proof owner",
          canAgentEdit: false,
        },
      ],
    });

    expect(bundle.openQuestions).toContain("claim-private-approval");
  });

  it("produces a schema-valid report bundle payload", () => {
    const bundle = generateReportBundle(reportInput());

    expect(
      reportBundleSchema.safeParse({
        clientId: "fixture",
        runId: "run-2026-06-20",
        targetIds: ["homepage", "pricing"],
        generatedAt: "2026-06-20T12:00:00.000Z",
        reports: {
          executiveSummary: bundle.executiveSummary,
          findingsCsv: bundle.findingsCsv,
          pageRedlines: bundle.pageRedlines,
          agentEditPlan: bundle.agentEditPlanJson,
          sourceReadiness: bundle.sourceReadiness,
          openQuestions: bundle.openQuestions,
          proofGateSummary: bundle.proofGateSummary,
        },
      }).success,
    ).toBe(true);
  });
});
