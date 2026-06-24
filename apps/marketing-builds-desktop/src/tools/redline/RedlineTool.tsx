import {
  CheckCircle2,
  Clipboard,
  Download,
  Eye,
  FileJson,
  FileText,
  FolderOpen,
  ListFilter,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  dispatchWorkbenchRouteSelected,
} from "../../app-shell/workbenchRouteEvents";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";
import type { ToolViewProps } from "../types";
import { RedlineOnboarding } from "./RedlineOnboarding";
import { openRedlineArtifact, type ArtifactOpenResult } from "./redlineActions";
import { exportRedlineReports, type ReportExportResult } from "./reportActions";
import { snapshotLiveTarget, type LiveSnapshotResult } from "./snapshotActions";
import {
  buildReportExportFiles,
  defaultRedlineClientId,
  filterReviewQueue,
  getReportArtifactsForTarget,
  getRedlineWorkspace,
  redlineWorkspaces,
  runSavedAudit,
  summarizePacketHealth,
  summarizeReadiness,
  summarizeReviewQueue,
  type FindingSummary,
  type AuditTargetOption,
  type ReviewFilters,
  type ReviewModeFilter,
  type ReviewPriorityFilter,
  type ReviewRouteFilter,
  type SavedAuditRunResult,
} from "./redlineData";

const readinessTone = {
  strong: "pink",
  partial: "yellow",
  missing: "red",
} as const;

const artifactIcon = {
  markdown: FileText,
  json: FileJson,
  csv: FileText,
};

const reviewFilterLabels = {
  all: "All",
  agent_ready: "Agent Ready",
  manual_review: "Manual Review",
  proof_review: "Proof Review",
} as const satisfies Record<ReviewRouteFilter, string>;

const priorityFilterLabels = {
  all: "All priorities",
  high: "High",
  medium: "Medium",
  low: "Low",
} as const satisfies Record<ReviewPriorityFilter, string>;

const modeFilterLabels = {
  all: "All modes",
  message_alignment: "Message alignment",
  buyer_language: "Buyer language",
  proof_gap: "Proof gap",
  objection_coverage: "Objection coverage",
  geo_readiness: "GEO readiness",
} as const satisfies Record<ReviewModeFilter, string>;

const routeTone = {
  agent_ready: "pink",
  manual_review: "yellow",
  proof_review: "red",
} as const;

const redlineSections = [
  { id: "audit", label: "Audit" },
  { id: "review", label: "Review" },
  { id: "packet", label: "Packet" },
  { id: "onboarding", label: "Onboarding" },
] as const;

type RedlineSection = (typeof redlineSections)[number]["id"];

function isRedlineSection(sectionId: string): sectionId is RedlineSection {
  return redlineSections.some((section) => section.id === sectionId);
}

function reviewRouteLabel(route: FindingSummary["route"]) {
  return reviewFilterLabels[route];
}

function artifactActionMessage(action: ArtifactOpenResult) {
  return action.status === "opened"
    ? `Opened ${action.path}`
    : action.status === "copied"
      ? `Copied ${action.path}`
      : action.message;
}

