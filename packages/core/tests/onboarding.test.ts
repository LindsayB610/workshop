import { describe, expect, it } from "vitest";
import YAML from "yaml";
import {
  buildOnboardingPacketExport,
  buildRedlinePromptsFile,
  evaluateOnboardingReadiness,
  serializeRedlinePromptsYaml,
} from "../src/onboarding.js";
import {
  clientConfigSchema,
  sourceManifestSchema,
  type ClientOnboardingSession,
} from "../src/schemas.js";

function onboardingSession(
  overrides: Partial<ClientOnboardingSession> = {},
): ClientOnboardingSession {
  return {
    clientId: "parasail",
    clientName: "Parasail",
    sourceIntake: [
      {
        id: "source-positioning",
        clientId: "parasail",
        title: "Positioning",
        body: "Parasail is production OSS inference for AI-native teams.",
        type: "local",
        tier: "source_of_truth",
        trustLevel: "trusted",
        freshness: "current",
        privacy: "public_safe",
        reviewStatus: "approved",
        owner: "Marketing",
        approver: "Ben Geller",
        confidence: "high",
        checksum: "sha256:fixture",
      },
    ],
    canonicalDrafts: [
      {
        id: "canonical-positioning",
        clientId: "parasail",
        title: "What Parasail is",
        body: "Parasail is production OSS inference for AI-native teams.",
        sourceRefs: ["source-positioning"],
        reviewStatus: "approved",
      },
    ],
    prompts: [
      {
        id: "oss-inference",
        clientId: "parasail",
        text: "What is the best production OSS inference platform?",
        weight: 1.5,
        tags: ["oss", "inference"],
        sourceRefs: ["source-positioning"],
        rationale: "Core category prompt.",
      },
    ],
    claims: [
      {
        id: "claim-positioning",
        clientId: "parasail",
        claim: "Production OSS inference for AI-native teams.",
        proofStatus: "approved_proof",
        sourceRefs: ["source-positioning"],
        publicUseApproved: true,
      },
    ],
    auditTargets: [
      {
        id: "homepage",
        clientId: "parasail",
        title: "Homepage",
        url: "https://parasail.io/",
        priority: "high",
      },
    ],
    ...overrides,
  };
}

