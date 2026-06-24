import type {
  ClaimInventoryItem,
  Finding,
  SourceManifest,
  SourceSnapshot,
} from "./schemas.js";

export type ProofGateSummaryItem = {
  id: string;
  label: string;
  claimCategory?: Finding["claimCategory"];
  approvalStatus: NonNullable<Finding["approvalStatus"]>;
  proofOwner: string;
  canAgentEdit: boolean;
  instruction: string;
  sourceRefs: string[];
};

export type ProofSourceTrust = {
  sourceId: string;
  trust: "maintained" | "usable" | "decayed" | "unknown";
  reason: string;
};

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

function parseDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function evaluateProofSourceTrust(
  source: Pick<SourceSnapshot, "id" | "trustLevel" | "lastEditedAt" | "fetchedAt">,
  asOf = new Date(),
): ProofSourceTrust {
  const editedAt = parseDate(source.lastEditedAt);
  const fetchedAt = parseDate(source.fetchedAt);

  if (editedAt) {
    const ageDays = daysBetween(asOf, editedAt);
    if (ageDays <= 90 && source.trustLevel === "trusted") {
      return {
        sourceId: source.id,
        trust: "maintained",
        reason: `Trusted source edited ${ageDays} days ago.`,
      };
    }

    if (ageDays > 180) {
      return {
        sourceId: source.id,
        trust: "decayed",
        reason: `Source has not been edited for ${ageDays} days.`,
      };
    }
  }

  if (fetchedAt) {
    const ageDays = daysBetween(asOf, fetchedAt);
    if (ageDays <= 30 && source.trustLevel === "trusted") {
      return {
        sourceId: source.id,
        trust: "usable",
        reason: `Trusted source snapshot fetched ${ageDays} days ago.`,
      };
    }
  }

  return {
    sourceId: source.id,
    trust: "unknown",
    reason: "Source has no recent maintained edit or trusted fresh snapshot.",
  };
}

export function evaluateManifestProofSources(
  manifest: SourceManifest,
  sourceRefs: string[],
  asOf = new Date(),
): ProofSourceTrust[] {
  const sourcesById = new Map(manifest.sources.map((source) => [source.id, source]));

  return sourceRefs.map((sourceRef) => {
    const source = sourcesById.get(sourceRef);
    if (!source) {
      return {
        sourceId: sourceRef,
        trust: "unknown" as const,
        reason: "Referenced source is missing from the manifest.",
      };
    }

    return evaluateProofSourceTrust(source, asOf);
  });
}

function gateInstructionForFinding(finding: Finding): string {
  if (finding.agentInstruction) {
    return finding.agentInstruction;
  }

  if (finding.approvalStatus === "approved" && finding.canAgentEdit) {
    return "Agent may edit this copy within the cited proof bounds.";
  }

  if (finding.claimCategory === "metric" || finding.claimCategory === "pricing_comparison") {
    return "Do not repeat, strengthen, or reframe the metric until the proof owner approves it.";
  }

  if (finding.claimCategory === "customer_proof") {
    return "Do not adapt customer proof until public-use approval is confirmed.";
  }

  return "Do not rewrite or amplify this claim until proof approval is resolved.";
}

function canAgentEditFinding(finding: Finding): boolean {
  return finding.canAgentEdit ?? finding.editReadiness === "ready";
}

export function proofGateItemsForFindings(findings: Finding[]): ProofGateSummaryItem[] {
  return findings
    .filter(
      (finding) =>
        finding.proofRequired === true ||
        finding.canAgentEdit === false ||
        finding.approvalStatus === "needs_client_approval" ||
        finding.approvalStatus === "needs_internal_proof" ||
        finding.approvalStatus === "blocked",
    )
    .map((finding) => ({
      id: finding.id,
      label: finding.label,
      claimCategory: finding.claimCategory,
      approvalStatus: finding.approvalStatus ?? "needs_internal_proof",
      proofOwner: finding.proofOwner ?? "Unassigned",
      canAgentEdit: canAgentEditFinding(finding),
      instruction: gateInstructionForFinding(finding),
      sourceRefs: finding.sourceRefs,
    }));
}

export function proofGateItemsForClaims(
  claims: ClaimInventoryItem[] = [],
): ProofGateSummaryItem[] {
  return claims
    .filter(
      (claim) =>
        claim.proofStatus !== "approved_proof" ||
        claim.publicUseApproved !== true ||
        claim.proofRequired === true ||
        claim.canAgentEdit === false,
    )
    .map((claim) => ({
      id: claim.id,
      label: claim.claim,
      claimCategory: claim.claimCategory,
      approvalStatus:
        claim.approvalStatus ??
        (claim.proofStatus === "missing_proof" ? "blocked" : "needs_client_approval"),
      proofOwner: claim.proofOwner ?? "Client proof owner",
      canAgentEdit: claim.canAgentEdit ?? false,
      instruction:
        claim.canAgentEdit === true
          ? "Agent may edit only within approved proof bounds."
          : "Do not repeat, strengthen, or reframe this claim until approval is resolved.",
      sourceRefs: claim.sourceRefs,
    }));
}
