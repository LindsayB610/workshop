import {
  reportAgentEditPlanSchema,
  type Finding,
  type ReportAgentEditPlan,
} from "@redline/core/schemas";
import demoAgentEditPlan from "../../../../../clients/demo-redline/reports/launch-review/agent-edit-plan.json";
import demoSourceManifest from "../../../../../clients/demo-redline/source-manifest.json";

export type SourceReadinessRow = {
  moduleId: string;
  readiness: "strong" | "partial" | "missing";
};

export type PacketHealthIssue = {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
};

export type AuditTargetOption = {
  id: string;
  label: string;
  type: "saved_fixture" | "local_file" | "pasted_draft" | "queued_url";
  path: string;
  reportTargetId?: string;
  sourceUrl?: string;
  finalUrl?: string;
  snapshotAt?: string;
  snapshotPath?: string;
  textPath?: string;
  role?: "current_reproducible_audit_target" | "previous_baseline" | "draft" | "queued_live_url";
};

export type FindingSummary = {
  id: string;
  mode: Finding["mode"];
  priority: "high" | "medium" | "low";
  confidence: Finding["confidence"];
  editReadiness: "ready" | "manual_review" | "open_question";
  label: string;
  locatorText: string;
  issue: string;
  suggestedFix: string;
  sourceRefs: string[];
  sourceEvidence: SourceEvidence[];
  proofNeeded?: string;
  claimCategory?: Finding["claimCategory"];
  approvalStatus?: Finding["approvalStatus"];
  proofRequired?: boolean;
  proofOwner?: string;
  canAgentEdit?: boolean;
  agentInstruction?: string;
  route: "agent_ready" | "manual_review" | "proof_review";
  editBriefSnippet: string;
};

export type SourceEvidence = {
  id: string;
  label: string;
  path: string;
  type: string;
  tier: string;
};

export type ReportArtifact = {
  label: string;
  path: string;
  type: "markdown" | "json" | "csv";
  available: boolean;
};

export type SavedReportRegistration = {
  id: string;
  targetIds: string[];
  report: ReportAgentEditPlan;
  path: string;
  artifacts: ReportArtifact[];
};

export type RedlineWorkspace = {
  clientId: string;
  clientName: string;
  packetPath: string;
  savedReport?: ReportAgentEditPlan;
  savedReportPath?: string;
  savedReports?: SavedReportRegistration[];
  targetLabel: string;
  targetPath: string;
  generatedAt: string;
  healthIssues: PacketHealthIssue[];
  targets: AuditTargetOption[];
  readiness: SourceReadinessRow[];
  findings: FindingSummary[];
  artifacts: ReportArtifact[];
};

export type PacketHealthSummary = {
  errors: number;
  warnings: number;
  info: number;
  status: "ready" | "review" | "blocked";
};

export type SavedAuditRunResult = {
  status: "completed" | "blocked";
  targetId: string;
  targetType?: AuditTargetOption["type"];
  reportId?: string;
  generatedAt: string;
  findingsCount: number;
  artifactsCount: number;
  message: string;
};

export type RedlineReportExportFile = {
  path: string;
  contents: string;
};

export type ReviewRouteFilter = "all" | "agent_ready" | "manual_review" | "proof_review";
export type ReviewPriorityFilter = "all" | FindingSummary["priority"];
export type ReviewModeFilter = "all" | FindingSummary["mode"];

export type ReviewFilters = {
  route: ReviewRouteFilter;
  priority: ReviewPriorityFilter;
  mode: ReviewModeFilter;
};

export type ReviewQueueSummary = {
  total: number;
  agentReady: number;
  manualReview: number;
  proofReview: number;
};

export const redlineSavedReports = {
  demo: reportAgentEditPlanSchema.parse(demoAgentEditPlan),
} as const satisfies Record<string, ReportAgentEditPlan>;

type SourceManifestEntry = {
  id: string;
  title?: string;
  path?: string;
  type?: string;
  tier?: string;
};

const redlineSourceManifests = {
  "demo-redline": demoSourceManifest,
} as const;

function sourceEvidenceForFinding(
  clientId: string,
  sourceRefs: string[],
): SourceEvidence[] {
  const manifest = redlineSourceManifests[clientId as keyof typeof redlineSourceManifests] as
    | { sources?: SourceManifestEntry[] }
    | undefined;
  const sourceIndex = new Map(
    (manifest?.sources ?? []).map((source) => [source.id, source] as const),
  );

  return sourceRefs.map((sourceRef) => {
    const source = sourceIndex.get(sourceRef);
    const sourcePath = source?.path ?? "source-manifest.json";

    return {
      id: sourceRef,
      label: source?.title ?? sourceRef,
      path: `clients/${clientId}/${sourcePath}`,
      type: source?.type ?? "unknown",
      tier: source?.tier ?? "unknown",
    };
  });
}

