import { type ExtractedPage } from "./extract.js";
import {
  proofGateItemsForClaims,
  proofGateItemsForFindings,
  type ProofGateSummaryItem,
} from "./proofApproval.js";
import { type ClaimInventoryItem, type Finding, type Readiness } from "./schemas.js";

export type SinglePageReport = {
  markdown: string;
  agentEditPlanJson: string;
};

export type SourceReadinessItem = {
  moduleId: string;
  readiness: Readiness;
};

export type ReportBundleInput = {
  clientId: string;
  runId: string;
  generatedAt: string;
  title: string;
  pages: ExtractedPage[];
  findings: Finding[];
  sourceReadiness: SourceReadinessItem[];
  publicClaims?: ClaimInventoryItem[];
  recommendedNextStep?: string;
};

export type ReportSystemBundle = {
  executiveSummary: string;
  findingsCsv: string;
  pageRedlines: string;
  agentEditPlanJson: string;
  sourceReadiness: string;
  openQuestions: string;
  proofGateSummary: string;
};

function priorityRank(priority: Finding["priority"]): number {
  return { high: 0, medium: 1, low: 2 }[priority];
}

export function sortFindingsForReport(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
    return (
      priorityDelta ||
      a.targetId.localeCompare(b.targetId) ||
      a.id.localeCompare(b.id)
    );
  });
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function canAgentEditFinding(finding: Finding): boolean {
  return finding.canAgentEdit ?? finding.editReadiness === "ready";
}

function findingToCsvRow(finding: Finding): string {
  return [
    finding.id,
    finding.clientId,
    finding.targetId,
    finding.url,
    finding.priority,
    finding.mode,
    finding.label,
    finding.confidence,
    finding.editReadiness,
    finding.quotedText,
    finding.issue,
    finding.suggestedFix,
    finding.sourceRefs.join("; "),
    finding.proofNeeded,
    finding.claimCategory ?? "",
    finding.approvalStatus ?? "",
    String(finding.proofRequired ?? false),
    finding.proofOwner ?? "",
    String(canAgentEditFinding(finding)),
  ].map(csvCell).join(",");
}

