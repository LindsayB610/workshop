import {
  editBriefSchema,
  reportAgentEditPlanSchema,
  type EditBrief,
  type EditBriefInstruction,
  type Finding,
  type ReportAgentEditPlan,
} from "./schemas.js";

export type EditBriefArtifact = {
  brief: EditBrief;
  markdown: string;
  json: string;
};

function riskReasonForFinding(finding: Finding): string | undefined {
  if (finding.canAgentEdit === false) {
    return `Claim approval is ${finding.approvalStatus ?? "unresolved"}.`;
  }

  if (finding.editReadiness !== "ready") {
    return `Edit readiness is ${finding.editReadiness}.`;
  }

  if (finding.confidence !== "high") {
    return `Finding confidence is ${finding.confidence}.`;
  }

  if (finding.mode === "proof_gap") {
    return "Finding depends on proof approval.";
  }

  return undefined;
}

function targetForFinding(plan: ReportAgentEditPlan, finding: Finding) {
  const target = plan.targets.find((item) => item.id === finding.targetId);

  if (!target) {
    throw new Error(`Finding "${finding.id}" references unknown target "${finding.targetId}".`);
  }

  return target;
}

function findingToInstruction(
  plan: ReportAgentEditPlan,
  finding: Finding,
): EditBriefInstruction {
  const target = targetForFinding(plan, finding);
  const riskReason = riskReasonForFinding(finding);
  const kind = riskReason ? "manual_review" : "rewrite_instruction";

  return {
    findingId: finding.id,
    targetId: finding.targetId,
    targetUrl: target.url,
    label: finding.label,
    kind,
    locatorText: finding.quotedText,
    instruction:
      kind === "rewrite_instruction"
        ? finding.suggestedFix
        : `Do not rewrite automatically. Review this finding first: ${finding.suggestedFix}`,
    rationale: finding.issue,
    sourceRefs: finding.sourceRefs,
    proofNeeded: finding.proofNeeded,
    riskReason,
    claimCategory: finding.claimCategory,
    approvalStatus: finding.approvalStatus,
    proofRequired: finding.proofRequired,
    proofOwner: finding.proofOwner,
    canAgentEdit: finding.canAgentEdit,
    agentInstruction: finding.agentInstruction,
  };
}

function instructionMarkdown(instruction: EditBriefInstruction): string {
  return [
    `### ${instruction.label}`,
    "",
    `- Finding ID: ${instruction.findingId}`,
    `- Target: ${instruction.targetId}`,
    `- URL: ${instruction.targetUrl}`,
    `- Locator text: "${instruction.locatorText}"`,
    `- Instruction: ${instruction.instruction}`,
    `- Rationale: ${instruction.rationale}`,
    `- Sources: ${instruction.sourceRefs.join(", ")}`,
    `- Proof needed: ${instruction.proofNeeded}`,
    instruction.claimCategory ? `- Claim category: ${instruction.claimCategory}` : "",
    instruction.approvalStatus ? `- Approval status: ${instruction.approvalStatus}` : "",
    instruction.proofOwner ? `- Proof owner: ${instruction.proofOwner}` : "",
    instruction.canAgentEdit !== undefined ? `- Can agent edit: ${instruction.canAgentEdit}` : "",
    instruction.agentInstruction
      ? `- Agent instruction: ${instruction.agentInstruction}`
      : "",
    instruction.riskReason ? `- Risk reason: ${instruction.riskReason}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function publicClaimFlagMarkdown(flag: EditBrief["publicClaimFlags"][number]): string {
  return [
    `- ${flag.claimId}: "${flag.claim}"`,
    flag.claimCategory ? `  Claim category: ${flag.claimCategory}.` : "",
    `  Proof status: ${flag.proofStatus}; public-use approved: ${flag.publicUseApproved}.`,
    flag.approvalStatus ? `  Approval status: ${flag.approvalStatus}.` : "",
    flag.proofOwner ? `  Proof owner: ${flag.proofOwner}.` : "",
    flag.canAgentEdit !== undefined ? `  Can agent edit: ${flag.canAgentEdit}.` : "",
    flag.riskNotes ? `  Notes: ${flag.riskNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseReportAgentEditPlanJson(json: string): ReportAgentEditPlan {
  return reportAgentEditPlanSchema.parse(JSON.parse(json));
}

export function createEditBrief(plan: ReportAgentEditPlan): EditBrief {
  const instructions = plan.findings.map((finding) => findingToInstruction(plan, finding));
  const brief = {
    clientId: plan.clientId,
    runId: plan.runId,
    generatedAt: plan.generatedAt,
    targets: plan.targets,
    rewriteInstructions: instructions.filter(
      (instruction) => instruction.kind === "rewrite_instruction",
    ),
    manualReview: instructions.filter(
      (instruction) => instruction.kind === "manual_review",
    ),
    publicClaimFlags: plan.publicClaimFlags,
    proofGateSummary: plan.proofGateSummary,
  };

  return editBriefSchema.parse(brief);
}

export function renderEditBriefMarkdown(brief: EditBrief): string {
  return [
    `# ${brief.clientId} ${brief.runId} - Edit Brief`,
    "",
    `Client: ${brief.clientId}`,
    `Run: ${brief.runId}`,
    `Generated: ${brief.generatedAt}`,
    "",
    "## Guardrails",
    "",
    "- This brief prepares Codex-assisted rewriting only.",
    "- Do not automatically edit or publish page content from this brief.",
    "- Rewrite only the locator text shown for approved rewrite instructions.",
    "- Keep manual-review and proof-gated items out of rewrite drafts until resolved.",
    "",
    "## Targets",
    "",
    ...brief.targets.map((target) => `- ${target.id}: ${target.url}`),
    "",
    "## Rewrite Instructions",
    "",
    brief.rewriteInstructions.length
      ? brief.rewriteInstructions.map(instructionMarkdown).join("\n\n")
      : "None.",
    "",
    "## Manual Review",
    "",
    brief.manualReview.length
      ? brief.manualReview.map(instructionMarkdown).join("\n\n")
      : "None.",
    "",
    "## Public Claim Flags",
    "",
    brief.publicClaimFlags.length
      ? brief.publicClaimFlags.map(publicClaimFlagMarkdown).join("\n")
      : "None.",
    "",
    "## Proof Gate Summary",
    "",
    brief.proofGateSummary.length
      ? brief.proofGateSummary
          .map(
            (item) =>
              `- ${item.id}: ${item.instruction} (owner: ${item.proofOwner}; canAgentEdit: ${item.canAgentEdit})`,
          )
          .join("\n")
      : "None.",
    "",
  ].join("\n");
}

export function prepareEditBriefFromAgentPlan(plan: ReportAgentEditPlan): EditBriefArtifact {
  const brief = createEditBrief(plan);

  return {
    brief,
    markdown: renderEditBriefMarkdown(brief),
    json: JSON.stringify(brief, null, 2),
  };
}

export function prepareEditBriefFromJson(json: string): EditBriefArtifact {
  return prepareEditBriefFromAgentPlan(parseReportAgentEditPlanJson(json));
}