function summarizeFindings(report: ReportAgentEditPlan): FindingSummary[] {
  return report.findings.map((finding) => ({
    id: finding.id,
    mode: finding.mode,
    priority: finding.priority,
    confidence: finding.confidence,
    editReadiness: finding.editReadiness,
    label: finding.label,
    locatorText: finding.quotedText,
    issue: finding.issue,
    suggestedFix: finding.suggestedFix,
    sourceRefs: finding.sourceRefs,
    sourceEvidence: sourceEvidenceForFinding(report.clientId, finding.sourceRefs),
    proofNeeded: finding.proofNeeded,
    claimCategory: finding.claimCategory,
    approvalStatus: finding.approvalStatus,
    proofRequired: finding.proofRequired,
    proofOwner: finding.proofOwner,
    canAgentEdit: finding.canAgentEdit,
    agentInstruction: finding.agentInstruction,
    route: routeForFinding(finding),
    editBriefSnippet: buildEditBriefSnippet({
      id: finding.id,
      label: finding.label,
      quotedText: finding.quotedText,
      issue: finding.issue,
      suggestedFix: finding.suggestedFix,
      sourceRefs: finding.sourceRefs,
      proofNeeded: finding.proofNeeded,
      editReadiness: finding.editReadiness,
      claimCategory: finding.claimCategory,
      approvalStatus: finding.approvalStatus,
      proofOwner: finding.proofOwner,
      canAgentEdit: finding.canAgentEdit,
      agentInstruction: finding.agentInstruction,
    }),
  }));
}

function routeForFinding(finding: Finding): FindingSummary["route"] {
  if (finding.canAgentEdit === false) {
    return "proof_review";
  }

  if (finding.editReadiness === "ready") {
    return "agent_ready";
  }

  return finding.editReadiness === "open_question" ? "proof_review" : "manual_review";
}

