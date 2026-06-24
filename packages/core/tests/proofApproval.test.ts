import { describe, expect, it } from "vitest";
import {
  evaluateManifestProofSources,
  evaluateProofSourceTrust,
  proofGateItemsForFindings,
} from "../src/proofApproval.js";
import type { Finding, SourceManifest } from "../src/schemas.js";

function proofFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "finding-proof",
    clientId: "fixture",
    targetId: "homepage",
    url: "https://example.test/",
    mode: "proof_gap",
    label: "Metric needs approval",
    priority: "high",
    confidence: "high",
    quotedText: "750B",
    issue: "Metric needs approved proof.",
    suggestedFix: "Do not amplify the metric.",
    sourceRefs: ["source-proof"],
    proofNeeded: "Approved metric source.",
    editReadiness: "manual_review",
    claimCategory: "metric",
    approvalStatus: "needs_client_approval",
    proofRequired: true,
    proofOwner: "Client proof owner",
    canAgentEdit: false,
    ...overrides,
  };
}

describe("proof approval", () => {
  it("treats maintained trusted proof sources as stronger than stale sources", () => {
    const asOf = new Date("2026-06-23T00:00:00.000Z");

    expect(
      evaluateProofSourceTrust(
        {
          id: "maintained",
          trustLevel: "trusted",
          lastEditedAt: "2026-06-01T00:00:00.000Z",
        },
        asOf,
      ),
    ).toMatchObject({ trust: "maintained" });
    expect(
      evaluateProofSourceTrust(
        {
          id: "stale",
          trustLevel: "trusted",
          lastEditedAt: "2025-01-01T00:00:00.000Z",
        },
        asOf,
      ),
    ).toMatchObject({ trust: "decayed" });
  });

  it("evaluates source trust from a manifest and reports missing proof refs", () => {
    const manifest: SourceManifest = {
      clientId: "fixture",
      generatedAt: "2026-06-23T00:00:00.000Z",
      sources: [
        {
          id: "source-proof",
          clientId: "fixture",
          type: "local",
          tier: "canonical",
          trustLevel: "trusted",
          title: "Proof",
          path: "canonical/proof.md",
          lastEditedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      canonicalRegistry: [
        {
          moduleId: "proof-library",
          clientId: "fixture",
          path: "canonical/proof.md",
          readiness: "strong",
          provenance: ["source-proof"],
        },
      ],
    };

    expect(
      evaluateManifestProofSources(
        manifest,
        ["source-proof", "source-missing"],
        new Date("2026-06-23T00:00:00.000Z"),
      ),
    ).toEqual([
      expect.objectContaining({ sourceId: "source-proof", trust: "maintained" }),
      expect.objectContaining({ sourceId: "source-missing", trust: "unknown" }),
    ]);
  });

  it("summarizes proof-gated findings for downstream agents", () => {
    expect(proofGateItemsForFindings([proofFinding()])).toEqual([
      {
        id: "finding-proof",
        label: "Metric needs approval",
        claimCategory: "metric",
        approvalStatus: "needs_client_approval",
        proofOwner: "Client proof owner",
        canAgentEdit: false,
        instruction:
          "Do not repeat, strengthen, or reframe the metric until the proof owner approves it.",
        sourceRefs: ["source-proof"],
      },
    ]);
  });
});
