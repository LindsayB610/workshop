import YAML from "yaml";
import {
  clientConfigSchema,
  clientOnboardingSessionSchema,
  redlinePromptsFileSchema,
  sourceManifestSchema,
  type ClientOnboardingSession,
  type OnboardingReadinessReport,
  type RedlinePromptsFile,
} from "./schemas.js";

export type OnboardingPacketFile = {
  path: string;
  format: "yaml" | "json" | "markdown";
  contents: string;
};

export type OnboardingPacketExport = {
  clientId: string;
  clientFolder: string;
  files: OnboardingPacketFile[];
  readiness: OnboardingReadinessReport;
  brief: string;
};

export function buildRedlinePromptsFile(
  session: ClientOnboardingSession,
): RedlinePromptsFile {
  const parsed = clientOnboardingSessionSchema.parse(session);
  const approvedCanonicalDrafts = parsed.canonicalDrafts.filter(
    (draft) => draft.reviewStatus === "approved",
  );

  return redlinePromptsFileSchema.parse({
    version: "1",
    prompts: parsed.prompts.map((prompt) => ({
      id: prompt.id,
      text: prompt.text,
      weight: prompt.weight,
      tags: prompt.tags,
    })),
    canonical_messaging: approvedCanonicalDrafts.map((draft) => ({
      title: draft.title,
      body: draft.body,
    })),
  });
}

