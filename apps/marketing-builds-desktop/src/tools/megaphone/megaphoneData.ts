import type { PrivateWorkspaceClient } from "../../tool-registry/workspaceState";

export type MegaphoneReadinessState =
  | "ready_to_brief"
  | "brief_with_caveats"
  | "research_needed"
  | "source_review_needed"
  | "blocked";

export type MegaphonePipelineStage = {
  id: string;
  label: string;
  status: "ready" | "review" | "blocked";
  detail: string;
};

export type MegaphoneCalendarItem = {
  id: string;
  date: string;
  topic: string;
  postType: string;
  pillar: string;
  draftReadiness: "ready" | "revise" | "proof_review_needed" | "manual_review";
};

export type MegaphoneMeasurementSignal = {
  label: string;
  value: string;
  caveat: string;
};

export type MegaphoneOnboardingStep = {
  id: string;
  label: string;
  status: "ready" | "needs_input" | "blocked";
  detail: string;
  expectedOutputs: string[];
};

export type MegaphoneOnboardingFlow = {
  draftClientName: string;
  readinessPreview: MegaphoneReadinessState;
  generatedPacketPath: string;
  steps: MegaphoneOnboardingStep[];
  exportFiles?: MegaphonePostPackageFile[];
};

export type MegaphonePostPackageFile = {
  path: string;
  contents: string;
};

export type MegaphoneArtifact = {
  label: string;
  path: string;
  type: "markdown" | "json";
};

export type MegaphoneLoadedClientSummary = {
  clientId: string;
  clientName: string;
  clientType: MegaphoneWorkspace["clientType"];
  path: string;
  readiness: MegaphoneReadinessState;
  sourceCount: number;
  researchFiles: number;
  artifactPaths: string[];
  calendarItems: MegaphoneCalendarItem[];
  measurementSignals: MegaphoneMeasurementSignal[];
  warnings: string[];
};

export type MegaphoneBridgePackageSummary = {
  status: "created";
  packageRoot: string;
  files: MegaphonePostPackageFile[];
};

export type MegaphoneWorkspace = {
  clientId: string;
  clientName: string;
  clientType: "brand" | "influencer";
  modeGuidance: {
    postingAccount: string;
    voicePrinciple: string;
    proofBoundary: string;
    sourceWeighting: string[];
  };
  packetPath: string;
  readiness: MegaphoneReadinessState;
  sourceCount: number;
  researchFiles: number;
  activeBriefTopic: string;
  activePostType: string;
  allowAdjacentExamples: boolean;
  exampleCorpusStatus: "ready" | "not_imported";
  activeAudience: string;
  proofRisk: "low" | "medium" | "high";
  aiDrafting: {
    availability: "available" | "disabled" | "missing_credentials";
    provider: "openai" | "mock";
    model: string;
    storage: "macos_keychain" | "env_local" | "not_configured";
    message: string;
    fallbackEnabled: boolean;
  };
  pipeline: MegaphonePipelineStage[];
  calendarItems: MegaphoneCalendarItem[];
  calendarWarnings: string[];
  measurementSignals: MegaphoneMeasurementSignal[];
  onboarding: MegaphoneOnboardingFlow;
  bridgeStatus: "seed" | "loaded";
  warnings: string[];
};

const brandModeGuidance: MegaphoneWorkspace["modeGuidance"] = {
  postingAccount: "company LinkedIn page",
  voicePrinciple: "Use approved company voice, product/category context, and brand proof.",
  proofBoundary: "Company claims need company-approved proof before they travel.",
  sourceWeighting: [
    "Prioritize company-page proof, product, benchmark, and category examples.",
    "Use founder or SME examples as amplification references unless brand voice is approved.",
  ],
};

const influencerModeGuidance: MegaphoneWorkspace["modeGuidance"] = {
  postingAccount: "personal LinkedIn account",
  voicePrinciple: "Use named human POV, lived experience, observed patterns, and personal credibility proof.",
  proofBoundary: "Do not imply the author speaks for a company unless explicitly approved.",
  sourceWeighting: [
    "Prioritize founder, expert, employee, practitioner, and consultant examples for voice.",
    "Use company-authored examples for structure only, not personal voice mimicry.",
  ],
};