function buildEditBriefSnippet(finding: {
  id: string;
  label: string;
  quotedText: string;
  issue: string;
  suggestedFix: string;
  sourceRefs: string[];
  proofNeeded?: string;
  editReadiness: FindingSummary["editReadiness"];
  claimCategory?: Finding["claimCategory"];
  approvalStatus?: Finding["approvalStatus"];
  proofOwner?: string;
  canAgentEdit?: boolean;
  agentInstruction?: string;
}) {
  return [
    `## ${finding.id}: ${finding.label}`,
    "",
    `Readiness: ${finding.editReadiness}`,
    `Quoted text: "${finding.quotedText}"`,
    `Issue: ${finding.issue}`,
    `Recommended action: ${finding.suggestedFix}`,
    `Sources: ${finding.sourceRefs.join(", ")}`,
    finding.proofNeeded ? `Proof needed: ${finding.proofNeeded}` : undefined,
    finding.claimCategory ? `Claim category: ${finding.claimCategory}` : undefined,
    finding.approvalStatus ? `Approval status: ${finding.approvalStatus}` : undefined,
    finding.proofOwner ? `Proof owner: ${finding.proofOwner}` : undefined,
    finding.canAgentEdit !== undefined ? `Can agent edit: ${finding.canAgentEdit}` : undefined,
    finding.agentInstruction ? `Agent instruction: ${finding.agentInstruction}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

const demoSavedReport = redlineSavedReports.demo;

const demoLaunchReviewArtifacts = [
  {
    label: "Executive summary",
    path: "clients/demo-redline/reports/launch-review/executive-summary.md",
    type: "markdown",
    available: true,
  },
  {
    label: "Page redlines",
    path: "clients/demo-redline/reports/launch-review/page-redlines.md",
    type: "markdown",
    available: true,
  },
  {
    label: "Agent edit plan",
    path: "clients/demo-redline/reports/launch-review/agent-edit-plan.json",
    type: "json",
    available: true,
  },
  {
    label: "Edit brief",
    path: "clients/demo-redline/reports/launch-review/edit-brief.md",
    type: "markdown",
    available: true,
  },
  {
    label: "Findings",
    path: "clients/demo-redline/reports/launch-review/findings.csv",
    type: "csv",
    available: true,
  },
  {
    label: "Open questions",
    path: "clients/demo-redline/reports/launch-review/open-questions.md",
    type: "markdown",
    available: true,
  },
  {
    label: "Proof gate summary",
    path: "clients/demo-redline/reports/launch-review/proof-gate-summary.md",
    type: "markdown",
    available: true,
  },
] satisfies ReportArtifact[];

export const redlineWorkspaces: RedlineWorkspace[] = [
  {
    clientId: "demo-redline",
    clientName: "Northstar Demo Co.",
    packetPath: "clients/demo-redline",
    savedReport: demoSavedReport,
    savedReportPath:
      "clients/demo-redline/reports/launch-review/agent-edit-plan.json",
    savedReports: [
      {
        id: "demo-launch-review",
        targetIds: ["demo-landing-page"],
        report: demoSavedReport,
        path: "clients/demo-redline/reports/launch-review/agent-edit-plan.json",
        artifacts: demoLaunchReviewArtifacts,
      },
    ],
    targetLabel: "Demo landing page fixture",
    targetPath:
      "clients/demo-redline/targets/fixtures/landing-page.html",
    generatedAt: demoSavedReport.generatedAt,
    healthIssues: [
      {
        id: "demo-proof-library-partial",
        severity: "warning",
        message: "Demo proof library is usable but quantitative claims still need approval.",
      },
      {
        id: "demo-nonblocking",
        severity: "info",
        message: "Demo packet is ready for saved landing-page audit replay.",
      },
    ] satisfies PacketHealthIssue[],
    targets: [
      {
        id: "demo-landing-page",
        label: "Demo landing page fixture",
        type: "saved_fixture",
        path: "clients/demo-redline/targets/fixtures/landing-page.html",
        sourceUrl: "workshop://demo-redline/landing-page",
        snapshotAt: "2026-06-23T00:00:00.000Z",
        snapshotPath: "clients/demo-redline/targets/snapshots/landing-page.md",
        textPath: "clients/demo-redline/targets/extracted/landing-page.txt",
        role: "current_reproducible_audit_target",
      },
      {
        id: "local-demo-html",
        label: "Local demo HTML",
        type: "local_file",
        path: "clients/demo-redline/targets/fixtures/landing-page.html",
      },
      {
        id: "pasted-demo-draft",
        label: "Pasted demo draft",
        type: "pasted_draft",
        path: "workshop://drafts/demo-redline-landing-page",
        role: "draft",
      },
      {
        id: "queued-demo-page",
        label: "Queued demo URL",
        type: "queued_url",
        path: "workshop://demo-redline/landing-page",
        reportTargetId: "demo-landing-page",
        sourceUrl: "workshop://demo-redline/landing-page",
        role: "queued_live_url",
      },
    ] satisfies AuditTargetOption[],
    readiness: [
      { moduleId: "buyer-language", readiness: "strong" },
      { moduleId: "positioning", readiness: "strong" },
      { moduleId: "proof-library", readiness: "partial" },
    ] satisfies SourceReadinessRow[],
    findings: summarizeFindings(demoSavedReport),
    artifacts: demoLaunchReviewArtifacts,
  },
  {
    clientId: "fixture",
    clientName: "Fixture Client",
    packetPath: "clients/fixture",
    targetLabel: "Fixture landing page",
    targetPath: "clients/fixture/targets/fixtures/landing-page.html",
    generatedAt: "2026-06-20T00:00:00.000Z",
    healthIssues: [
      {
        id: "fixture-buyer-language-partial",
        severity: "warning",
        message: "Buyer-language module is intentionally partial in the fixture packet.",
      },
    ] satisfies PacketHealthIssue[],
    targets: [
      {
        id: "fixture-landing-page",
        label: "Fixture landing page",
        type: "saved_fixture",
        path: "clients/fixture/targets/fixtures/landing-page.html",
      },
      {
        id: "fixture-pasted-draft",
        label: "Fixture pasted draft",
        type: "pasted_draft",
        path: "workshop://drafts/fixture-landing-page",
      },
    ] satisfies AuditTargetOption[],
    readiness: [
      { moduleId: "positioning", readiness: "strong" },
      { moduleId: "buyer-language", readiness: "partial" },
    ] satisfies SourceReadinessRow[],
    findings: [
      {
        id: "fixture-landing-f1",
        mode: "message_alignment",
        priority: "medium",
        confidence: "medium",
        editReadiness: "ready",
        label: "Hero does not name the operational buyer",
        locatorText: "Launch your next workflow faster.",
        issue: "The hero promise is broad and does not name the buyer or decision trigger.",
        suggestedFix: "Rewrite the hero around the operational buyer and the problem they are trying to solve.",
        sourceRefs: ["fixture-positioning"],
        sourceEvidence: [
          {
            id: "fixture-positioning",
            label: "Fixture positioning",
            path: "clients/fixture/canonical/positioning.md",
            type: "local",
            tier: "canonical",
          },
        ],
        route: "agent_ready",
        editBriefSnippet:
          "## fixture-landing-f1: Hero does not name the operational buyer\n\nReadiness: ready\nQuoted text: \"Launch your next workflow faster.\"\nIssue: The hero promise is broad and does not name the buyer or decision trigger.\nRecommended action: Rewrite the hero around the operational buyer and the problem they are trying to solve.\nSources: fixture-positioning",
      },
      {
        id: "fixture-landing-f2",
        mode: "proof_gap",
        priority: "low",
        confidence: "medium",
        editReadiness: "manual_review",
        label: "Efficiency proof needs an approved customer source",
        locatorText: "Teams save hours every week.",
        issue: "The proof claim is plausible but lacks an approved customer source.",
        suggestedFix: "Route the claim to a human reviewer before using it in public copy.",
        sourceRefs: ["fixture-proof"],
        sourceEvidence: [
          {
            id: "fixture-proof",
            label: "Fixture proof notes",
            path: "clients/fixture/canonical/proof-library.md",
            type: "local",
            tier: "canonical",
          },
        ],
        proofNeeded: "Approved customer quote or measurement source.",
        route: "manual_review",
        editBriefSnippet:
          "## fixture-landing-f2: Efficiency proof needs an approved customer source\n\nReadiness: manual_review\nQuoted text: \"Teams save hours every week.\"\nIssue: The proof claim is plausible but lacks an approved customer source.\nRecommended action: Route the claim to a human reviewer before using it in public copy.\nSources: fixture-proof\nProof needed: Approved customer quote or measurement source.",
      },
    ] satisfies FindingSummary[],
    artifacts: [
      {
        label: "Executive summary",
        path: "clients/fixture/reports/landing-page/executive-summary.md",
        type: "markdown",
        available: false,
      },
      {
        label: "Page redlines",
        path: "clients/fixture/reports/landing-page/page-redlines.md",
        type: "markdown",
        available: false,
      },
      {
        label: "Agent edit plan",
        path: "clients/fixture/reports/landing-page/agent-edit-plan.json",
        type: "json",
        available: false,
      },
    ] satisfies ReportArtifact[],
  },
];

export const defaultRedlineClientId = redlineWorkspaces[0].clientId;

export const demoRedlineWorkspace = redlineWorkspaces[0];

export function getRedlineWorkspace(clientId: string): RedlineWorkspace {
  return (
    redlineWorkspaces.find((workspace) => workspace.clientId === clientId) ??
    redlineWorkspaces[0]
  );
}

export function summarizeReadiness(rows: SourceReadinessRow[]) {
  return rows.reduce(
    (summary, row) => ({
      ...summary,
      [row.readiness]: summary[row.readiness] + 1,
    }),
    { strong: 0, partial: 0, missing: 0 },
  );
}

export function summarizeReviewQueue(findings: FindingSummary[]): ReviewQueueSummary {
  return findings.reduce(
    (summary, finding) => ({
      total: summary.total + 1,
      agentReady: summary.agentReady + (finding.route === "agent_ready" ? 1 : 0),
      manualReview: summary.manualReview + (finding.route === "manual_review" ? 1 : 0),
      proofReview: summary.proofReview + (finding.route === "proof_review" ? 1 : 0),
    }),
    { total: 0, agentReady: 0, manualReview: 0, proofReview: 0 },
  );
}

export function filterReviewQueue(
  findings: FindingSummary[],
  filters: ReviewFilters,
) {
  return findings.filter((finding) => {
    const routeMatches = filters.route === "all" || finding.route === filters.route;
    const priorityMatches =
      filters.priority === "all" || finding.priority === filters.priority;
    const modeMatches = filters.mode === "all" || finding.mode === filters.mode;

    return routeMatches && priorityMatches && modeMatches;
  });
}

export function summarizePacketHealth(issues: PacketHealthIssue[]): PacketHealthSummary {
  const summary = issues.reduce(
    (totals, issue) => {
      if (issue.severity === "error") {
        return { ...totals, errors: totals.errors + 1 };
      }

      if (issue.severity === "warning") {
        return { ...totals, warnings: totals.warnings + 1 };
      }

      return { ...totals, info: totals.info + 1 };
    },
    { errors: 0, warnings: 0, info: 0 },
  );

  return {
    ...summary,
    status: summary.errors > 0 ? "blocked" : summary.warnings > 0 ? "review" : "ready",
  };
}

function expectedReportTargetIdForTarget(target: AuditTargetOption): string {
  return target.reportTargetId ?? target.id;
}

function savedReportRegistrationForTarget(
  workspace: RedlineWorkspace,
  target: AuditTargetOption,
): SavedReportRegistration | undefined {
  const expectedReportTargetId = expectedReportTargetIdForTarget(target);

  return workspace.savedReports?.find((registration) =>
    registration.targetIds.includes(expectedReportTargetId),
  );
}

export function getReportArtifactsForTarget(
  workspace: RedlineWorkspace,
  targetId: string,
): ReportArtifact[] {
  const target = workspace.targets.find((candidate) => candidate.id === targetId);

  if (!target) {
    return workspace.artifacts;
  }

  return savedReportRegistrationForTarget(workspace, target)?.artifacts ?? workspace.artifacts;
}

export function runSavedAudit(
  workspace: RedlineWorkspace,
  targetId: string,
): SavedAuditRunResult {
  const target = workspace.targets.find((candidate) => candidate.id === targetId);
  const health = summarizePacketHealth(workspace.healthIssues);
  const reportRegistration = target
    ? savedReportRegistrationForTarget(workspace, target)
    : undefined;
  const report = reportRegistration?.report ?? workspace.savedReport;
  const expectedReportTargetId = target ? expectedReportTargetIdForTarget(target) : undefined;
  const reportTarget = report?.targets.find(
    (candidate) => candidate.id === expectedReportTargetId,
  );
  const reportArtifacts = reportRegistration?.artifacts ?? workspace.artifacts;

  if (
    !target ||
    !report ||
    health.status === "blocked" ||
    (target.type === "saved_fixture" && !reportTarget)
  ) {
    return {
      status: "blocked",
      targetId,
      targetType: target?.type,
      generatedAt: new Date(0).toISOString(),
      findingsCount: 0,
      artifactsCount: 0,
      message: !target
        ? "Choose a valid saved target before running Redline."
        : !report
          ? "No checked-in report metadata is available for this client yet."
          : health.status === "blocked"
            ? "Packet has blocking validation issues."
            : `No checked-in report metadata matches ${target.label}. Run a fresh audit before exporting reports for this target.`,
    };
  }

  return {
    status: "completed",
    targetId: target.id,
    targetType: target.type,
    reportId: reportRegistration?.id,
    generatedAt: report.generatedAt,
    findingsCount: report.findings.length,
    artifactsCount: reportArtifacts.filter((artifact) => artifact.available).length,
    message:
      reportArtifacts.some((artifact) => artifact.available)
        ? `${target.type === "saved_fixture" ? "Saved" : "Local"} audit run completed from the selected ${target.type.replace("_", " ")} target. Reports are ready to export or open.`
        : `${target.type === "saved_fixture" ? "Saved" : "Local"} audit run completed. Report files have not been exported yet.`,
  };
}

export function buildReportExportFiles(
  workspace: RedlineWorkspace,
  result: SavedAuditRunResult,
): RedlineReportExportFile[] {
  const target = workspace.targets.find((candidate) => candidate.id === result.targetId);
  const reportRegistration = target
    ? savedReportRegistrationForTarget(workspace, target)
    : undefined;
  const report = reportRegistration?.report ?? workspace.savedReport;
  const exportRoot = `clients/${workspace.clientId}/reports/workshop-local-run`;

  if (!report || result.status !== "completed") {
    return [];
  }

  return [
    {
      path: `${exportRoot}/run-summary.md`,
      contents: [
        `# ${workspace.clientName} Workshop Run`,
        "",
        `Client: ${workspace.clientId}`,
        `Target: ${result.targetId}`,
        `Target type: ${result.targetType ?? "unknown"}`,
        `Generated: ${result.generatedAt}`,
        `Findings: ${result.findingsCount}`,
        "",
        result.message,
        "",
      ].join("\n"),
    },
    {
      path: `${exportRoot}/agent-edit-plan.json`,
      contents: JSON.stringify(report, null, 2),
    },
  ];
}
