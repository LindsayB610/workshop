import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";
import {
  prepareEditBriefFromAgentPlan,
  prepareEditBriefFromJson,
  type ReportAgentEditPlan,
} from "../src/index.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const goldenDir = path.join(testDir, "fixtures/edit-brief");

function planFixture(): ReportAgentEditPlan {
  return {
    clientId: "fixture",
    runId: "run-2026-06-20",
    generatedAt: "2026-06-20T12:00:00.000Z",
    targets: [
      {
        id: "homepage",
        url: "https://example.test/",
        title: "Home",
      },
    ],
    findings: [
      {
        id: "finding-ready",
        clientId: "fixture",
        targetId: "homepage",
        url: "https://example.test/",
        mode: "message_alignment",
        label: "Hero misses the ICP",
        priority: "high",
        confidence: "high",
        quotedText: "Build faster AI.",
        issue: "The hero does not name the production buyer or workload.",
        suggestedFix: "Rewrite the hero around production inference teams.",
        sourceRefs: ["source-positioning"],
        proofNeeded: "Confirm final ICP language.",
        editReadiness: "ready",
      },
      {
        id: "finding-proof",
        clientId: "fixture",
        targetId: "homepage",
        url: "https://example.test/",
        mode: "proof_gap",
        label: "Speed claim needs proof",
        priority: "high",
        confidence: "high",
        quotedText: "Fastest inference.",
        issue: "The claim needs approved public evidence before rewriting.",
        suggestedFix: "Attach proof or soften the claim.",
        sourceRefs: ["source-proof-library"],
        proofNeeded: "Approved benchmark and public-use permission.",
        editReadiness: "open_question",
        claimCategory: "metric",
        approvalStatus: "needs_client_approval",
        proofRequired: true,
        proofOwner: "Client proof owner",
        canAgentEdit: false,
        agentInstruction:
          "Needs client proof approval. Do not repeat or strengthen the metric.",
      },
      {
        id: "finding-uncertain",
        clientId: "fixture",
        targetId: "homepage",
        url: "https://example.test/",
        mode: "buyer_language",
        label: "Use-case phrasing may be too broad",
        priority: "medium",
        confidence: "medium",
        quotedText: "Every AI workflow.",
        issue: "The finding is useful but needs stronger buyer evidence.",
        suggestedFix: "Consider replacing with narrower workload language.",
        sourceRefs: ["source-buyer-language"],
        proofNeeded: "Confirm top public-safe workload examples.",
        editReadiness: "ready",
      },
    ],
    openQuestions: [
      {
        findingId: "finding-proof",
        targetId: "homepage",
        proofNeeded: "Approved benchmark and public-use permission.",
        editReadiness: "open_question",
      },
    ],
    publicClaimFlags: [
      {
        claimId: "claim-fastest",
        claim: "Fastest inference.",
        proofStatus: "weak_proof",
        claimCategory: "metric",
        publicUseApproved: false,
        approvalStatus: "needs_client_approval",
        proofRequired: true,
        proofOwner: "Client proof owner",
        canAgentEdit: false,
        riskNotes: "Needs substantiation before public copy.",
      },
    ],
    proofGateSummary: [
      {
        id: "finding-proof",
        label: "Speed claim needs proof",
        claimCategory: "metric",
        approvalStatus: "needs_client_approval",
        proofOwner: "Client proof owner",
        canAgentEdit: false,
        instruction:
          "Needs client proof approval. Do not repeat or strengthen the metric.",
        sourceRefs: ["source-proof-library"],
      },
    ],
  };
}

describe("edit brief", () => {
  it("generates the Phase 7 golden edit brief", () => {
    const artifact = prepareEditBriefFromAgentPlan(planFixture());

    expect(artifact.markdown).toBe(
      readFileSync(path.join(goldenDir, "edit-brief.md"), "utf8"),
    );
  });

  it("includes locator text on every edit instruction", () => {
    const { brief } = prepareEditBriefFromAgentPlan(planFixture());
    const instructions = [...brief.rewriteInstructions, ...brief.manualReview];

    expect(instructions).toHaveLength(3);
    for (const instruction of instructions) {
      expect(instruction.locatorText).toBeTruthy();
    }
  });

  it("routes uncertain and high-risk findings to manual review", () => {
    const { brief } = prepareEditBriefFromAgentPlan(planFixture());

    expect(brief.rewriteInstructions.map((item) => item.findingId)).toEqual([
      "finding-ready",
    ]);
    expect(brief.manualReview.map((item) => item.findingId)).toEqual([
      "finding-proof",
      "finding-uncertain",
    ]);
  });

  it("parses agent edit plan JSON into an edit brief", () => {
    const artifact = prepareEditBriefFromJson(JSON.stringify(planFixture()));

    expect(artifact.brief.clientId).toBe("fixture");
    expect(artifact.json).toContain('"rewriteInstructions"');
  });

  it("runs the prepare-edit-brief command against a report path", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "redline-edit-brief-"));
    const reportPath = path.join(tempDir, "agent-edit-plan.json");
    const outPath = path.join(tempDir, "edit-brief.md");
    writeFileSync(reportPath, JSON.stringify(planFixture()), "utf8");

    const result = runCli([
      "prepare-edit-brief",
      "--report",
      reportPath,
      "--out",
      outPath,
    ]);

    expect(result).toEqual({
      exitCode: 0,
      stdout: `Wrote edit brief to ${outPath}\n`,
      stderr: "",
    });
    expect(readFileSync(outPath, "utf8")).toBe(
      `${readFileSync(path.join(goldenDir, "edit-brief.md"), "utf8")}\n`,
    );
  });

  it("exposes a root redline binary wrapper", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    ) as { bin?: Record<string, string>; scripts?: Record<string, string> };
    const binPath = packageJson.bin?.redline;

    expect(binPath).toBe("./bin/redline.js");
    expect(packageJson.scripts?.redline).toBe("node bin/redline.js");
    if (!binPath) {
      throw new Error("Missing redline bin path.");
    }
    expect(existsSync(path.join(repoRoot, binPath))).toBe(true);
    const wrapper = readFileSync(path.join(repoRoot, binPath), "utf8");
    expect(wrapper).toContain("../packages/core/dist/cli.js");
    expect(wrapper).toContain("runCli(process.argv.slice(2))");
  });
});