export const megaphoneWorkspaces = [
  {
    clientId: "demo-megaphone",
    clientName: "Northstar Demo Co.",
    clientType: "brand",
    modeGuidance: brandModeGuidance,
    packetPath: "clients/demo-megaphone",
    readiness: "ready_to_brief",
    sourceCount: 31,
    researchFiles: 14,
    activeBriefTopic: "source signal scorecard for service handoffs",
    activePostType: "visual_explainer",
    allowAdjacentExamples: false,
    exampleCorpusStatus: "ready",
    activeAudience: "founder, CTO",
    proofRisk: "medium",
    aiDrafting: {
      availability: "missing_credentials",
      provider: "openai",
      model: "gpt-5-mini",
      storage: "not_configured",
      message: "OpenAI API key is not configured locally. Use megaphone/.env.local.example; deterministic fallback is active.",
      fallbackEnabled: true,
    },
    pipeline: [
      {
        id: "source-packet",
        label: "Source packet",
        status: "ready",
        detail: "Canonical GTM context and LinkedIn research are loaded.",
      },
      {
        id: "brief",
        label: "Brief",
        status: "ready",
        detail: "Post brief cites client context and research references.",
      },
      {
        id: "draft",
        label: "Draft",
        status: "ready",
        detail: "Recommended draft passed review gates.",
      },
      {
        id: "visual",
        label: "Visual",
        status: "review",
        detail: "Diagram brief is ready for a designer or image-generation step.",
      },
      {
        id: "measurement",
        label: "Measurement",
        status: "review",
        detail: "Live post data can feed directional recommendations.",
      },
    ],
    calendarItems: [
      {
        id: "demo-megaphone-2026-07-06",
        date: "2026-07-06",
        topic: "source signal scorecard for service handoffs",
        postType: "visual_explainer",
        pillar: "operational_control",
        draftReadiness: "ready",
      },
      {
        id: "demo-megaphone-2026-07-08",
        date: "2026-07-08",
        topic: "what to measure before choosing an inference provider",
        postType: "evaluation_guide",
        pillar: "real_workload_performance",
        draftReadiness: "ready",
      },
      {
        id: "demo-megaphone-2026-07-10",
        date: "2026-07-10",
        topic: "benchmark caveats before inference claims",
        postType: "proof_methodology",
        pillar: "credible_proof",
        draftReadiness: "proof_review_needed",
      },
    ],
    calendarWarnings: [
      "Proof-sensitive posts need owner review before publishing.",
      "Measurement is directional until live post samples grow.",
    ],
    measurementSignals: [
      {
        label: "Relevant commenters",
        value: "3",
        caveat: "Tracked separately from raw comments.",
      },
      {
        label: "Credible engagers",
        value: "5",
        caveat: "Visible engagement is observational, not causal.",
      },
      {
        label: "Readout confidence",
        value: "Thin sample",
        caveat: "Use as the next test direction, not a claim.",
      },
    ],
    onboarding: {
      draftClientName: "LatticeOps",
      readinessPreview: "ready_to_brief",
      generatedPacketPath: "clients/demo-megaphone",
      steps: [
        {
          id: "mode",
          label: "Account mode",
          status: "ready",
          detail: "Brand clients publish from a company LinkedIn page using approved company voice and proof.",
          expectedOutputs: ["client.yaml", "onboarding/client-mode.md"],
        },
        {
          id: "profile",
          label: "Client profile",
          status: "ready",
          detail: "Name, market, channel focus, audiences, and privacy posture are captured.",
          expectedOutputs: ["client.yaml"],
        },
        {
          id: "sources",
          label: "Source intake",
          status: "ready",
          detail: "Source files are classified with trust, freshness, privacy, and checksums.",
          expectedOutputs: ["source-manifest.json", "sources/intake/"],
        },
        {
          id: "canonical",
          label: "Canonical packet",
          status: "ready",
          detail: "ICP, positioning, buyer language, proof, objections, and content priorities are drafted.",
          expectedOutputs: ["canonical/*.md"],
        },
        {
          id: "policy",
          label: "Claims and voice",
          status: "ready",
          detail: "Claims policy, voice guidance, and do-not-say list are ready for review.",
          expectedOutputs: ["linkedin/claims-policy.yaml", "linkedin/voice-guidance.md"],
        },
        {
          id: "research",
          label: "Research",
          status: "needs_input",
          detail: "Imported research can upgrade caveat mode; placeholders keep the packet loadable.",
          expectedOutputs: ["sources/linkedin-research/research-readout.md"],
        },
        {
          id: "readiness",
          label: "Readiness",
          status: "ready",
          detail: "Readiness report and first brief queue are generated from the onboarding inputs.",
          expectedOutputs: ["onboarding/readiness-report.md", "onboarding/first-brief-queue.json"],
        },
      ],
    },
    bridgeStatus: "seed",
    warnings: [
      "Load a local client folder to replace seed summaries with packet data from disk.",
    ],
  },
  {
    clientId: "brightbeam",
    clientName: "Brightbeam Analytics",
    clientType: "brand",
    modeGuidance: brandModeGuidance,
    packetPath: "clients/brightbeam",
    readiness: "ready_to_brief",
    sourceCount: 3,
    researchFiles: 2,
    activeBriefTopic: "how to tell whether a customer health signal is actionable",
    activePostType: "evaluation_guide",
    allowAdjacentExamples: false,
    exampleCorpusStatus: "not_imported",
    activeAudience: "customer success leader",
    proofRisk: "medium",
    aiDrafting: {
      availability: "missing_credentials",
      provider: "openai",
      model: "gpt-5-mini",
      storage: "not_configured",
      message: "OpenAI API key is not configured locally. Use megaphone/.env.local.example; deterministic fallback is active.",
      fallbackEnabled: true,
    },
    pipeline: [
      {
        id: "source-packet",
        label: "Source packet",
        status: "ready",
        detail: "Customer success context and fixture research are loaded.",
      },
      {
        id: "brief",
        label: "Brief",
        status: "ready",
        detail: "Brief uses Brightbeam account-review and health-score context.",
      },
      {
        id: "draft",
        label: "Draft",
        status: "review",
        detail: "Draft should stay practical and avoid automation overclaims.",
      },
      {
        id: "visual",
        label: "Visual",
        status: "review",
        detail: "A checklist or account-review flow may help the post carry.",
      },
      {
        id: "measurement",
        label: "Measurement",
        status: "ready",
        detail: "Shared measurement fields can track relevant customer-success comments.",
      },
    ],
    calendarItems: [
      {
        id: "brightbeam-2026-07-06",
        date: "2026-07-06",
        topic: "how to tell whether a customer health signal is actionable",
        postType: "evaluation_guide",
        pillar: "trusted_health_scores",
        draftReadiness: "ready",
      },
      {
        id: "brightbeam-2026-07-08",
        date: "2026-07-08",
        topic: "why health scores lose trust",
        postType: "failure_mode_pov",
        pillar: "account_review_quality",
        draftReadiness: "manual_review",
      },
    ],
    calendarWarnings: [
      "Fixture research is directional and should not be treated as live performance.",
      "Quantified churn or revenue claims need customer-approved proof.",
    ],
    measurementSignals: [
      {
        label: "Relevant commenters",
        value: "2",
        caveat: "Track customer-success operators separately from generic analytics replies.",
      },
      {
        label: "Credible engagers",
        value: "4",
        caveat: "Use as audience-quality signal, not causal proof.",
      },
      {
        label: "Readout confidence",
        value: "Fixture",
        caveat: "Enough to validate isolation, not enough to recommend scale.",
      },
    ],
    onboarding: {
      draftClientName: "Brightbeam Analytics",
      readinessPreview: "ready_to_brief",
      generatedPacketPath: "clients/brightbeam",
      steps: [
        {
          id: "mode",
          label: "Account mode",
          status: "ready",
          detail: "Brand clients publish from a company LinkedIn page using approved company voice and proof.",
          expectedOutputs: ["client.yaml", "onboarding/client-mode.md"],
        },
        {
          id: "profile",
          label: "Client profile",
          status: "ready",
          detail: "Customer success analytics profile is captured for a non-infrastructure client.",
          expectedOutputs: ["client.yaml"],
        },
        {
          id: "sources",
          label: "Source intake",
          status: "ready",
          detail: "Fixture source context and research files are isolated under Brightbeam paths.",
          expectedOutputs: ["source-manifest.json", "sources/local/client-context.md"],
        },
        {
          id: "canonical",
          label: "Canonical packet",
          status: "ready",
          detail: "Canonical modules use renewal-risk and account-review language.",
          expectedOutputs: ["canonical/*.md"],
        },
        {
          id: "policy",
          label: "Claims and voice",
          status: "ready",
          detail: "Claims policy blocks churn guarantees and autonomous-CSM claims.",
          expectedOutputs: ["linkedin/claims-policy.yaml", "linkedin/do-not-say.md"],
        },
        {
          id: "research",
          label: "Research",
          status: "ready",
          detail: "Fixture research supports evaluation guides without first-pilot claims.",
          expectedOutputs: ["sources/linkedin-research/post-type-taxonomy.csv"],
        },
        {
          id: "readiness",
          label: "Readiness",
          status: "ready",
          detail: "Second-client readiness proves Megaphone can generalize beyond the first pilot.",
          expectedOutputs: ["onboarding/readiness-report.md", "onboarding/first-brief-queue.json"],
        },
      ],
    },
    bridgeStatus: "seed",
    warnings: [
      "Load a local client folder to replace seed summaries with packet data from disk.",
    ],
  },
  {
    clientId: "demo-influencer",
    clientName: "Avery Stone",
    clientType: "influencer",
    modeGuidance: influencerModeGuidance,
    packetPath: "clients/demo-influencer",
    readiness: "ready_to_brief",
    sourceCount: 4,
    researchFiles: 1,
    activeBriefTopic: "what to inspect before hiring workflow narrative consulting help",
    activePostType: "evaluation_guide",
    allowAdjacentExamples: false,
    exampleCorpusStatus: "not_imported",
    activeAudience: "technical founders, developer-tool GTM leaders",
    proofRisk: "medium",
    aiDrafting: {
      availability: "missing_credentials",
      provider: "openai",
      model: "gpt-5-mini",
      storage: "not_configured",
      message: "OpenAI API key is not configured locally. Use megaphone/.env.local.example; deterministic fallback is active.",
      fallbackEnabled: true,
    },
    pipeline: [
      {
        id: "source-packet",
        label: "Source packet",
        status: "ready",
        detail: "Seed demo influencer source notes are ready for Workshop loading.",
      },
      {
        id: "brief",
        label: "Brief",
        status: "ready",
        detail: "First brief queue focuses on artifact-led fractional developer marketing evaluation.",
      },
      {
        id: "draft",
        label: "Draft",
        status: "ready",
        detail: "Consultant review accepted the package for demo completion.",
      },
      {
        id: "visual",
        label: "Visual",
        status: "review",
        detail: "Checklist visual can separate source material, proof, and review boundaries.",
      },
      {
        id: "measurement",
        label: "Measurement",
        status: "review",
        detail: "Research is an initial plan, not live post-performance data.",
      },
    ],
    calendarItems: [
      {
        id: "demo-influencer-proof",
        date: "Unscheduled",
        topic: "what to inspect before hiring workflow narrative consulting help",
        postType: "evaluation_guide",
        pillar: "artifact_led_consulting",
        draftReadiness: "manual_review",
      },
    ],
    calendarWarnings: [
      "Publishing still requires normal final owner approval.",
      "Research is a provisional plan until live LinkedIn data is imported.",
    ],
    measurementSignals: [
      {
        label: "Post packages",
        value: "1",
        caveat: "Generated from the demo demo influencer onboarding proof.",
      },
      {
        label: "Readout confidence",
        value: "Initial plan",
        caveat: "Use for safe topic selection, not performance optimization.",
      },
      {
        label: "Review status",
        value: "Phase proof approved",
        caveat: "Consultant review notes are captured in the client onboarding folder.",
      },
    ],
    onboarding: {
      draftClientName: "Avery Stone",
      readinessPreview: "ready_to_brief",
      generatedPacketPath: "clients/demo-influencer",
      exportFiles: [
        {
          path: "clients/demo-influencer/onboarding/client-mode.md",
          contents:
            "# Client Mode\n\n- Client: Avery Stone\n- Client type: influencer\n- Posting account: personal LinkedIn account\n\n## Voice Principle\n\nWrite from a named human's lived experience, opinions, observed patterns, and approved personal credibility proof.\n\n## Proof Boundary\n\nDo not imply the author speaks for a company unless that permission is explicit; keep personal proof separate from company proof.\n\n## Source Weighting\n\n- Prefer founder, expert, employee, practitioner, and consultant examples for voice.\n- Use company-authored examples for structure only, not personal voice mimicry.\n- Weight lived-experience source material above generic company positioning when choosing draft angle.\n",
        },
        {
          path: "clients/demo-influencer/onboarding/workshop-export-transcript.md",
          contents:
            "# Workshop Export Transcript\n\n- Client: Avery Stone\n- Client type: influencer\n- Client ID: demo-influencer\n- Generated at: 2026-06-21T20:00:00.000Z\n- Flow: Megaphone guided onboarding packet export\n- Source snapshots reviewed: demo-profile-readme, demo-intake-map, demo-source-index, demo-research-plan\n- Exported files: 23\n- First queued topic: what to inspect before hiring workflow narrative consulting help\n\nThis transcript records the demo guided onboarding proof. The packet was generated from structured onboarding inputs, exported through the Workshop onboarding action, then loaded through Megaphone core validation.\n",
        },
        {
          path: "clients/demo-influencer/onboarding/human-review-notes.md",
          contents:
            "# Human Review Notes\n\n- Review target: clients/demo-influencer/post-packages/demo-influencer-what-to-inspect-before-hiring-workflow-narrative-consulting-help\n- Review status: approved for demo completion\n- Reviewer: Codex consultant review\n- Captured at: 2026-06-21T20:00:00.000Z\n\n## Notes\n\n- demo generated the packet and first post package from demo influencer source notes.\n- The first package intentionally uses conceptual proof only.\n- The package keeps demo influencer source refs and research refs isolated, avoids pilot or fixture-client strategy leakage, and is appropriate as a reviewable first post package.\n- Publishing still requires normal final owner approval, but the demo onboarding proof is accepted.\n",
        },
      ],
      steps: [
        {
          id: "mode",
          label: "Account mode",
          status: "ready",
          detail: "Influencer clients publish from a named human's personal LinkedIn account with personal POV boundaries.",
          expectedOutputs: ["client.yaml", "onboarding/client-mode.md"],
        },
        {
          id: "profile",
          label: "Client profile",
          status: "ready",
          detail: "Seed demo influencer, channel, and audience inputs are captured.",
          expectedOutputs: ["client.yaml"],
        },
        {
          id: "sources",
          label: "Source intake",
          status: "ready",
          detail: "Local demo influencer records are snapshotted with provenance and privacy labels.",
          expectedOutputs: ["source-manifest.json", "sources/intake/"],
        },
        {
          id: "canonical",
          label: "Canonical packet",
          status: "ready",
          detail: "Canonical modules frame artifact-led consulting and technical buyer evaluation.",
          expectedOutputs: ["canonical/*.md"],
        },
        {
          id: "policy",
          label: "Claims and voice",
          status: "ready",
          detail: "Claims policy blocks pipeline guarantees and private business-record details.",
          expectedOutputs: ["linkedin/claims-policy.yaml", "linkedin/voice-guidance.md"],
        },
        {
          id: "research",
          label: "Research",
          status: "ready",
          detail: "Initial research plan is imported with confidence caveats.",
          expectedOutputs: ["sources/linkedin-research/research-readout.md"],
        },
        {
          id: "readiness",
          label: "Readiness",
          status: "ready",
          detail: "Workshop export transcript, readiness report, brief queue, and review notes are captured.",
          expectedOutputs: [
            "onboarding/workshop-export-transcript.md",
            "onboarding/readiness-report.md",
            "onboarding/human-review-notes.md",
          ],
        },
      ],
    },
    bridgeStatus: "seed",
    warnings: [
      "Load the local Avery Stone folder to replace seed summaries with packet data from disk.",
    ],
  },
] satisfies MegaphoneWorkspace[];

