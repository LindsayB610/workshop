import { describe, expect, it } from "vitest";
import {
  auditTargetSchema,
  findingSchema,
  reportBundleSchema,
  reportAgentEditPlanSchema,
  sourceManifestSchema,
} from "../src/schemas.js";

describe("schema contracts", () => {
  it("requires source snapshots to identify a path, url, or source id", () => {
    const result = sourceManifestSchema.safeParse({
      clientId: "fixture",
      generatedAt: "2026-06-20T00:00:00.000Z",
      sources: [
        {
          id: "source-without-location",
          clientId: "fixture",
          type: "local",
          tier: "canonical",
          trustLevel: "trusted",
          title: "Source Without Location",
        },
      ],
      canonicalRegistry: [
        {
          moduleId: "positioning",
          clientId: "fixture",
          path: "canonical/positioning.md",
          readiness: "strong",
          provenance: ["source-without-location"],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires canonical registry entries to include provenance", () => {
    const result = sourceManifestSchema.safeParse({
      clientId: "fixture",
      generatedAt: "2026-06-20T00:00:00.000Z",
      sources: [
        {
          id: "source-local-positioning",
          clientId: "fixture",
          type: "local",
          tier: "canonical",
          trustLevel: "trusted",
          title: "Positioning",
          path: "canonical/positioning.md",
        },
      ],
      canonicalRegistry: [
        {
          moduleId: "positioning",
          clientId: "fixture",
          path: "canonical/positioning.md",
          readiness: "strong",
          provenance: [],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires audit targets to identify a path or url", () => {
    const result = auditTargetSchema.safeParse({
      id: "homepage",
      clientId: "fixture",
      type: "saved_fixture",
      title: "Homepage",
    });

    expect(result.success).toBe(false);
  });

  it("requires findings to cite at least one source", () => {
    const result = findingSchema.safeParse({
      id: "finding-1",
      clientId: "fixture",
      targetId: "homepage",
      mode: "message_alignment",
      url: "https://example.com/",
      label: "Generic hero",
      priority: "high",
      confidence: "high",
      quotedText: "No limits. No contracts. Priced right.",
      issue: "The hero is too generic for the approved positioning.",
      suggestedFix: "Name production OSS inference and buyer pain.",
      sourceRefs: [],
      proofNeeded: "Confirm approved support proof.",
      editReadiness: "manual_review",
    });

    expect(result.success).toBe(false);
  });

  it("accepts Phase 16 proof approval fields while keeping them optional", () => {
    const baseFinding = {
      id: "finding-1",
      clientId: "fixture",
      targetId: "homepage",
      mode: "proof_gap",
      url: "https://example.com/",
      label: "Metric needs proof",
      priority: "high",
      confidence: "high",
      quotedText: "750B",
      issue: "Metric needs approved proof.",
      suggestedFix: "Do not amplify the metric.",
      sourceRefs: ["source-proof"],
      proofNeeded: "Approved support proof.",
      editReadiness: "manual_review",
    };

    expect(findingSchema.parse(baseFinding)).toMatchObject({
      id: "finding-1",
      proofNeeded: "Approved support proof.",
    });
    expect(
      findingSchema.parse({
        ...baseFinding,
        claimCategory: "metric",
        approvalStatus: "needs_client_approval",
        proofRequired: true,
        proofOwner: "Client proof owner",
        canAgentEdit: false,
        agentInstruction: "Needs client proof approval.",
      }),
    ).toMatchObject({
      claimCategory: "metric",
      approvalStatus: "needs_client_approval",
      proofRequired: true,
      canAgentEdit: false,
    });
  });

  it("parses report agent plans with proof gate summaries", () => {
    const parsed = reportAgentEditPlanSchema.parse({
      clientId: "fixture",
      runId: "run-1",
      generatedAt: "2026-06-20T00:00:00.000Z",
      targets: [{ id: "homepage", url: "https://example.com/", title: "Home" }],
      findings: [
        {
          id: "finding-1",
          clientId: "fixture",
          targetId: "homepage",
          mode: "proof_gap",
          url: "https://example.com/",
          label: "Metric needs proof",
          priority: "high",
          confidence: "high",
          quotedText: "750B",
          issue: "Metric needs approved proof.",
          suggestedFix: "Do not amplify the metric.",
          sourceRefs: ["source-proof"],
          proofNeeded: "Approved support proof.",
          editReadiness: "manual_review",
          claimCategory: "metric",
          approvalStatus: "needs_client_approval",
          proofRequired: true,
          proofOwner: "Client proof owner",
          canAgentEdit: false,
        },
      ],
      proofGateSummary: [
        {
          id: "finding-1",
          label: "Metric needs proof",
          claimCategory: "metric",
          approvalStatus: "needs_client_approval",
          proofOwner: "Client proof owner",
          canAgentEdit: false,
          instruction: "Needs client proof approval.",
          sourceRefs: ["source-proof"],
        },
      ],
    });

    expect(parsed.proofGateSummary).toHaveLength(1);
  });

  it("validates a minimal report bundle", () => {
    const result = reportBundleSchema.safeParse({
      clientId: "fixture",
      runId: "run-1",
      targetIds: ["homepage"],
      generatedAt: "2026-06-20T00:00:00.000Z",
      reports: {
        executiveSummary: "Summary",
        pageRedlines: "Redlines",
        agentEditPlan: "Plan",
        sourceReadiness: "Readiness",
      },
    });

    expect(result.success).toBe(true);
  });
});
