import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { buildOnboardingPacketExport, buildRedlinePromptsFile, evaluateOnboardingReadiness, serializeRedlinePromptsYaml } from "../src/onboarding.js";
import { clientConfigSchema, sourceManifestSchema, type ClientOnboardingSession } from "../src/schemas.js";

function session(overrides: Partial<ClientOnboardingSession> = {}): ClientOnboardingSession {
  return {
    clientId: "demo-client", clientName: "Demo Client",
    sourceIntake: [{ id: "source-positioning", clientId: "demo-client", title: "Positioning", body: "A clear demo message.", type: "local", tier: "source_of_truth", trustLevel: "trusted", freshness: "current", privacy: "public_safe", reviewStatus: "approved", owner: "Marketing", approver: "Editor", confidence: "high" }],
    canonicalDrafts: [{ id: "positioning", clientId: "demo-client", title: "Positioning", body: "A clear demo message.", sourceRefs: ["source-positioning"], reviewStatus: "approved" }],
    prompts: [{ id: "demo-query", clientId: "demo-client", text: "What does the demo solve?", weight: 1, sourceRefs: ["source-positioning"], rationale: "Tests the main buyer question." }],
    claims: [{ id: "demo-claim", clientId: "demo-client", claim: "A clear demo message.", proofStatus: "approved_proof", sourceRefs: ["source-positioning"], publicUseApproved: true }],
    auditTargets: [{ id: "homepage", clientId: "demo-client", title: "Homepage", url: "https://demo.example/", priority: "high" }],
    ...overrides,
  };
}

describe("onboarding", () => {
  it("marks a complete public-safe session ready to audit", () => {
    expect(evaluateOnboardingReadiness(session()).level).toBe("ready_to_audit");
  });
  it("exports a valid packet preview without writing it", () => {
    const packet = buildOnboardingPacketExport(session(), "2026-06-20T00:00:00.000Z");
    const files = new Map(packet.files.map((file) => [file.path, file.contents]));
    expect(packet.clientFolder).toBe("clients/demo-client");
    expect(clientConfigSchema.parse(YAML.parse(files.get("clients/demo-client/client.yaml") ?? "")).clientId).toBe("demo-client");
    expect(sourceManifestSchema.parse(JSON.parse(files.get("clients/demo-client/source-manifest.json") ?? "{}")).clientId).toBe("demo-client");
  });
  it("serializes reusable prompts", () => {
    const prompts = buildRedlinePromptsFile(session());
    expect(YAML.parse(serializeRedlinePromptsYaml(prompts)).prompts[0].id).toBe("demo-query");
  });
  it("blocks cross-client sources and prevents packet export", () => {
    const invalid = session({ sourceIntake: [{ ...session().sourceIntake[0], clientId: "other-client" }] });
    expect(evaluateOnboardingReadiness(invalid).blockingIssues).toEqual(expect.arrayContaining([expect.stringContaining('belongs to client "other-client"')]));
    expect(() => buildOnboardingPacketExport(invalid, "2026-06-20T00:00:00.000Z")).toThrow(/blocking issues/);
  });
  it("surfaces stale sources and weak proof as audit caveats", () => {
    const cautious = session({
      sourceIntake: [{ ...session().sourceIntake[0], freshness: "stale" }],
      claims: [{ ...session().claims[0], proofStatus: "weak_proof" }],
    });
    const readiness = evaluateOnboardingReadiness(cautious);
    expect(readiness.level).toBe("auditable_with_caveats");
    expect(readiness.caveats).toEqual(expect.arrayContaining([expect.stringContaining("stale"), expect.stringContaining("manual review")]));
  });
});