export const defaultMegaphoneClientId = megaphoneWorkspaces[0].clientId;

export function getMegaphoneWorkspace(clientId: string): MegaphoneWorkspace {
  return (
    megaphoneWorkspaces.find((workspace) => workspace.clientId === clientId) ??
    megaphoneWorkspaces[0]
  );
}

export function buildPrivateMegaphoneWorkspace(
  client: PrivateWorkspaceClient,
): MegaphoneWorkspace {
  const label = client.clientId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    ...megaphoneWorkspaces[0],
    clientId: client.clientId,
    clientName: label,
    clientType: "brand",
    packetPath: client.root,
    readiness: "source_review_needed",
    sourceCount: 0,
    researchFiles: 0,
    activeBriefTopic: "Load the private client folder to inspect source-backed topics",
    activePostType: "evaluation_guide",
    allowAdjacentExamples: false,
    exampleCorpusStatus: "not_imported",
    activeAudience: "buyer, operator",
    proofRisk: "medium",
    pipeline: [
      {
        id: "source-packet",
        label: "Source packet",
        status: "review",
        detail: "Load the indexed private client folder to read packet data from disk.",
      },
      {
        id: "brief",
        label: "Brief",
        status: "blocked",
        detail: "Briefing waits for a loaded private Megaphone client packet.",
      },
      {
        id: "draft",
        label: "Draft",
        status: "blocked",
        detail: "Drafting waits for a loaded private Megaphone client packet.",
      },
      {
        id: "visual",
        label: "Visual",
        status: "blocked",
        detail: "Visual guidance waits for a loaded private Megaphone client packet.",
      },
      {
        id: "measurement",
        label: "Measurement",
        status: "blocked",
        detail: "Measurement guidance waits for a loaded private Megaphone client packet.",
      },
    ],
    calendarItems: [],
    calendarWarnings: [],
    measurementSignals: [
      {
        label: "Private index",
        value: client.status,
        caveat: "Loaded from workspace.yaml; load the client folder for packet details.",
      },
    ],
    onboarding: {
      ...megaphoneWorkspaces[0].onboarding,
      draftClientName: label,
      readinessPreview: "source_review_needed",
      generatedPacketPath: client.root,
      steps: [],
      exportFiles: [],
    },
    bridgeStatus: "seed",
    warnings: [
      "This client was discovered in workspace.yaml. Load the private client folder to inspect packet data.",
    ],
  };
}

