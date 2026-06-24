import {
  BarChart3,
  CalendarDays,
  Download,
  FileText,
  FolderOpen,
  KeyRound,
  Megaphone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";
import type { ToolViewProps } from "../types";
import {
  createMegaphonePostPackage,
  exportMegaphoneOnboardingPacket,
  exportMegaphonePostPackage,
  loadMegaphoneClientFolder,
  openMegaphoneArtifact,
  type MegaphoneClientLoadResult,
  type MegaphoneAiConnectionResult,
  type MegaphoneAiCredentialResult,
  type MegaphoneExportResult,
  type MegaphoneOnboardingExportResult,
  type MegaphoneOpenResult,
  type MegaphonePackageCreateResult,
  type MegaphoneChatResult,
  type MegaphoneChatTurn,
  chatWithMegaphoneAi,
  clearMegaphoneAiCredential,
  createMegaphoneAiPostPackage,
  saveMegaphoneAiCredential,
  testMegaphoneAiConnection,
} from "./megaphoneActions";
import {
  buildMegaphoneArtifacts,
  buildMegaphoneArtifactsFromPaths,
  bridgeMegaphoneWorkspace,
  defaultMegaphoneClientId,
  getMegaphoneWorkspace,
  megaphoneWorkspaces,
  type MegaphonePostPackageFile,
  type MegaphonePipelineStage,
} from "./megaphoneData";

const selectablePostTypes = [
  "failure_mode_pov",
  "evaluation_guide",
  "proof_methodology",
  "visual_explainer",
  "proof_repost_commentary",
  "launch_workload_announcement",
  "product_workflow_demo",
  "trust_objection_answer",
] as const;

const selectableAiModels = ["gpt-5-mini", "gpt-5", "gpt-4.1-mini"] as const;

const readinessLabel = {
  ready_to_brief: "Ready to brief",
  brief_with_caveats: "Brief with caveats",
  research_needed: "Research needed",
  source_review_needed: "Source review needed",
  blocked: "Blocked",
} as const;

const stageTone = {
  ready: "pink",
  review: "yellow",
  blocked: "red",
} as const;

const aiAvailabilityTone = {
  available: "pink",
  disabled: "yellow",
  missing_credentials: "red",
} as const;

const megaphoneScreens = [
  "sources",
  "onboarding",
  "strategy",
  "briefs",
  "drafts",
  "calendar",
  "measurement",
] as const;

type MegaphoneScreen = (typeof megaphoneScreens)[number];

function isMegaphoneScreen(routeId: string): routeId is MegaphoneScreen {
  return megaphoneScreens.some((screen) => screen === routeId);
}

export function MegaphoneTool({ activeRouteId }: ToolViewProps) {
  const activeScreen: MegaphoneScreen =
    activeRouteId && isMegaphoneScreen(activeRouteId) ? activeRouteId : "sources";
  const [activeClientId, setActiveClientId] = useState(defaultMegaphoneClientId);
  const seedWorkspace = getMegaphoneWorkspace(activeClientId);
  const [selectedPostType, setSelectedPostType] = useState(seedWorkspace.activePostType);
  const [allowAdjacentExamples, setAllowAdjacentExamples] = useState(
    seedWorkspace.allowAdjacentExamples,
  );
  const [activeOnboardingStepId, setActiveOnboardingStepId] = useState(
    seedWorkspace.onboarding.steps[0]?.id ?? "",
  );
  const [createdPacketClientId, setCreatedPacketClientId] = useState<string | null>(null);
  const [onboardingExportResult, setOnboardingExportResult] =
    useState<MegaphoneOnboardingExportResult | null>(null);
  const [clientLoadResult, setClientLoadResult] = useState<MegaphoneClientLoadResult | null>(
    null,
  );
  const [postPackageFiles, setPostPackageFiles] = useState<MegaphonePostPackageFile[]>([]);
  const [packageCreateResult, setPackageCreateResult] =
    useState<MegaphonePackageCreateResult | null>(null);
  const [aiConnectionResult, setAiConnectionResult] =
    useState<MegaphoneAiConnectionResult | null>(null);
  const [aiCredentialResult, setAiCredentialResult] =
    useState<MegaphoneAiCredentialResult | null>(null);
  const [aiCredentialInput, setAiCredentialInput] = useState("");
  const [selectedAiModel, setSelectedAiModel] = useState(seedWorkspace.aiDrafting.model);
  const [aiChatContext, setAiChatContext] = useState("");
  const [aiChatMessage, setAiChatMessage] = useState("");
  const [aiChatHistory, setAiChatHistory] = useState<MegaphoneChatTurn[]>([]);
  const [aiChatResult, setAiChatResult] = useState<MegaphoneChatResult | null>(null);
  const [exportResult, setExportResult] = useState<MegaphoneExportResult | null>(null);
  const [artifactAction, setArtifactAction] = useState<MegaphoneOpenResult | null>(null);
  const loadedClient = clientLoadResult?.status === "loaded" ? clientLoadResult : null;
  const packageSummary =
    packageCreateResult?.status === "created" ? packageCreateResult : null;
  const workspace = bridgeMegaphoneWorkspace(seedWorkspace, loadedClient, packageSummary);
  const activeWorkspace = {
    ...workspace,
    activePostType: selectedPostType,
    allowAdjacentExamples,
    aiDrafting: {
      ...workspace.aiDrafting,
      model: selectedAiModel,
    },
  };
  const readyStages = activeWorkspace.pipeline.filter((stage) => stage.status === "ready");
  const activeOnboardingStep =
    workspace.onboarding.steps.find((step) => step.id === activeOnboardingStepId) ??
    workspace.onboarding.steps[0];
  const createdPacketOutputs = workspace.onboarding.steps.flatMap(
    (step) => step.expectedOutputs,
  );
  const hasCreatedPacketPlan = createdPacketClientId === activeWorkspace.clientId;
  const generatedArtifacts =
    postPackageFiles.length > 0
      ? buildMegaphoneArtifacts(postPackageFiles)
      : buildMegaphoneArtifactsFromPaths(
          clientLoadResult?.status === "loaded" ? clientLoadResult.artifactPaths : [],
        );

  function selectClient(clientId: string) {
    const nextWorkspace = getMegaphoneWorkspace(clientId);
    setActiveClientId(clientId);
    setSelectedPostType(nextWorkspace.activePostType);
    setAllowAdjacentExamples(nextWorkspace.allowAdjacentExamples);
    setSelectedAiModel(nextWorkspace.aiDrafting.model);
    setActiveOnboardingStepId(nextWorkspace.onboarding.steps[0]?.id ?? "");
    setClientLoadResult(null);
    setPostPackageFiles([]);
    setPackageCreateResult(null);
    setAiConnectionResult(null);
    setAiCredentialResult(null);
    setAiCredentialInput("");
    setAiChatContext("");
    setAiChatMessage("");
    setAiChatHistory([]);
    setAiChatResult(null);
    setExportResult(null);
    setArtifactAction(null);
    setCreatedPacketClientId(null);
    setOnboardingExportResult(null);
  }

  async function loadClientFolder() {
    const result = await loadMegaphoneClientFolder(seedWorkspace.packetPath);
    setClientLoadResult(result);
    setPostPackageFiles([]);
    setPackageCreateResult(null);
    setAiConnectionResult(null);
    setAiCredentialResult(null);
    setAiChatResult(null);
    setExportResult(null);
    setArtifactAction(null);
  }

  function updateAiModel(model: string) {
    setSelectedAiModel(model);
    setAiConnectionResult(null);
    setAiCredentialResult(null);
  }

  async function testAiConnection() {
    const loadedClientSummary = clientLoadResult?.status === "loaded" ? clientLoadResult : null;
    const result = await testMegaphoneAiConnection(activeWorkspace, loadedClientSummary);
    setAiConnectionResult(result);
  }

  async function saveAiCredential() {
    const result = await saveMegaphoneAiCredential(activeWorkspace, aiCredentialInput);
    setAiCredentialResult(result);
    setAiConnectionResult(
      result.status === "available"
        ? {
            status: "available",
            provider: result.provider,
            model: result.model,
            message: result.message,
            fallbackEnabled: result.fallbackEnabled,
          }
        : null,
    );
    if (result.status === "available") {
      setAiCredentialInput("");
    }
  }

  async function clearAiCredential() {
    const result = await clearMegaphoneAiCredential(activeWorkspace);
    setAiCredentialResult(result);
    setAiConnectionResult(null);
    setAiCredentialInput("");
  }

  async function createAiPostPackage() {
    const loadedClientSummary = clientLoadResult?.status === "loaded" ? clientLoadResult : null;
    const result = await createMegaphoneAiPostPackage(activeWorkspace, loadedClientSummary);
    setPackageCreateResult(result);
    setPostPackageFiles(result.status === "created" ? result.files : []);
    setExportResult(null);
    setArtifactAction(null);
  }

  async function sendAiChatMessage() {
    const loadedClientSummary = clientLoadResult?.status === "loaded" ? clientLoadResult : null;
    const message = aiChatMessage.trim();
    const documents = aiChatContext.trim()
      ? [
          {
            id: `${activeWorkspace.clientId}-workshop-notes`,
            title: "Workshop notes and documents",
            sourceType: "note" as const,
            content: aiChatContext,
          },
        ]
      : [];
    const result = await chatWithMegaphoneAi(activeWorkspace, loadedClientSummary, {
      message,
      documents,
      history: aiChatHistory,
    });
    setAiChatResult(result);
    if (message && result.status === "answered") {
      setAiChatHistory((history) => [
        ...history,
        { role: "user", content: message },
        { role: "assistant", content: result.assistantMessage },
      ]);
      setAiChatMessage("");
    }
  }

  async function createPostPackage() {
    const loadedClientSummary = clientLoadResult?.status === "loaded" ? clientLoadResult : null;
    const result = await createMegaphonePostPackage(activeWorkspace, loadedClientSummary);
    setPackageCreateResult(result);
    setPostPackageFiles(result.status === "created" ? result.files : []);
    setExportResult(null);
    setArtifactAction(null);
  }

  async function exportPostPackage() {
    const result = await exportMegaphonePostPackage(activeWorkspace, postPackageFiles);
    setExportResult(result);
  }

  async function openArtifact(path: string) {
    const result = await openMegaphoneArtifact(path);
    setArtifactAction(result);
  }

  async function exportOnboardingPacket() {
    const result = await exportMegaphoneOnboardingPacket(activeWorkspace);
    setOnboardingExportResult(result);
    setCreatedPacketClientId(result.status === "exported" || result.status === "copied" ? activeWorkspace.clientId : null);
  }

  const aiAvailability = aiConnectionResult
    ? aiConnectionResult.status === "unavailable"
      ? activeWorkspace.aiDrafting.availability
      : aiConnectionResult.status
    : aiCredentialResult && aiCredentialResult.status !== "unavailable"
      ? aiCredentialResult.status
    : activeWorkspace.aiDrafting.availability;
  const aiStatusMessage =
    aiConnectionResult?.message ?? aiCredentialResult?.message ?? activeWorkspace.aiDrafting.message;
  const aiStatusModel =
    aiConnectionResult?.model ??
    (aiCredentialResult && "model" in aiCredentialResult ? aiCredentialResult.model : undefined) ??
    activeWorkspace.aiDrafting.model;
  const aiStatusProvider =
    aiConnectionResult?.provider ??
    (aiCredentialResult && "provider" in aiCredentialResult ? aiCredentialResult.provider : undefined) ??
    activeWorkspace.aiDrafting.provider;
  const aiStatusStorage =
    aiCredentialResult && "storage" in aiCredentialResult
      ? aiCredentialResult.storage
      : activeWorkspace.aiDrafting.storage;
  const aiFallbackEnabled =
    aiConnectionResult?.fallbackEnabled ??
    aiCredentialResult?.fallbackEnabled ??
    activeWorkspace.aiDrafting.fallbackEnabled;

  return (
    <div className="megaphone-layout">
      {activeScreen === "sources" ? (
        <Panel className="workspace-summary megaphone-summary" id="megaphone-sources">
          <div className="summary-main">
            <div>
              <p className="eyebrow">{activeWorkspace.clientId}</p>
              <h2>{activeWorkspace.clientName}</h2>
              <Badge tone={activeWorkspace.clientType === "brand" ? "pink" : "yellow"}>
                {activeWorkspace.clientType === "brand" ? "Brand client" : "Influencer client"}
              </Badge>
            </div>
            <div className="client-switcher" aria-label="Megaphone client workspaces">
              {megaphoneWorkspaces.map((candidate) => (
                <Button
                  key={candidate.clientId}
                  onClick={() => selectClient(candidate.clientId)}
                  variant={candidate.clientId === activeWorkspace.clientId ? "secondary" : "ghost"}
                >
                  {candidate.clientName}
                </Button>
              ))}
            </div>
          </div>

          <div className="summary-details">
            <div>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>{readinessLabel[activeWorkspace.readiness]}</span>
            </div>
            <div>
              <FileText size={18} aria-hidden="true" />
              <span>{activeWorkspace.packetPath}</span>
            </div>
            <div>
              <Megaphone size={18} aria-hidden="true" />
              <span>{activeWorkspace.activePostType}</span>
            </div>
            <div>
              <FileText size={18} aria-hidden="true" />
              <span>{activeWorkspace.modeGuidance.postingAccount}</span>
            </div>
          </div>

          <article className="megaphone-onboarding-detail">
            <h3>Client Mode</h3>
            <p>{activeWorkspace.modeGuidance.voicePrinciple}</p>
            <p>{activeWorkspace.modeGuidance.proofBoundary}</p>
            <ul>
              {activeWorkspace.modeGuidance.sourceWeighting.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </article>

          <div className="summary-actions">
            <div className="status-metrics compact">
              <span>
                <strong>{activeWorkspace.sourceCount}</strong>
                sources
              </span>
              <span>
                <strong>{activeWorkspace.researchFiles}</strong>
                research files
              </span>
              <span>
                <strong>{readyStages.length}/{activeWorkspace.pipeline.length}</strong>
                stages ready
              </span>
            </div>
            <Button
              onClick={() => void loadClientFolder()}
              title="Load and validate the current Megaphone client folder."
              variant="secondary"
            >
              <FolderOpen size={16} aria-hidden="true" />
              Load Client Folder
            </Button>
            <Button
              disabled={clientLoadResult?.status !== "loaded"}
              onClick={() => void createPostPackage()}
              title={
                clientLoadResult?.status === "loaded"
                  ? "Create a reviewable post package from the loaded client folder."
                  : "Load a client folder before creating a post package."
              }
            >
              <FileText size={16} aria-hidden="true" />
              Create Brief
            </Button>
            <Button
              aria-describedby="megaphone-export-note"
              disabled={postPackageFiles.length === 0}
              onClick={() => void exportPostPackage()}
              title={
                postPackageFiles.length > 0
                  ? "Export the generated post package to local Markdown and JSON files."
                  : "Create a brief before exporting the post package."
              }
              variant="primary"
            >
              <Download size={16} aria-hidden="true" />
              Export Package
            </Button>
          </div>
          <p className="action-note" id="megaphone-export-note">
            {exportResult
              ? exportResult.status === "exported"
                ? `Exported ${exportResult.fileCount} files for ${exportResult.clientId}.`
                : exportResult.status === "copied"
                  ? `Copied ${exportResult.fileCount} files for ${exportResult.clientId}.`
                  : exportResult.message
              : postPackageFiles.length > 0
                ? `${postPackageFiles.length} package files are ready to export.`
                : "Create a post brief before exporting a package."}
          </p>
          {clientLoadResult ? (
            <p className="action-note">
              {clientLoadResult.status === "loaded"
                ? `Loaded ${clientLoadResult.path}: ${clientLoadResult.sourceCount} sources, ${clientLoadResult.researchFiles} research files.`
                : clientLoadResult.message}
            </p>
          ) : null}
          {packageCreateResult ? (
            <p className="action-note">
              {packageCreateResult.status === "created"
                ? `Created ${packageCreateResult.files.length} files from ${packageCreateResult.packageRoot}.`
                : packageCreateResult.message}
            </p>
          ) : null}
          {activeWorkspace.warnings.length > 0 ? (
            <div className="megaphone-warning-list" aria-label="Packet warnings">
              {activeWorkspace.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </Panel>
      ) : null}

      <section className="cr-grid cr-grid-wide megaphone-grid">
        {activeScreen === "briefs" ? (
          <Panel className="megaphone-work-panel" id="megaphone-briefs">
            <div className="panel-heading">
              <FileText size={18} aria-hidden="true" />
              <h3>Active Post Package</h3>
            </div>
            <article className="megaphone-brief-card">
              <div>
                <Badge tone="pink">{activeWorkspace.activePostType}</Badge>
                <Badge tone={activeWorkspace.proofRisk === "high" ? "red" : "yellow"}>
                  {activeWorkspace.proofRisk} proof risk
                </Badge>
              </div>
              <h4>{activeWorkspace.activeBriefTopic}</h4>
              <p>{activeWorkspace.activeAudience}</p>
            </article>

            <article className="megaphone-onboarding-detail" aria-label="Example retrieval controls">
              <h4>Example Retrieval</h4>
              <p>Choose the post type before Megaphone retrieves example context.</p>
              <div className="megaphone-post-type-grid">
                {selectablePostTypes.map((postType) => (
                  <button
                    key={postType}
                    className={
                      postType === selectedPostType
                        ? "megaphone-post-type-button megaphone-post-type-button-active"
                        : "megaphone-post-type-button"
                    }
                    onClick={() => {
                      setSelectedPostType(postType);
                      setPostPackageFiles([]);
                      setPackageCreateResult(null);
                      setExportResult(null);
                    }}
                    type="button"
                  >
                    {postType}
                  </button>
                ))}
              </div>
              <label className="megaphone-toggle-row">
                <input
                  checked={allowAdjacentExamples}
                  onChange={(event) => {
                    setAllowAdjacentExamples(event.currentTarget.checked);
                    setPostPackageFiles([]);
                    setPackageCreateResult(null);
                    setExportResult(null);
                  }}
                  type="checkbox"
                />
                <span>Allow adjacent post-type examples when exact matches are sparse</span>
              </label>
              <p className="action-note">
                {activeWorkspace.exampleCorpusStatus === "ready"
                  ? allowAdjacentExamples
                    ? "Adjacent retrieval is enabled for the next package."
                    : "Exact post-type examples only for the next package."
                  : "No client-local example corpus is imported yet; generated packages will show a not enough examples state."}
              </p>
            </article>
          </Panel>
        ) : null}

        {activeScreen === "strategy" ? (
          <Panel className="megaphone-work-panel" id="megaphone-strategy">
            <div className="panel-heading">
              <FileText size={18} aria-hidden="true" />
              <h3>Strategy</h3>
            </div>
            <div className="megaphone-pipeline" aria-label="Post package stages">
              {activeWorkspace.pipeline.map((stage) => (
                <PipelineStage key={stage.id} stage={stage} />
              ))}
            </div>
          </Panel>
        ) : null}

        {activeScreen === "drafts" ? (
          <Panel className="megaphone-work-panel" id="megaphone-drafts">
            <div className="panel-heading">
              <Download size={18} aria-hidden="true" />
              <h3>Generated Artifacts</h3>
            </div>
            <article className="megaphone-onboarding-detail" aria-label="Local AI drafting runtime">
              <div className="panel-heading compact-heading">
                <Sparkles size={18} aria-hidden="true" />
                <h4>Local AI Drafting</h4>
              </div>
              <div className="summary-details compact">
                <div>
                  <KeyRound size={18} aria-hidden="true" />
                  <span>{aiStatusProvider}</span>
                </div>
                <div>
                  <FileText size={18} aria-hidden="true" />
                  <span>{aiStatusModel}</span>
                </div>
                <div>
                  <ShieldCheck size={18} aria-hidden="true" />
                  <span>{aiStatusStorage}</span>
                </div>
              </div>
              <div className="local-ai-credential-row">
                <label>
                  <span>Model</span>
                  <select
                    aria-label="AI model"
                    onChange={(event) => updateAiModel(event.currentTarget.value)}
                    value={selectedAiModel}
                  >
                    {selectableAiModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>OpenAI API key</span>
                  <input
                    aria-label="OpenAI API key"
                    onChange={(event) => setAiCredentialInput(event.currentTarget.value)}
                    placeholder="sk-..."
                    type="password"
                    value={aiCredentialInput}
                  />
                </label>
                <Button
                  disabled={!aiCredentialInput.trim()}
                  onClick={() => void saveAiCredential()}
                  title="Save the OpenAI API key to local secure storage."
                  variant="secondary"
                >
                  <KeyRound size={16} aria-hidden="true" />
                  Save Key
                </Button>
                <Button
                  onClick={() => void clearAiCredential()}
                  title="Clear the saved local OpenAI API key."
                  variant="ghost"
                >
                  Clear Key
                </Button>
              </div>
              <div className="summary-actions">
                <Badge tone={aiAvailabilityTone[aiAvailability]}>
                  {aiAvailability}
                </Badge>
                <Button
                  disabled={clientLoadResult?.status !== "loaded"}
                  onClick={() => void testAiConnection()}
                  title={
                    clientLoadResult?.status === "loaded"
                      ? "Test the configured local AI drafting adapter."
                      : "Load a client folder before testing the AI adapter."
                  }
                  variant="secondary"
                >
                  <Sparkles size={16} aria-hidden="true" />
                  Test Connection
                </Button>
                <Button
                  disabled={aiAvailability !== "available" || clientLoadResult?.status !== "loaded"}
                  onClick={() => void createAiPostPackage()}
                  title={
                    aiAvailability === "available"
                      ? "Generate AI-assisted draft variants through the local adapter."
                      : "AI generation is unavailable; use Create Brief for deterministic fallback."
                  }
                  variant="primary"
                >
                  <Sparkles size={16} aria-hidden="true" />
                  Generate AI Drafts
                </Button>
              </div>
              <p className="action-note">
                {aiStatusMessage}
                {aiFallbackEnabled
                  ? " Review gates and deterministic fallback remain available."
                  : ""}
              </p>
              <div className="megaphone-ai-chat" aria-label="Contextual AI chat">
                <label>
                  <span>Documents and notes</span>
                  <textarea
                    aria-label="Documents and notes for AI chat"
                    onChange={(event) => setAiChatContext(event.currentTarget.value)}
                    placeholder="Paste source notes, client comments, transcript excerpts, draft fragments, or review questions."
                    rows={5}
                    value={aiChatContext}
                  />
                </label>
                <label>
                  <span>Message</span>
                  <textarea
                    aria-label="AI chat message"
                    onChange={(event) => setAiChatMessage(event.currentTarget.value)}
                    placeholder="Ask Megaphone what to draft, compare, rewrite, or review from the context above."
                    rows={3}
                    value={aiChatMessage}
                  />
                </label>
                <Button
                  disabled={clientLoadResult?.status !== "loaded" || !aiChatMessage.trim()}
                  onClick={() => void sendAiChatMessage()}
                  title={
                    clientLoadResult?.status === "loaded"
                      ? "Send a contextual AI chat message using pasted notes and documents."
                      : "Load a client folder before starting a contextual AI chat."
                  }
                  variant="secondary"
                >
                  <Sparkles size={16} aria-hidden="true" />
                  Chat With Context
                </Button>
                {aiChatResult ? (
                  <p className="action-note">
                    {aiChatResult.status === "answered"
                      ? aiChatResult.assistantMessage
                      : aiChatResult.assistantMessage}
                  </p>
                ) : null}
                {aiChatHistory.length > 0 ? (
                  <div className="megaphone-chat-thread" aria-label="AI chat thread">
                    {aiChatHistory.slice(-6).map((turn, index) => (
                      <article key={`${turn.role}-${index}`} className="megaphone-chat-turn">
                        <strong>{turn.role === "user" ? "You" : "Megaphone AI"}</strong>
                        <p>{turn.content}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
            <div className="artifact-list">
              {generatedArtifacts.length > 0 ? (
                generatedArtifacts.map((artifact) => (
                  <button
                    key={artifact.path}
                    className="artifact-row"
                    onClick={() => void openArtifact(artifact.path)}
                    title="Open this generated Megaphone artifact."
                    type="button"
                  >
                    <span>
                      <strong>{artifact.label}</strong>
                      <small>{artifact.path}</small>
                    </span>
                    <Badge>{artifact.type}</Badge>
                  </button>
                ))
              ) : (
                <p className="action-note">Create a brief to preview package artifacts.</p>
              )}
            </div>
            {artifactAction ? (
              <p className="action-note">
                {artifactAction.status === "opened"
                  ? `Opened ${artifactAction.path}`
                  : artifactAction.status === "copied"
                    ? `Copied ${artifactAction.path}`
                    : artifactAction.message}
              </p>
            ) : null}
          </Panel>
        ) : null}

        {activeScreen === "onboarding" ? (
          <Panel className="support-panel megaphone-support-panel" id="megaphone-onboarding">
            <div className="panel-heading">
              <ShieldCheck size={18} aria-hidden="true" />
              <h3>New Client Onboarding</h3>
            </div>
            <div className="megaphone-onboarding-summary">
              <span>
                <strong>{workspace.onboarding.draftClientName}</strong>
                <small>{workspace.onboarding.generatedPacketPath}</small>
              </span>
              <Badge
                tone={workspace.onboarding.readinessPreview === "ready_to_brief" ? "pink" : "yellow"}
              >
                {readinessLabel[workspace.onboarding.readinessPreview]}
              </Badge>
            </div>
            <div className="megaphone-onboarding-steps" aria-label="Client onboarding steps">
              {workspace.onboarding.steps.map((step) => (
                <button
                  key={step.id}
                  className={
                    step.id === activeOnboardingStep?.id
                      ? "megaphone-onboarding-step megaphone-onboarding-step-active"
                      : "megaphone-onboarding-step"
                  }
                  onClick={() => setActiveOnboardingStepId(step.id)}
                  type="button"
                >
                  <span>{step.label}</span>
                  <Badge
                    tone={
                      step.status === "blocked"
                        ? "red"
                        : step.status === "needs_input"
                          ? "yellow"
                          : "pink"
                    }
                  >
                    {step.status}
                  </Badge>
                </button>
              ))}
            </div>
            {activeOnboardingStep ? (
              <article className="megaphone-onboarding-detail">
                <h4>{activeOnboardingStep.label}</h4>
                <p>{activeOnboardingStep.detail}</p>
                <ul>
                  {activeOnboardingStep.expectedOutputs.map((output) => (
                    <li key={output}>{output}</li>
                  ))}
                </ul>
              </article>
            ) : null}
            <Button
              aria-describedby="megaphone-onboarding-note"
              onClick={() => void exportOnboardingPacket()}
              title="Create a reviewable client packet plan from the guided onboarding inputs."
              variant="secondary"
            >
              {hasCreatedPacketPlan ? "Packet Exported" : "Export Client Packet"}
            </Button>
            <p className="action-note" id="megaphone-onboarding-note">
              {onboardingExportResult
                ? onboardingExportResult.status === "exported"
                  ? `Exported ${onboardingExportResult.fileCount} onboarding files for ${onboardingExportResult.clientId}.`
                  : onboardingExportResult.status === "copied"
                    ? `Copied ${onboardingExportResult.fileCount} onboarding files for ${onboardingExportResult.clientId}.`
                    : onboardingExportResult.message
                : "Guided setup exports reviewable onboarding files through the local Workshop writer."}
            </p>
            {hasCreatedPacketPlan ? (
              <article className="megaphone-onboarding-detail">
                <h4>Exported Packet Files</h4>
                <p>{workspace.onboarding.generatedPacketPath}</p>
                <ul>
                  {[...new Set(createdPacketOutputs)].map((output) => (
                    <li key={output}>{output}</li>
                  ))}
                </ul>
              </article>
            ) : null}
          </Panel>
        ) : null}

        {activeScreen === "calendar" ? (
          <Panel className="support-panel megaphone-support-panel" id="megaphone-calendar">
            <div className="panel-heading">
              <CalendarDays size={18} aria-hidden="true" />
              <h3>Calendar</h3>
            </div>
            <div className="megaphone-calendar-list">
              {workspace.calendarItems.map((item) => (
                <article key={item.id} className="megaphone-calendar-row">
                  <span>{item.date}</span>
                  <div>
                    <strong>{item.topic}</strong>
                    <small>
                      {item.postType} / {item.pillar}
                    </small>
                  </div>
                  <Badge tone={item.draftReadiness === "ready" ? "pink" : "yellow"}>
                    {item.draftReadiness}
                  </Badge>
                </article>
              ))}
            </div>
          </Panel>
        ) : null}

        {activeScreen === "measurement" ? (
          <Panel className="support-panel megaphone-support-panel" id="megaphone-measurement">
            <div className="panel-heading">
              <BarChart3 size={18} aria-hidden="true" />
              <h3>Measurement</h3>
            </div>
            <div className="megaphone-signal-list">
              {workspace.measurementSignals.map((signal) => (
                <article key={signal.label} className="megaphone-signal-row">
                  <strong>{signal.value}</strong>
                  <span>{signal.label}</span>
                  <small>{signal.caveat}</small>
                </article>
              ))}
            </div>

            <div className="megaphone-warning-list" aria-label="Calendar warnings">
              {workspace.calendarWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </Panel>
        ) : null}
      </section>
    </div>
  );
}

function PipelineStage({ stage }: { stage: MegaphonePipelineStage }) {
  return (
    <article className="megaphone-stage-row">
      <div>
        <h4>{stage.label}</h4>
        <p>{stage.detail}</p>
      </div>
      <Badge tone={stageTone[stage.status]}>{stage.status}</Badge>
    </article>
  );
}