export function findingToMarkdown(finding: Finding): string {
  return [
    `### ${finding.priority.toUpperCase()}: ${finding.label}`,
    "",
    `- Mode: \`${finding.mode}\``,
    `- Confidence: ${finding.confidence}`,
    `- Quote: "${finding.quotedText}"`,
    `- Issue: ${finding.issue}`,
    `- Suggested fix: ${finding.suggestedFix}`,
    `- Sources: ${finding.sourceRefs.join(", ")}`,
    `- Edit readiness: ${finding.editReadiness}`,
    `- Proof needed: ${finding.proofNeeded}`,
    finding.claimCategory ? `- Claim category: ${finding.claimCategory}` : undefined,
    finding.approvalStatus ? `- Approval status: ${finding.approvalStatus}` : undefined,
    finding.proofOwner ? `- Proof owner: ${finding.proofOwner}` : undefined,
    finding.canAgentEdit !== undefined ? `- Can agent edit: ${finding.canAgentEdit}` : undefined,
    finding.agentInstruction ? `- Agent instruction: ${finding.agentInstruction}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function findingToRedlineMarkdown(finding: Finding): string {
  return [
    `### ${finding.priority.toUpperCase()}: ${finding.label}`,
    "",
    `**Finding ID:** ${finding.id}`,
    `**Target:** ${finding.targetId}`,
    `**Mode:** ${finding.mode}`,
    `**Confidence:** ${finding.confidence}`,
    `**Edit readiness:** ${finding.editReadiness}`,
    "",
    "**Quoted text:**",
    "",
    `> ${finding.quotedText}`,
    "",
    `**Issue:** ${finding.issue}`,
    "",
    `**Suggested fix:** ${finding.suggestedFix}`,
    "",
    `**Sources:** ${finding.sourceRefs.join(", ")}`,
    "",
    `**Proof needed:** ${finding.proofNeeded}`,
    finding.claimCategory ? `**Claim category:** ${finding.claimCategory}` : undefined,
    finding.approvalStatus ? `**Approval status:** ${finding.approvalStatus}` : undefined,
    finding.proofOwner ? `**Proof owner:** ${finding.proofOwner}` : undefined,
    finding.canAgentEdit !== undefined ? `**Can agent edit:** ${finding.canAgentEdit}` : undefined,
    finding.agentInstruction ? `**Agent instruction:** ${finding.agentInstruction}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function riskyPublicClaims(claims: ClaimInventoryItem[] = []): ClaimInventoryItem[] {
  return claims.filter(
    (claim) =>
      claim.proofStatus !== "approved_proof" || claim.publicUseApproved !== true,
  );
}

export function generateReportBundle(input: ReportBundleInput): ReportSystemBundle {
  const pages = [...input.pages].sort((a, b) => a.id.localeCompare(b.id));
  const findings = sortFindingsForReport(input.findings);
  const highPriorityFindings = findings.filter((finding) => finding.priority === "high");
  const manualReviewFindings = findings.filter(
    (finding) =>
      finding.editReadiness === "manual_review" ||
      finding.editReadiness === "open_question",
  );
  const claimRisks = riskyPublicClaims(input.publicClaims);
  const proofGateSummaryItems = [
    ...proofGateItemsForFindings(findings),
    ...proofGateItemsForClaims(input.publicClaims),
  ];

  const executiveSummary = [
    `# ${input.title} - Executive Summary`,
    "",
    `Client: ${input.clientId}`,
    `Run: ${input.runId}`,
    `Generated: ${input.generatedAt}`,
    `Targets reviewed: ${pages.length}`,
    "",
    "## Priority Snapshot",
    "",
    `- High-priority findings: ${highPriorityFindings.length}`,
    `- Total findings: ${findings.length}`,
    `- Open questions / manual review items: ${manualReviewFindings.length}`,
    `- Public claim proof flags: ${claimRisks.length}`,
    "",
    "## Recommended Next Step",
    "",
    input.recommendedNextStep ??
      "Resolve high-priority findings and proof flags before preparing edits.",
    "",
  ].join("\n");

  const findingsCsv = [
    [
      "id",
      "clientId",
      "targetId",
      "url",
      "priority",
      "mode",
      "label",
      "confidence",
      "editReadiness",
      "quotedText",
      "issue",
      "suggestedFix",
      "sourceRefs",
      "proofNeeded",
      "claimCategory",
      "approvalStatus",
      "proofRequired",
      "proofOwner",
      "canAgentEdit",
    ].map(csvCell).join(","),
    ...findings.map(findingToCsvRow),
    "",
  ].join("\n");

  const pageRedlines = [
    `# ${input.title} - Page Redlines`,
    "",
    "## Targets",
    "",
    ...pages.map((page) => `- ${page.id}: ${page.url}`),
    "",
    "## Findings",
    "",
    findings.length
      ? findings.map(findingToRedlineMarkdown).join("\n\n---\n\n")
      : "No valid findings.",
    "",
  ].join("\n");

  const agentEditPlanJson = JSON.stringify(
    {
      clientId: input.clientId,
      runId: input.runId,
      generatedAt: input.generatedAt,
      targets: pages.map((page) => ({
        id: page.id,
        url: page.url,
        title: page.title,
      })),
      findings,
      openQuestions: manualReviewFindings.map((finding) => ({
        findingId: finding.id,
        targetId: finding.targetId,
        proofNeeded: finding.proofNeeded,
        editReadiness: finding.editReadiness,
        claimCategory: finding.claimCategory,
        approvalStatus: finding.approvalStatus,
        proofRequired: finding.proofRequired,
        proofOwner: finding.proofOwner,
        canAgentEdit: finding.canAgentEdit,
        agentInstruction: finding.agentInstruction,
      })),
      publicClaimFlags: claimRisks.map((claim) => ({
        claimId: claim.id,
        claim: claim.claim,
        claimCategory: claim.claimCategory,
        proofStatus: claim.proofStatus,
        publicUseApproved: claim.publicUseApproved,
        approvalStatus: claim.approvalStatus,
        proofRequired: claim.proofRequired,
        proofOwner: claim.proofOwner,
        canAgentEdit: claim.canAgentEdit,
        riskNotes: claim.riskNotes,
      })),
      proofGateSummary: proofGateSummaryItems,
    },
    null,
    2,
  );

  const sourceReadiness = [
    `# ${input.title} - Source Readiness`,
    "",
    "| Module | Readiness |",
    "| --- | --- |",
    ...[...input.sourceReadiness]
      .sort((a, b) => a.moduleId.localeCompare(b.moduleId))
      .map((item) => `| ${item.moduleId} | ${item.readiness} |`),
    "",
  ].join("\n");

  const openQuestions = [
    `# ${input.title} - Open Questions`,
    "",
    "## Findings Needing Review",
    "",
    manualReviewFindings.length
      ? manualReviewFindings
          .map(
            (finding) =>
              `- ${finding.id} (${finding.editReadiness}): ${finding.proofNeeded}`,
          )
          .join("\n")
      : "None.",
    "",
    "## Public Claim Proof Flags",
    "",
    claimRisks.length
      ? claimRisks
          .map(
            (claim) =>
              `- ${claim.id} (${claim.claimCategory ?? "uncategorized"}, ${claim.proofStatus}, approval: ${claim.approvalStatus ?? "needs_client_approval"}, publicUseApproved: ${claim.publicUseApproved}): ${claim.claim}`,
          )
          .join("\n")
      : "None.",
    "",
  ].join("\n");

  const proofGateSummary = [
    `# ${input.title} - Proof Gate Summary`,
    "",
    proofGateSummaryItems.length
      ? proofGateSummaryItems.map(proofGateItemMarkdown).join("\n\n")
      : "No proof-gated claims.",
    "",
  ].join("\n");

  return {
    executiveSummary,
    findingsCsv,
    pageRedlines,
    agentEditPlanJson,
    sourceReadiness,
    openQuestions,
    proofGateSummary,
  };
}

function proofGateItemMarkdown(item: ProofGateSummaryItem): string {
  return [
    `## ${item.id}: ${item.label}`,
    "",
    item.claimCategory ? `- Claim category: ${item.claimCategory}` : undefined,
    `- Approval status: ${item.approvalStatus}`,
    `- Proof owner: ${item.proofOwner}`,
    `- Can agent edit: ${item.canAgentEdit}`,
    `- Instruction: ${item.instruction}`,
    `- Sources: ${item.sourceRefs.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function generateSinglePageReport(
  page: ExtractedPage,
  findings: Finding[],
): SinglePageReport {
  const markdown = [
    `# ${page.title || page.url}`,
    "",
    `URL: ${page.url}`,
    "",
    "## Extracted Page",
    "",
    `- Meta description: ${page.metaDescription || "None"}`,
    `- Headings: ${page.headings.length ? page.headings.join(" | ") : "None"}`,
    `- Links: ${page.links.length}`,
    "",
    "## Findings",
    "",
    findings.length
      ? findings.map((finding) => findingToMarkdown(finding)).join("\n\n")
      : "No valid findings.",
    "",
  ].join("\n");

  const agentEditPlanJson = JSON.stringify(
    {
      target: {
        id: page.id,
        url: page.url,
        title: page.title,
      },
      findings,
    },
    null,
    2,
  );

  return {
    markdown,
    agentEditPlanJson,
  };
}