export function serializeRedlinePromptsYaml(file: RedlinePromptsFile): string {
  const parsed = redlinePromptsFileSchema.parse(file);

  return YAML.stringify(parsed);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function modulePath(title: string): string {
  return `canonical/${slug(title) || "module"}.md`;
}

function buildOnboardingBrief(
  session: ClientOnboardingSession,
  readiness: OnboardingReadinessReport,
): string {
  const approvedDrafts = session.canonicalDrafts.filter(
    (draft) => draft.reviewStatus === "approved",
  );
  const usableSources = session.sourceIntake.filter(
    (source) => source.reviewStatus === "approved",
  );
  const staleSources = session.sourceIntake.filter(
    (source) => source.freshness === "stale" || source.freshness === "possibly_stale",
  );

  return [
    `# ${session.clientName} Onboarding Brief`,
    "",
    `Client ID: ${session.clientId}`,
    `Readiness: ${readiness.level}`,
    `Recommended first audit target: ${readiness.recommendedFirstAuditTarget?.title ?? "None"}`,
    "",
    "## What The Packet Knows",
    "",
    usableSources.length
      ? usableSources.map((source) => `- ${source.title} (${source.tier}, ${source.trustLevel})`).join("\n")
      : "- No approved sources yet.",
    "",
    "## Approved Canonical Modules",
    "",
    approvedDrafts.length
      ? approvedDrafts.map((draft) => `- ${draft.title}`).join("\n")
      : "- No approved canonical modules yet.",
    "",
    "## What Needs Refresh",
    "",
    staleSources.length
      ? staleSources.map((source) => `- ${source.title} is ${source.freshness}.`).join("\n")
      : "- No stale or possibly stale sources flagged.",
    "",
    "## Caveats",
    "",
    readiness.caveats.length ? readiness.caveats.map((caveat) => `- ${caveat}`).join("\n") : "- None.",
    "",
    "## Blocking Issues",
    "",
    readiness.blockingIssues.length
      ? readiness.blockingIssues.map((issue) => `- ${issue}`).join("\n")
      : "- None.",
    "",
  ].join("\n");
}

export function evaluateOnboardingReadiness(
  session: ClientOnboardingSession,
): OnboardingReadinessReport {
  const parsed = clientOnboardingSessionSchema.parse(session);
  const blockingIssues: string[] = [];
  const caveats: string[] = [];
  const approvedCanonicalDrafts = parsed.canonicalDrafts.filter(
    (draft) => draft.reviewStatus === "approved",
  );
  const sourceIds = new Set(parsed.sourceIntake.map((source) => source.id));
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const recommendedFirstAuditTarget = [...parsed.auditTargets].sort(
    (a, b) =>
      priorityRank[a.priority] - priorityRank[b.priority] ||
      a.id.localeCompare(b.id),
  )[0];

  if (approvedCanonicalDrafts.length === 0) {
    blockingIssues.push("No approved canonical messaging blocks.");
  }

  if (parsed.prompts.length === 0) {
    blockingIssues.push("No GEO target prompts.");
  }

  for (const draft of approvedCanonicalDrafts) {
    if (draft.clientId !== parsed.clientId) {
      blockingIssues.push(
        `Canonical draft "${draft.id}" belongs to client "${draft.clientId}", not "${parsed.clientId}".`,
      );
    }

    for (const sourceRef of draft.sourceRefs) {
      if (!sourceIds.has(sourceRef)) {
        blockingIssues.push(
          `Canonical draft "${draft.id}" references missing source "${sourceRef}".`,
        );
      }
    }
  }

  for (const prompt of parsed.prompts) {
    if (prompt.clientId !== parsed.clientId) {
      blockingIssues.push(
        `Prompt "${prompt.id}" belongs to client "${prompt.clientId}", not "${parsed.clientId}".`,
      );
    }

    for (const sourceRef of prompt.sourceRefs) {
      if (!sourceIds.has(sourceRef)) {
        blockingIssues.push(
          `Prompt "${prompt.id}" references missing source "${sourceRef}".`,
        );
      }
    }
  }

  for (const source of parsed.sourceIntake) {
    if (source.clientId !== parsed.clientId) {
      blockingIssues.push(
        `Source "${source.id}" belongs to client "${source.clientId}", not "${parsed.clientId}".`,
      );
    }

    if (source.reviewStatus === "approved" && !source.approver) {
      blockingIssues.push(
        `Approved source "${source.id}" must include an approver.`,
      );
    }

    if (source.trustLevel === "trusted" && source.confidence !== "high") {
      caveats.push(`Trusted source "${source.id}" has less than high confidence.`);
    }

    if (source.freshness === "possibly_stale") {
      caveats.push(
        `Source "${source.id}" may be stale and should be refreshed before high-confidence audit.`,
      );
    }

    if (source.freshness === "stale" && source.tier !== "foundational") {
      caveats.push(`Source "${source.id}" is stale and not foundational-only.`);
    }
  }

  for (const claim of parsed.claims) {
    if (claim.clientId !== parsed.clientId) {
      blockingIssues.push(
        `Claim "${claim.id}" belongs to client "${claim.clientId}", not "${parsed.clientId}".`,
      );
    }

    for (const sourceRef of claim.sourceRefs) {
      if (!sourceIds.has(sourceRef)) {
        if (claim.proofStatus === "missing_proof") {
          caveats.push(
            `Claim "${claim.id}" cites unavailable proof source "${sourceRef}".`,
          );
        } else {
          blockingIssues.push(
            `Claim "${claim.id}" references missing source "${sourceRef}".`,
          );
        }
      }
    }

    if (claim.proofStatus === "private_proof" && claim.publicUseApproved) {
      blockingIssues.push(
        `Claim "${claim.id}" has private proof marked public-use approved.`,
      );
    }

    if (claim.proofStatus === "private_proof") {
      caveats.push(`Claim "${claim.id}" is supported by private-only proof.`);
    }

    if (claim.proofStatus === "weak_proof" || claim.proofStatus === "missing_proof") {
      caveats.push(`Claim "${claim.id}" needs manual review before public copy.`);
    }
  }

  for (const target of parsed.auditTargets) {
    if (target.clientId !== parsed.clientId) {
      blockingIssues.push(
        `Audit target "${target.id}" belongs to client "${target.clientId}", not "${parsed.clientId}".`,
      );
    }
  }

  let promptsYaml: RedlinePromptsFile | undefined;
  if (blockingIssues.length === 0) {
    promptsYaml = buildRedlinePromptsFile(parsed);
  }

  return {
    clientId: parsed.clientId,
    level: blockingIssues.length
      ? "blocked"
      : caveats.length
        ? "auditable_with_caveats"
        : "ready_to_audit",
    blockingIssues,
    caveats,
    recommendedFirstAuditTarget,
    promptsYaml,
  };
}

export function buildOnboardingPacketExport(
  session: ClientOnboardingSession,
  generatedAt = new Date().toISOString(),
): OnboardingPacketExport {
  const parsed = clientOnboardingSessionSchema.parse(session);
  const readiness = evaluateOnboardingReadiness(parsed);
  const clientFolder = `clients/${parsed.clientId}`;
  const approvedDrafts = parsed.canonicalDrafts.filter(
    (draft) => draft.reviewStatus === "approved",
  );

  if (readiness.blockingIssues.length > 0) {
    throw new Error(
      `Cannot export onboarding packet with blocking issues: ${readiness.blockingIssues.join("; ")}`,
    );
  }

  const clientConfig = clientConfigSchema.parse({
    clientId: parsed.clientId,
    name: parsed.clientName,
    description: `Onboarded Redline packet for ${parsed.clientName}.`,
    canonicalModules: approvedDrafts.map((draft) => slug(draft.title)),
    requiredCanonicalModules: approvedDrafts.map((draft) => slug(draft.title)),
  });

  const canonicalRegistry = approvedDrafts.map((draft) => ({
    moduleId: slug(draft.title),
    clientId: parsed.clientId,
    path: modulePath(draft.title),
    readiness: "strong" as const,
    provenance: draft.sourceRefs,
  }));

  const sourceManifest = sourceManifestSchema.parse({
    clientId: parsed.clientId,
    generatedAt,
    sources: parsed.sourceIntake.map((source) => ({
      id: source.id,
      clientId: source.clientId,
      type: source.type,
      tier: source.tier,
      trustLevel: source.trustLevel,
      title: source.title,
      sourceId: source.id,
      fetchedAt: generatedAt,
      checksum: source.checksum,
    })),
    canonicalRegistry,
  });

  const files: OnboardingPacketFile[] = [
    {
      path: `${clientFolder}/client.yaml`,
      format: "yaml",
      contents: YAML.stringify(clientConfig),
    },
    {
      path: `${clientFolder}/source-manifest.json`,
      format: "json",
      contents: JSON.stringify(sourceManifest, null, 2),
    },
    ...approvedDrafts.map((draft) => ({
      path: `${clientFolder}/${modulePath(draft.title)}`,
      format: "markdown" as const,
      contents: [`# ${draft.title}`, "", draft.body, ""].join("\n"),
    })),
    {
      path: `${clientFolder}/prompts/messaging-alignment.yaml`,
      format: "yaml",
      contents: readiness.promptsYaml
        ? serializeRedlinePromptsYaml(readiness.promptsYaml)
        : YAML.stringify({ version: "1", prompts: [], canonical_messaging: [] }),
    },
    {
      path: `${clientFolder}/onboarding-brief.md`,
      format: "markdown",
      contents: buildOnboardingBrief(parsed, readiness),
    },
  ];

  return {
    clientId: parsed.clientId,
    clientFolder,
    files,
    readiness,
    brief: files[files.length - 1].contents,
  };
}
