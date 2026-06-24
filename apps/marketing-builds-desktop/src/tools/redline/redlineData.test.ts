import { describe, expect, it } from "vitest";
import {
  buildReportExportFiles,
  defaultRedlineClientId,
  demoRedlineWorkspace,
  filterReviewQueue,
  getRedlineWorkspace,
  redlineSavedReports,
  redlineWorkspaces,
  runSavedAudit,
  summarizePacketHealth,
  summarizeReadiness,
  summarizeReviewQueue,
} from "./redlineData";

describe("Redline desktop data", () => {
  it("loads the sanitized demo packet and saved target fixture", () => {
    expect(demoRedlineWorkspace.clientId).toBe("demo-redline");
    expect(demoRedlineWorkspace.clientName).toBe("Northstar Demo Co.");
    expect(demoRedlineWorkspace.packetPath).toBe("clients/demo-redline");
    expect(demoRedlineWorkspace.targetLabel).toBe("Demo landing page fixture");
    expect(demoRedlineWorkspace.targetPath).toBe(
      "clients/demo-redline/targets/fixtures/landing-page.html",
    );
  });

  it("keeps report exports explicit and demo-scoped", () => {
    expect(demoRedlineWorkspace.artifacts.length).toBeGreaterThan(0);
    for (const artifact of demoRedlineWorkspace.artifacts) {
      expect(artifact.path).toMatch(/^clients\/demo-redline\/reports\/launch-review\//);
      expect(artifact.available).toBe(true);
    }
  });

  it("validates saved report metadata with the core report contract", () => {
    expect(redlineSavedReports.demo.clientId).toBe("demo-redline");
    expect(redlineSavedReports.demo.runId).toBe("demo-launch-review");
    expect(redlineSavedReports.demo.targets.map((target) => target.id)).toEqual([
      "demo-landing-page",
    ]);
    expect(demoRedlineWorkspace.savedReportPath).toBe(
      "clients/demo-redline/reports/launch-review/agent-edit-plan.json",
    );
    expect(demoRedlineWorkspace.findings.map((finding) => finding.id)).toEqual(
      redlineSavedReports.demo.findings.map((finding) => finding.id),
    );
  });

  it("runs saved audit metadata for the demo target", () => {
    expect(runSavedAudit(demoRedlineWorkspace, "demo-landing-page")).toEqual({
      status: "completed",
      targetId: "demo-landing-page",
      targetType: "saved_fixture",
      reportId: "demo-launch-review",
      generatedAt: "2026-06-23T00:00:00.000Z",
      findingsCount: redlineSavedReports.demo.findings.length,
      artifactsCount: demoRedlineWorkspace.artifacts.length,
      message:
        "Saved audit run completed from the selected saved fixture target. Reports are ready to export or open.",
    });
  });

  it("runs local workflow targets beyond saved fixtures", () => {
    expect(demoRedlineWorkspace.targets.map((target) => target.type)).toEqual([
      "saved_fixture",
      "local_file",
      "pasted_draft",
      "queued_url",
    ]);
    expect(
      demoRedlineWorkspace.targets.find((target) => target.id === "queued-demo-page"),
    ).toMatchObject({
      reportTargetId: "demo-landing-page",
      sourceUrl: "workshop://demo-redline/landing-page",
      role: "queued_live_url",
    });
    expect(runSavedAudit(demoRedlineWorkspace, "pasted-demo-draft")).toMatchObject({
      status: "completed",
      targetId: "pasted-demo-draft",
      targetType: "pasted_draft",
    });
  });

  it("builds client-scoped report export files from a completed run", () => {
    const run = runSavedAudit(demoRedlineWorkspace, "pasted-demo-draft");
    const files = buildReportExportFiles(demoRedlineWorkspace, run);

    expect(files.map((file) => file.path)).toEqual([
      "clients/demo-redline/reports/workshop-local-run/run-summary.md",
      "clients/demo-redline/reports/workshop-local-run/agent-edit-plan.json",
    ]);
    expect(files[0].contents).toContain("Target type: pasted_draft");
  });

  it("builds a review queue with agent, human, and proof routes", () => {
    expect(summarizeReviewQueue(demoRedlineWorkspace.findings)).toEqual({
      total: 3,
      agentReady: 2,
      manualReview: 0,
      proofReview: 1,
    });

    expect(
      filterReviewQueue(demoRedlineWorkspace.findings, {
        route: "proof_review",
        priority: "all",
        mode: "all",
      }).map((finding) => finding.id),
    ).toEqual(["demo-redline-f2"]);
  });

  it("keeps source evidence and copyable edit-brief snippets on findings", () => {
    const finding = demoRedlineWorkspace.findings[0];

    expect(finding.sourceRefs).toEqual([
      "demo-source-positioning",
      "demo-source-buyer-language",
    ]);
    expect(finding.sourceEvidence[0]).toEqual({
      id: "demo-source-positioning",
      label: "Northstar positioning",
      path: "clients/demo-redline/canonical/positioning.md",
      type: "local",
      tier: "canonical",
    });
    expect(finding.editBriefSnippet).toContain("## demo-redline-f1");
    expect(finding.editBriefSnippet).toContain("Sources: demo-source-positioning");
    expect(finding.editBriefSnippet).toContain("Recommended action:");
  });

  it("summarizes packet health and source readiness", () => {
    expect(summarizePacketHealth(demoRedlineWorkspace.healthIssues)).toEqual({
      errors: 0,
      warnings: 1,
      info: 1,
      status: "review",
    });
    expect(summarizeReadiness(demoRedlineWorkspace.readiness)).toEqual({
      strong: 2,
      partial: 1,
      missing: 0,
    });
  });

  it("registers more than one isolated client workspace", () => {
    expect(defaultRedlineClientId).toBe("demo-redline");
    expect(redlineWorkspaces.map((workspace) => workspace.clientId)).toEqual([
      "demo-redline",
      "fixture",
    ]);

    const fixture = getRedlineWorkspace("fixture");
    expect(fixture.clientName).toBe("Fixture Client");
    expect(fixture.packetPath).toBe("clients/fixture");
    expect(JSON.stringify(redlineWorkspaces)).not.toContain(
      ["clients", ["para", "sail"].join("")].join("/"),
    );
  });
});
