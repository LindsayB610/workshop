import {
  buildOnboardingPacketExport,
  evaluateOnboardingReadiness,
  type OnboardingPacketExport,
} from "@redline/core/onboarding";
import type { ClientOnboardingSession } from "@redline/core/schemas";

export type OnboardingDraftInput = {
  clientId: string;
  clientName: string;
  audience: string;
  exclusions: string;
};

export const defaultOnboardingDraftInput = {
  clientId: "demo-onboarding-draft",
  clientName: "Northstar Demo Draft Packet",
  audience: "Operations leaders and service team managers",
  exclusions: "No quantified time-savings or retention claims without approved proof",
} satisfies OnboardingDraftInput;

export function buildDemoOnboardingSession(
  input: OnboardingDraftInput = defaultOnboardingDraftInput,
): ClientOnboardingSession {
  const clientId = input.clientId;

  return {
      clientId,
      clientName: input.clientName,
      sourceIntake: [
        {
          id: "demo-source-positioning",
          clientId,
          title: "Positioning source of truth",
          body: "Northstar Demo Co. helps operations teams make service handoffs owner-visible.",
          type: "local",
          tier: "source_of_truth",
          trustLevel: "trusted",
          freshness: "current",
          privacy: "public_safe",
          reviewStatus: "approved",
          owner: "Marketing",
          approver: "Demo approver",
          confidence: "high",
          checksum: "sha256:demo-positioning",
        },
        {
          id: "demo-source-narrative",
          clientId,
          title: "Messaging architecture snapshot",
          body: "Owner-visible handoffs should connect the intake moment, next owner, and weekly review loop.",
          type: "notion",
          tier: "context",
          trustLevel: "provisional",
          freshness: "possibly_stale",
          privacy: "internal_only",
          reviewStatus: "needs_review",
          owner: "Demo marketing",
          confidence: "medium",
          checksum: "sha256:demo-messaging-architecture",
        },
        {
          id: "demo-source-proof",
          clientId,
          title: "Proof library",
          body: "Quantified time-savings and customer-outcome claims need approved methodology before public use.",
          type: "local",
          tier: "foundational",
          trustLevel: "foundational",
          freshness: "stale",
          privacy: "private_sensitive",
          reviewStatus: "needs_review",
          owner: "Marketing",
          confidence: "medium",
          checksum: "sha256:demo-proof-library",
        },
      ],
      canonicalDrafts: [
        {
          id: "canonical-positioning",
          clientId,
          title: "Owner-visible handoffs",
          body: "Northstar Demo Co. helps operations teams make service handoffs visible before commitments slip.",
          sourceRefs: ["demo-source-positioning"],
          reviewStatus: "approved",
        },
        {
          id: "canonical-review-loop",
          clientId,
          title: "Weekly review loop",
          body: "Weekly review loops should show ownership gaps, stale handoffs, and proof-sensitive claims before public copy ships.",
          sourceRefs: ["demo-source-positioning", "demo-source-narrative"],
          reviewStatus: "needs_review",
        },
      ],
      prompts: [
        {
          id: "owner-visible-handoffs",
          clientId,
          text: "How should operations teams evaluate owner-visible handoff software?",
          weight: 1.5,
          tags: ["operations", "handoffs", "workflow"],
          sourceRefs: ["demo-source-positioning"],
          rationale: "Core category prompt for message alignment.",
        },
      ],
      claims: [
        {
          id: "claim-owner-visible-handoffs",
          clientId,
          claim: "Owner-visible handoffs for operations teams.",
          proofStatus: "approved_proof",
          sourceRefs: ["demo-source-positioning"],
          publicUseApproved: true,
        },
        {
          id: "claim-hours-saved",
          clientId,
          claim: "Teams save hours every week.",
          proofStatus: "weak_proof",
          sourceRefs: ["demo-source-proof"],
          publicUseApproved: false,
          riskNotes: "Needs methodology and public-use approval before public copy.",
        },
      ],
      auditTargets: [
        {
          id: "homepage",
          clientId,
          title: "Homepage",
          url: "workshop://demo-redline/landing-page",
          priority: "high",
        },
      ],
  };
}

export const demoOnboardingSession = buildDemoOnboardingSession();

export const demoOnboardingReadiness = evaluateOnboardingReadiness(
  demoOnboardingSession,
);

export const demoOnboardingPacket = buildOnboardingPacketExport(
  demoOnboardingSession,
  "2026-06-20T00:00:00.000Z",
);

export function buildOnboardingPacketForSession(session: ClientOnboardingSession) {
  return buildOnboardingPacketExport(session, "2026-06-20T00:00:00.000Z");
}

export type OnboardingSummary = {
  sourceCount: number;
  approvedSourceCount: number;
  staleSourceCount: number;
  approvedCanonicalCount: number;
  reviewCanonicalCount: number;
  exportFileCount: number;
};

export function summarizeOnboarding(
  session: ClientOnboardingSession,
  packet: OnboardingPacketExport,
): OnboardingSummary {
  return {
    sourceCount: session.sourceIntake.length,
    approvedSourceCount: session.sourceIntake.filter(
      (source) => source.reviewStatus === "approved",
    ).length,
    staleSourceCount: session.sourceIntake.filter(
      (source) => source.freshness === "stale" || source.freshness === "possibly_stale",
    ).length,
    approvedCanonicalCount: session.canonicalDrafts.filter(
      (draft) => draft.reviewStatus === "approved",
    ).length,
    reviewCanonicalCount: session.canonicalDrafts.filter(
      (draft) => draft.reviewStatus !== "approved",
    ).length,
    exportFileCount: packet.files.length,
  };
}