describe("client onboarding", () => {
  it("exports a complete onboarding session to Redline prompts.yaml", () => {
    const promptsFile = buildRedlinePromptsFile(onboardingSession());
    const yaml = serializeRedlinePromptsYaml(promptsFile);

    expect(promptsFile).toEqual({
      version: "1",
      prompts: [
        {
          id: "oss-inference",
          text: "What is the best production OSS inference platform?",
          weight: 1.5,
          tags: ["oss", "inference"],
        },
      ],
      canonical_messaging: [
        {
          title: "What Parasail is",
          body: "Parasail is production OSS inference for AI-native teams.",
        },
      ],
    });
    expect(yaml).toContain("canonical_messaging");
    expect(yaml).toContain("oss-inference");
  });

  it("fails duplicate Redline prompt IDs", () => {
    expect(() =>
      buildRedlinePromptsFile(
        onboardingSession({
          prompts: [
            ...onboardingSession().prompts,
            {
              id: "oss-inference",
              clientId: "parasail",
              text: "Which managed inference platform should AI-native startups use?",
              weight: 1,
              tags: ["duplicate"],
              sourceRefs: ["source-positioning"],
              rationale: "Duplicate prompt id should fail.",
            },
          ],
        }),
      ),
    ).toThrow(/Duplicate prompt id/);
  });

  it("blocks unapproved canonical drafts", () => {
    const report = evaluateOnboardingReadiness(
      onboardingSession({
        canonicalDrafts: [
          {
            id: "canonical-positioning",
            clientId: "parasail",
            title: "What Parasail is",
            body: "Parasail is production OSS inference for AI-native teams.",
            sourceRefs: ["source-positioning"],
            reviewStatus: "needs_review",
          },
        ],
      }),
    );

    expect(report.level).toBe("blocked");
    expect(report.blockingIssues).toContain("No approved canonical messaging blocks.");
  });

  it("flags private proof that is marked public-use approved", () => {
    const report = evaluateOnboardingReadiness(
      onboardingSession({
        claims: [
          {
            id: "claim-private",
            clientId: "parasail",
            claim: "A private customer metric.",
            proofStatus: "private_proof",
            sourceRefs: ["source-positioning"],
            publicUseApproved: true,
          },
        ],
      }),
    );

    expect(report.level).toBe("blocked");
    expect(report.blockingIssues).toEqual(
      expect.arrayContaining([
        'Claim "claim-private" has private proof marked public-use approved.',
      ]),
    );
  });

  it("allows missing proof with caveats instead of blocking the audit", () => {
    const report = evaluateOnboardingReadiness(
      onboardingSession({
        claims: [
          {
            id: "claim-unsupported",
            clientId: "parasail",
            claim: "A claim that still needs proof.",
            proofStatus: "missing_proof",
            sourceRefs: [],
            publicUseApproved: false,
          },
        ],
      }),
    );

    expect(report.level).toBe("auditable_with_caveats");
    expect(report.caveats).toEqual(
      expect.arrayContaining([
        'Claim "claim-unsupported" needs manual review before public copy.',
      ]),
    );
    expect(report.promptsYaml?.prompts).toHaveLength(1);
  });

  it("blocks approved sources without an approver", () => {
    const session = onboardingSession();
    const report = evaluateOnboardingReadiness(
      onboardingSession({
        sourceIntake: [
          {
            ...session.sourceIntake[0],
            approver: undefined,
          },
        ],
      }),
    );

    expect(report.level).toBe("blocked");
    expect(report.blockingIssues).toEqual(
      expect.arrayContaining([
        'Approved source "source-positioning" must include an approver.',
      ]),
    );
  });

  it("blocks generated prompts and canonical drafts that cite missing sources", () => {
    const report = evaluateOnboardingReadiness(
      onboardingSession({
        canonicalDrafts: [
          {
            ...onboardingSession().canonicalDrafts[0],
            sourceRefs: ["missing-source"],
          },
        ],
        prompts: [
          {
            ...onboardingSession().prompts[0],
            sourceRefs: ["missing-source"],
          },
        ],
      }),
    );

    expect(report.level).toBe("blocked");
    expect(report.blockingIssues).toEqual(
      expect.arrayContaining([
        'Canonical draft "canonical-positioning" references missing source "missing-source".',
        'Prompt "oss-inference" references missing source "missing-source".',
      ]),
    );
  });

  it("blocks cross-client onboarding references", () => {
    const report = evaluateOnboardingReadiness(
      onboardingSession({
        sourceIntake: [
          {
            ...onboardingSession().sourceIntake[0],
            clientId: "other-client",
          },
        ],
        claims: [
          {
            ...onboardingSession().claims[0],
            clientId: "other-client",
          },
        ],
      }),
    );

    expect(report.level).toBe("blocked");
    expect(report.blockingIssues).toEqual(
      expect.arrayContaining([
        'Source "source-positioning" belongs to client "other-client", not "parasail".',
        'Claim "claim-positioning" belongs to client "other-client", not "parasail".',
      ]),
    );
  });

  it("surfaces source confidence caveats and recommends the first audit target", () => {
    const session = onboardingSession();
    const report = evaluateOnboardingReadiness(
      onboardingSession({
        sourceIntake: [
          {
            ...session.sourceIntake[0],
            confidence: "medium",
          },
        ],
        auditTargets: [
          {
            id: "pricing",
            clientId: "parasail",
            title: "Pricing",
            url: "https://parasail.io/pricing",
            priority: "medium",
          },
          {
            id: "homepage",
            clientId: "parasail",
            title: "Homepage",
            url: "https://parasail.io/",
            priority: "high",
          },
        ],
      }),
    );

    expect(report.level).toBe("auditable_with_caveats");
    expect(report.caveats).toEqual(
      expect.arrayContaining([
        'Trusted source "source-positioning" has less than high confidence.',
      ]),
    );
    expect(report.recommendedFirstAuditTarget?.id).toBe("homepage");
  });

  it("degrades possibly stale maintained sources before high-confidence audits", () => {
    const session = onboardingSession();
    const report = evaluateOnboardingReadiness(
      onboardingSession({
        sourceIntake: [
          {
            ...session.sourceIntake[0],
            freshness: "possibly_stale",
          },
        ],
      }),
    );

    expect(report.level).toBe("auditable_with_caveats");
    expect(report.caveats).toContain(
      'Source "source-positioning" may be stale and should be refreshed before high-confidence audit.',
    );
  });

  it("exports a minimal onboarding session as a valid client packet preview", () => {
    const packet = buildOnboardingPacketExport(
      onboardingSession(),
      "2026-06-20T00:00:00.000Z",
    );
    const filesByPath = new Map(packet.files.map((file) => [file.path, file]));

    expect(packet.clientFolder).toBe("clients/parasail");
    expect(packet.readiness.level).toBe("ready_to_audit");
    expect(filesByPath.has("clients/parasail/client.yaml")).toBe(true);
    expect(filesByPath.has("clients/parasail/source-manifest.json")).toBe(true);
    expect(filesByPath.has("clients/parasail/canonical/what-parasail-is.md")).toBe(true);
    expect(filesByPath.has("clients/parasail/prompts/messaging-alignment.yaml")).toBe(true);
    expect(filesByPath.has("clients/parasail/onboarding-brief.md")).toBe(true);

    const clientConfig = clientConfigSchema.parse(
      YAML.parse(filesByPath.get("clients/parasail/client.yaml")?.contents ?? ""),
    );
    const sourceManifest = sourceManifestSchema.parse(
      JSON.parse(filesByPath.get("clients/parasail/source-manifest.json")?.contents ?? "{}"),
    );

    expect(clientConfig.requiredCanonicalModules).toEqual(["what-parasail-is"]);
    expect(sourceManifest.canonicalRegistry[0].path).toBe(
      "canonical/what-parasail-is.md",
    );
    expect(packet.brief).toContain("What The Packet Knows");
  });

  it("carries stale-source trust degradation into the packet brief", () => {
    const session = onboardingSession();
    const packet = buildOnboardingPacketExport(
      onboardingSession({
        sourceIntake: [
          {
            ...session.sourceIntake[0],
            freshness: "stale",
          },
        ],
      }),
      "2026-06-20T00:00:00.000Z",
    );

    expect(packet.readiness.level).toBe("auditable_with_caveats");
    expect(packet.readiness.caveats).toContain(
      'Source "source-positioning" is stale and not foundational-only.',
    );
    expect(packet.brief).toContain("Positioning is stale.");
  });

  it("rejects packet export when onboarding has cross-client source references", () => {
    const session = onboardingSession();

    expect(() =>
      buildOnboardingPacketExport(
        onboardingSession({
          sourceIntake: [
            {
              ...session.sourceIntake[0],
              clientId: "other-client",
            },
          ],
        }),
        "2026-06-20T00:00:00.000Z",
      ),
    ).toThrow(/Source "source-positioning" belongs to client "other-client"/);
  });
});