export function bridgeMegaphoneWorkspace(
  seed: MegaphoneWorkspace,
  loadedClient: MegaphoneLoadedClientSummary | null,
  packageSummary: MegaphoneBridgePackageSummary | null,
): MegaphoneWorkspace {
  if (!loadedClient) {
    return seed;
  }

  const packageArtifacts = packageSummary
    ? buildMegaphoneArtifacts(packageSummary.files)
    : buildMegaphoneArtifactsFromPaths(loadedClient.artifactPaths);
  const hasPackageArtifacts = packageArtifacts.length > 0;
  const bridgedCalendarItems = packageSummary
    ? buildCalendarItemsFromPackageFiles(loadedClient.clientId, packageSummary.files)
    : loadedClient.calendarItems;
  const bridgedMeasurementSignals = packageSummary
    ? buildMeasurementSignalsFromPackageFiles(packageSummary.files)
    : loadedClient.measurementSignals;

  return {
    ...seed,
    clientId: loadedClient.clientId,
    clientName: loadedClient.clientName,
    clientType: loadedClient.clientType,
    packetPath: loadedClient.path,
    readiness: loadedClient.readiness,
    sourceCount: loadedClient.sourceCount,
    researchFiles: loadedClient.researchFiles,
    pipeline: buildBridgePipeline(loadedClient, hasPackageArtifacts),
    calendarItems: hasPackageArtifacts ? bridgedCalendarItems : [],
    calendarWarnings: loadedClient.warnings,
    measurementSignals: hasPackageArtifacts
      ? bridgedMeasurementSignals
      : [
          {
            label: "Package artifacts",
            value: "0",
            caveat: "Create or load a post package before reading performance guidance.",
          },
        ],
    bridgeStatus: "loaded",
    warnings: loadedClient.warnings,
  };
}