export function RedlineTool({ activeRouteId, tool }: ToolViewProps) {
  const [activeClientId, setActiveClientId] = useState(defaultRedlineClientId);
  const selectedWorkbenchSection: RedlineSection =
    activeRouteId && isRedlineSection(activeRouteId) ? activeRouteId : "audit";
  const [activeSection, setActiveSection] =
    useState<RedlineSection>(selectedWorkbenchSection);
  const [reviewFilters, setReviewFilters] = useState<ReviewFilters>({
    route: "all",
    priority: "all",
    mode: "all",
  });
  const [copiedFindingId, setCopiedFindingId] = useState<string | null>(null);
  const [selectedTargetIdByClient, setSelectedTargetIdByClient] = useState<
    Record<string, string>
  >({});
  const [runResultByClient, setRunResultByClient] = useState<
    Record<string, SavedAuditRunResult>
  >({});
  const [snapshotTargetsByClient, setSnapshotTargetsByClient] = useState<
    Record<string, AuditTargetOption[]>
  >({});
  const [snapshotAction, setSnapshotAction] = useState<LiveSnapshotResult | null>(null);
  const [artifactAction, setArtifactAction] = useState<ArtifactOpenResult | null>(null);
  const [reportExportAction, setReportExportAction] =
    useState<ReportExportResult | null>(null);
  const baseWorkspace = getRedlineWorkspace(activeClientId);
  const workspace = {
    ...baseWorkspace,
    targets: [
      ...(snapshotTargetsByClient[baseWorkspace.clientId] ?? []),
      ...baseWorkspace.targets,
    ],
  };
  const selectedTargetId =
    selectedTargetIdByClient[workspace.clientId] ?? workspace.targets[0]?.id ?? "";
  const selectedTarget = workspace.targets.find((target) => target.id === selectedTargetId);
  const runResult = runResultByClient[workspace.clientId];
  const readiness = summarizeReadiness(workspace.readiness);
  const health = summarizePacketHealth(workspace.healthIssues);
  const readyFindings = workspace.findings.filter(
    (finding) => finding.editReadiness === "ready",
  );
  const reviewFindings = workspace.findings.filter(
    (finding) => finding.editReadiness !== "ready",
  );
  const reviewQueue = filterReviewQueue(workspace.findings, reviewFilters);
  const reviewSummary = summarizeReviewQueue(workspace.findings);
  const reportArtifacts = getReportArtifactsForTarget(
    workspace,
    runResult?.targetId ?? selectedTargetId,
  );
  const availableArtifacts = reportArtifacts.filter((artifact) => artifact.available);
  const previewArtifacts = reportArtifacts;

  useEffect(() => {
    setActiveSection(selectedWorkbenchSection);
  }, [selectedWorkbenchSection]);

  function selectSection(sectionId: RedlineSection, announce = true) {
    setActiveSection(sectionId);

    if (!announce) {
      return;
    }

    const route = tool.routes.find((candidate) => candidate.id === sectionId);
    if (route) {
      dispatchWorkbenchRouteSelected(tool.id, route);
    }
  }

  function selectClient(clientId: string) {
    setActiveClientId(clientId);
    selectSection("audit");
    setReviewFilters({ route: "all", priority: "all", mode: "all" });
    setCopiedFindingId(null);
    setSnapshotAction(null);
    setArtifactAction(null);
    setReportExportAction(null);
  }

  function selectTarget(targetId: string) {
    setSelectedTargetIdByClient((current) => ({
      ...current,
      [workspace.clientId]: targetId,
    }));
    setRunResultByClient((current) => {
      const next = { ...current };
      delete next[workspace.clientId];
      return next;
    });
    setCopiedFindingId(null);
    setSnapshotAction(null);
    setArtifactAction(null);
    setReportExportAction(null);
  }

  function runAudit() {
    setRunResultByClient((current) => ({
      ...current,
      [workspace.clientId]: runSavedAudit(workspace, selectedTargetId),
    }));
    setCopiedFindingId(null);
    setSnapshotAction(null);
    setArtifactAction(null);
    setReportExportAction(null);
  }

  async function snapshotSelectedTarget() {
    const result = await snapshotLiveTarget(workspace, selectedTarget);
    setSnapshotAction(result);
    setArtifactAction(null);
    setReportExportAction(null);
    setCopiedFindingId(null);

    if (result.status !== "snapshotted") {
      return;
    }

    setSnapshotTargetsByClient((current) => {
      const existing = current[workspace.clientId] ?? [];
      const nextTargets = [
        result.target,
        ...existing.filter((target) => target.id !== result.target.id),
      ];

      return {
        ...current,
        [workspace.clientId]: nextTargets,
      };
    });
    setSelectedTargetIdByClient((current) => ({
      ...current,
      [workspace.clientId]: result.target.id,
    }));
    setRunResultByClient((current) => {
      const next = { ...current };
      delete next[workspace.clientId];
      return next;
    });
  }

  async function openArtifact(path: string) {
    const result = await openRedlineArtifact(path);
    setArtifactAction(result);
  }

  async function exportReports() {
    if (!runResult) {
      return;
    }

    setReportExportAction(
      await exportRedlineReports(workspace, buildReportExportFiles(workspace, runResult)),
    );
  }

  async function copyFindingSnippet(finding: FindingSummary) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(finding.editBriefSnippet);
      setCopiedFindingId(finding.id);
      return;
    }

    setCopiedFindingId(finding.id);
  }

  return (
    <div className="redline-shell">
      <aside className="redline-client-rail" aria-label="Client workspaces">
        <div className="redline-client-stack">
          {redlineWorkspaces.map((candidate) => {
            const candidateHealth = summarizePacketHealth(candidate.healthIssues);
            return (
              <button
                key={candidate.clientId}
                aria-label={`Open ${candidate.clientName}`}
                className={
                  candidate.clientId === workspace.clientId
                    ? "redline-client-button redline-client-button-active"
                    : "redline-client-button"
                }
                onClick={() => selectClient(candidate.clientId)}
                title={candidate.clientName}
                type="button"
              >
                <span>{candidate.clientName.slice(0, 1)}</span>
                <small
                  className={`redline-client-status redline-client-status-${candidateHealth.status}`}
                />
              </button>
            );
          })}
        </div>
        <button
          aria-label="Add new Redline client"
          className="redline-client-button redline-client-add"
          onClick={() => selectSection("onboarding")}
          title="Add New Client"
          type="button"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </aside>

      <div className="redline-layout">
        <Panel className="workspace-summary workspace-summary-compact">
          <div className="summary-main">
            <div>
              <p className="eyebrow">{workspace.clientId}</p>
              <h2>{workspace.clientName}</h2>
            </div>
          </div>

          <div className="summary-details">
            <div>
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{workspace.packetPath}</span>
            </div>
            <div>
              <ShieldAlert size={18} aria-hidden="true" />
              <span>
                {readiness.strong} strong, {readiness.partial} partial,{" "}
                {readiness.missing} missing
              </span>
            </div>
            <div>
              <FileText size={18} aria-hidden="true" />
              <span>{selectedTarget?.label ?? workspace.targetLabel}</span>
            </div>
          </div>
        </Panel>

        {activeSection === "audit" ? (
          <Panel className="workspace-summary" id="redline-audit">
            <div className="panel-heading">
              <Play size={18} aria-hidden="true" />
              <h3>Audit</h3>
            </div>

            <div className="local-workflow-grid">
              <div className="workflow-control">
                <label htmlFor="redline-target-select">Audit target</label>
                <select
                  id="redline-target-select"
                  value={selectedTargetId}
                  onChange={(event) => selectTarget(event.target.value)}
                >
                  {workspace.targets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.label}
                    </option>
                  ))}
                </select>
                <small>{selectedTarget?.path ?? "No saved target selected."}</small>
                {selectedTarget?.snapshotAt ? (
                  <small>
                    Snapshot: {selectedTarget.snapshotAt.slice(0, 10)} from{" "}
                    {selectedTarget.finalUrl ?? selectedTarget.sourceUrl ?? selectedTarget.path}
                  </small>
                ) : null}
                {selectedTarget?.role ? <small>Role: {selectedTarget.role}</small> : null}
                {selectedTarget?.snapshotPath ? (
                  <small>{selectedTarget.snapshotPath}</small>
                ) : null}
              </div>

              <div className="workflow-status">
                <Badge tone={health.status === "blocked" ? "red" : "yellow"}>
                  {health.status}
                </Badge>
                <span>
                  {health.errors} errors, {health.warnings} warnings, {health.info} info
                </span>
              </div>
            </div>

            <div className="summary-actions">
              <div className="status-metrics compact">
                <span>
                  <strong>{workspace.findings.length}</strong>
                  findings
                </span>
                <span>
                  <strong>{readyFindings.length}</strong>
                  ready
                </span>
                <span>
                  <strong>{reviewFindings.length}</strong>
                  gated
                </span>
              </div>
              <div className="workflow-actions">
                <Button onClick={() => void openArtifact(workspace.packetPath)} variant="secondary">
                  <FolderOpen size={16} aria-hidden="true" />
                  Open Packet
                </Button>
                <Button onClick={runAudit} variant="primary">
                  <Play size={16} aria-hidden="true" />
                  Run Audit
                </Button>
                <Button
                  disabled={selectedTarget?.type !== "queued_url"}
                  onClick={() => void snapshotSelectedTarget()}
                  variant="secondary"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  Snapshot Live URL
                </Button>
                <Button
                  disabled={!runResult}
                  onClick={() => void exportReports()}
                  variant="secondary"
                >
                  <Download size={16} aria-hidden="true" />
                  Export Reports
                </Button>
                <Button
                  disabled={!runResult || availableArtifacts.length === 0}
                  onClick={() => {
                    if (availableArtifacts[0]) {
                      void openArtifact(availableArtifacts[0].path);
                    }
                  }}
                  variant="secondary"
                >
                  <Download size={16} aria-hidden="true" />
                  {availableArtifacts.length ? "Open Reports" : "No Reports"}
                </Button>
              </div>
            </div>
            {runResult ? (
              <p className={`action-note run-status-${runResult.status}`}>
                {runResult.message} {runResult.findingsCount} findings,{" "}
                {runResult.artifactsCount} artifacts.
              </p>
            ) : (
              <p className="action-note">
                Choose a saved fixture, local file, pasted draft, or queued URL, then run the
                local audit.
              </p>
            )}
            {snapshotAction ? (
              <p className="action-note">
                {snapshotAction.status === "snapshotted"
                  ? `${snapshotAction.message} ${snapshotAction.fileCount} snapshot files ready.`
                  : snapshotAction.message}
              </p>
            ) : null}
            {reportExportAction ? (
              <p className="action-note">
                {reportExportAction.status === "exported"
                  ? `Exported ${reportExportAction.fileCount} report files for ${reportExportAction.clientId}.`
                  : reportExportAction.status === "copied"
                    ? `Copied ${reportExportAction.fileCount} report files for ${reportExportAction.clientId}.`
                    : reportExportAction.message}
              </p>
            ) : null}
            {artifactAction ? (
              <p className="action-note">{artifactActionMessage(artifactAction)}</p>
            ) : null}
          </Panel>
        ) : null}

        {activeSection === "onboarding" ? (
          <section id="redline-onboarding">
            <RedlineOnboarding />
          </section>
        ) : null}

        {activeSection === "review" ? (
          <Panel className="findings-panel review-workspace" id="redline-review">
            <div className="panel-heading">
              <ListFilter size={18} aria-hidden="true" />
              <h3>Review Queue</h3>
            </div>

            <div className="review-toolbar" aria-label="Review filters">
              {(["all", "agent_ready", "manual_review", "proof_review"] as const).map(
                (filter) => (
                  <button
                    key={filter}
                    className={
                      filter === reviewFilters.route
                        ? "review-filter review-filter-active"
                        : "review-filter"
                    }
                    onClick={() =>
                      setReviewFilters((current) => ({ ...current, route: filter }))
                    }
                    type="button"
                  >
                    <span>{reviewFilterLabels[filter]}</span>
                    <strong>
                      {filter === "all"
                        ? reviewSummary.total
                        : filter === "agent_ready"
                          ? reviewSummary.agentReady
                          : filter === "manual_review"
                            ? reviewSummary.manualReview
                            : reviewSummary.proofReview}
                    </strong>
                  </button>
                ),
              )}
              <label className="review-select-filter">
                <span>Priority</span>
                <select
                  value={reviewFilters.priority}
                  onChange={(event) =>
                    setReviewFilters((current) => ({
                      ...current,
                      priority: event.target.value as ReviewPriorityFilter,
                    }))
                  }
                >
                  {(Object.keys(priorityFilterLabels) as ReviewPriorityFilter[]).map(
                    (priority) => (
                      <option key={priority} value={priority}>
                        {priorityFilterLabels[priority]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="review-select-filter">
                <span>Audit mode</span>
                <select
                  value={reviewFilters.mode}
                  onChange={(event) =>
                    setReviewFilters((current) => ({
                      ...current,
                      mode: event.target.value as ReviewModeFilter,
                    }))
                  }
                >
                  {(Object.keys(modeFilterLabels) as ReviewModeFilter[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {modeFilterLabels[mode]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="review-artifact-preview" aria-label="Artifact previews">
              {previewArtifacts.map((artifact) => {
                const Icon = artifactIcon[artifact.type];
                return (
                  <button
                    key={artifact.path}
                    className={
                      artifact.available
                        ? "review-preview-row"
                        : "review-preview-row review-preview-row-disabled"
                    }
                    disabled={!artifact.available}
                    onClick={() => void openArtifact(artifact.path)}
                    type="button"
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>
                      <strong>{artifact.label}</strong>
                      <small>{artifact.path}</small>
                    </span>
                    <Eye size={15} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            {artifactAction ? (
              <p className="action-note">{artifactActionMessage(artifactAction)}</p>
            ) : null}

            <div className="finding-list">
              {reviewQueue.map((finding) => (
                <article key={finding.id} className="finding-row">
                  <div>
                    <div className="finding-title">
                      <Badge tone={finding.priority === "high" ? "pink" : "muted"}>
                        {finding.priority}
                      </Badge>
                      <Badge tone={routeTone[finding.route]}>
                        {reviewRouteLabel(finding.route)}
                      </Badge>
                      <Badge>{modeFilterLabels[finding.mode]}</Badge>
                    </div>
                    <h4>{finding.label}</h4>
                    <p className="finding-quote">{finding.locatorText}</p>
                    <dl className="finding-evidence">
                      <div>
                        <dt>Issue</dt>
                        <dd>{finding.issue}</dd>
                      </div>
                      <div>
                        <dt>Suggested fix</dt>
                        <dd>{finding.suggestedFix}</dd>
                      </div>
                      <div>
                        <dt>Source evidence</dt>
                        <dd className="source-evidence-list">
                          {finding.sourceEvidence.map((source) => (
                            <button
                              key={source.id}
                              className="source-evidence-link"
                              onClick={() => void openArtifact(source.path)}
                              title="Open this local source evidence."
                              type="button"
                            >
                              <span>{source.label}</span>
                              <small>
                                {source.type} / {source.tier} / {source.path}
                              </small>
                            </button>
                          ))}
                        </dd>
                      </div>
                      {finding.proofNeeded ? (
                        <div>
                          <dt>Proof needed</dt>
                          <dd>{finding.proofNeeded}</dd>
                        </div>
                      ) : null}
                      {finding.approvalStatus ? (
                        <div>
                          <dt>Approval status</dt>
                          <dd>{finding.approvalStatus}</dd>
                        </div>
                      ) : null}
                      {finding.claimCategory ? (
                        <div>
                          <dt>Claim category</dt>
                          <dd>{finding.claimCategory}</dd>
                        </div>
                      ) : null}
                      {finding.proofOwner ? (
                        <div>
                          <dt>Proof owner</dt>
                          <dd>{finding.proofOwner}</dd>
                        </div>
                      ) : null}
                      {finding.canAgentEdit !== undefined ? (
                        <div>
                          <dt>Agent edit</dt>
                          <dd>
                            {finding.canAgentEdit
                              ? "Allowed within proof bounds"
                              : "Blocked until approval"}
                          </dd>
                        </div>
                      ) : null}
                      {finding.agentInstruction ? (
                        <div>
                          <dt>Agent instruction</dt>
                          <dd>{finding.agentInstruction}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                  <div className="finding-actions">
                    <Button
                      onClick={() => void copyFindingSnippet(finding)}
                      title="Copy an edit-brief snippet for a downstream agent."
                      variant="ghost"
                    >
                      <Clipboard size={15} aria-hidden="true" />
                      {copiedFindingId === finding.id ? "Copied" : "Copy Brief"}
                    </Button>
                    <span>
                      {finding.route === "agent_ready"
                        ? "Ready for agent handoff"
                        : finding.route === "proof_review"
                          ? "Route to proof review"
                          : "Route to human review"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        ) : null}

        {activeSection === "packet" ? (
          <section className="cr-grid cr-grid-wide" id="redline-packet">
            <Panel className="support-panel">
              <div className="panel-heading">
                <ShieldAlert size={18} aria-hidden="true" />
                <h3>Packet Health</h3>
              </div>
              <div className="readiness-list compact">
                {workspace.healthIssues.map((issue) => (
                  <div key={issue.id} className="readiness-row">
                    <span>{issue.message}</span>
                    <Badge tone={issue.severity === "error" ? "red" : "yellow"}>
                      {issue.severity}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="panel-heading">
                <ShieldAlert size={18} aria-hidden="true" />
                <h3>Source Readiness</h3>
              </div>
              <div className="readiness-list compact">
                {workspace.readiness.map((row) => (
                  <div key={row.moduleId} className="readiness-row">
                    <span>{row.moduleId}</span>
                    <Badge tone={readinessTone[row.readiness]}>{row.readiness}</Badge>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="support-panel">
              <div className="panel-heading">
                <Download size={18} aria-hidden="true" />
                <h3>Exports</h3>
              </div>
              <div className="artifact-list">
                {workspace.artifacts.map((artifact) => {
                  const Icon = artifactIcon[artifact.type];
                  return (
                    <button
                      key={artifact.path}
                      className={
                        artifact.available
                          ? "artifact-row"
                          : "artifact-row artifact-row-disabled"
                      }
                      disabled={!artifact.available}
                      onClick={() => void openArtifact(artifact.path)}
                      title={
                        artifact.available
                          ? "Open this report artifact."
                          : "This report artifact has not been exported yet."
                      }
                      type="button"
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>
                        <strong>{artifact.label}</strong>
                        <small>{artifact.path}</small>
                      </span>
                      <Badge>{artifact.type}</Badge>
                      <small className="artifact-action-state">
                        {artifact.available ? (
                          <>
                            <FolderOpen size={13} aria-hidden="true" /> Open
                          </>
                        ) : (
                          "Missing"
                        )}
                      </small>
                    </button>
                  );
                })}
              </div>
              {artifactAction ? (
                <p className="action-note">
                  {artifactActionMessage(artifactAction)}
                </p>
              ) : null}
            </Panel>
          </section>
        ) : null}
      </div>
    </div>
  );
}
