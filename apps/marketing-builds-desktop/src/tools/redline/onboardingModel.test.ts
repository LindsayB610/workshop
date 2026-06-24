import { describe, expect, it } from "vitest";
import {
  demoOnboardingPacket,
  demoOnboardingReadiness,
  demoOnboardingSession,
  summarizeOnboarding,
} from "./onboardingModel";

describe("Redline onboarding data", () => {
  it("builds a Redline-compatible Demo packet export preview", () => {
    expect(demoOnboardingPacket.clientFolder).toBe("clients/demo-onboarding-draft");
    expect(demoOnboardingPacket.files.map((file) => file.path)).toEqual([
      "clients/demo-onboarding-draft/client.yaml",
      "clients/demo-onboarding-draft/source-manifest.json",
      "clients/demo-onboarding-draft/canonical/owner-visible-handoffs.md",
      "clients/demo-onboarding-draft/prompts/messaging-alignment.yaml",
      "clients/demo-onboarding-draft/onboarding-brief.md",
    ]);
  });

  it("surfaces stale and possibly stale source caveats before audit trust", () => {
    expect(demoOnboardingReadiness.level).toBe("auditable_with_caveats");
    expect(demoOnboardingReadiness.caveats).toEqual(
      expect.arrayContaining([
        'Source "demo-source-narrative" may be stale and should be refreshed before high-confidence audit.',
        'Claim "claim-hours-saved" needs manual review before public copy.',
      ]),
    );
    expect(demoOnboardingPacket.brief).toContain(
      "Messaging architecture snapshot is possibly_stale.",
    );
  });

  it("summarizes guided onboarding progress for the desktop surface", () => {
    expect(summarizeOnboarding(demoOnboardingSession, demoOnboardingPacket)).toEqual({
      sourceCount: 3,
      approvedSourceCount: 1,
      staleSourceCount: 2,
      approvedCanonicalCount: 1,
      reviewCanonicalCount: 1,
      exportFileCount: 5,
    });
  });
});