function buildCalendarItemsFromPackageFiles(
  clientId: string,
  files: MegaphonePostPackageFile[],
): MegaphoneCalendarItem[] {
  const brief = readBriefJson(files);
  if (!brief) {
    return [];
  }

  return [
    {
      id: `${clientId}-${slugifyForId(brief.topic)}`,
      date: "Unscheduled",
      topic: brief.topic,
      postType: brief.postType,
      pillar: brief.contentPillar,
      draftReadiness: "manual_review",
    },
  ];
}

function buildMeasurementSignalsFromPackageFiles(
  files: MegaphonePostPackageFile[],
): MegaphoneMeasurementSignal[] {
  const brief = readBriefJson(files);
  if (!brief) {
    return [];
  }

  return [
    {
      label: "Post packages",
      value: "1",
      caveat: "Created from the current Megaphone post-package artifacts.",
    },
    {
      label: "Content pillar",
      value: brief.contentPillar,
      caveat: "Derived from package brief JSON.",
    },
    {
      label: "Readout confidence",
      value: "Artifact-backed",
      caveat: "Use published performance data before making optimization claims.",
    },
  ];
}

function readBriefJson(files: MegaphonePostPackageFile[]):
  | {
      topic: string;
      postType: string;
      contentPillar: string;
    }
  | null {
  const briefJson = files.find((file) => file.path.endsWith("/brief.json"));
  if (!briefJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(briefJson.contents) as {
      topic?: string;
      postType?: string;
      contentPillar?: string;
    };

    return {
      topic: parsed.topic ?? "Untitled post package",
      postType: parsed.postType ?? "unknown",
      contentPillar: parsed.contentPillar ?? "unassigned",
    };
  } catch {
    return null;
  }
}

function slugifyForId(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug.length > 1 ? slug : "post-package";
}

export function buildMegaphoneArtifacts(
  files: MegaphonePostPackageFile[],
): MegaphoneArtifact[] {
  return files.map((file) => ({
    label: artifactLabel(file.path),
    path: file.path,
    type: file.path.endsWith(".json") ? "json" : "markdown",
  }));
}

export function buildMegaphoneArtifactsFromPaths(paths: string[]): MegaphoneArtifact[] {
  return paths.map((path) => ({
    label: artifactLabel(path),
    path,
    type: path.endsWith(".json") ? "json" : "markdown",
  }));
}

function artifactLabel(path: string): string {
  const fileName = path.split("/").at(-1) ?? path;
  return fileName
    .replace(/\.(md|json)$/, "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildBridgePipeline(
  loadedClient: MegaphoneLoadedClientSummary,
  hasPackageArtifacts: boolean,
): MegaphonePipelineStage[] {
  return [
    {
      id: "source-packet",
      label: "Source packet",
      status: loadedClient.readiness === "blocked" ? "blocked" : "ready",
      detail: `${loadedClient.sourceCount} sources and ${loadedClient.researchFiles} research files loaded from ${loadedClient.path}.`,
    },
    {
      id: "brief",
      label: "Brief",
      status: hasPackageArtifacts ? "ready" : "review",
      detail: hasPackageArtifacts
        ? "Brief artifact is available in the loaded post package."
        : "Create a post package to generate a brief artifact.",
    },
    {
      id: "draft",
      label: "Draft",
      status: hasPackageArtifacts ? "ready" : "review",
      detail: hasPackageArtifacts
        ? "Draft artifacts are available in the loaded post package."
        : "Draft artifacts are not present yet.",
    },
    {
      id: "visual",
      label: "Visual",
      status: hasPackageArtifacts ? "review" : "blocked",
      detail: hasPackageArtifacts
        ? "Visual brief can be opened from generated artifacts."
        : "Visual brief is unavailable until a package is created.",
    },
    {
      id: "measurement",
      label: "Measurement",
      status: hasPackageArtifacts ? "review" : "blocked",
      detail: hasPackageArtifacts
        ? "Measurement tags can be opened from generated artifacts."
        : "Measurement tags are unavailable until a package is created.",
    },
  ];
}
