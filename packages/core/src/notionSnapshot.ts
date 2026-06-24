import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  sourceTierSchema,
  trustLevelSchema,
  type Finding,
  type SourceManifest,
  type SourceSnapshot,
} from "./schemas.js";

export const notionSnapshotManifestEntrySchema = z.object({
  id: z.string().min(1),
  pageId: z.string().min(1),
  title: z.string().min(1),
  path: z.string().min(1),
  fetchedAt: z.string().datetime(),
  lastEditedAt: z.string().datetime().optional(),
  sourceTier: sourceTierSchema,
  trustLevel: trustLevelSchema,
  client: z.string().min(1),
  checksum: z.string().min(1),
  url: z.string().url().optional(),
  linkedFrom: z.array(z.string().min(1)).default([]),
});

export const notionSnapshotManifestSchema = z.object({
  clientId: z.string().min(1),
  generatedAt: z.string().datetime(),
  sources: z.array(notionSnapshotManifestEntrySchema),
});

export type NotionSnapshotManifestEntry = z.infer<
  typeof notionSnapshotManifestEntrySchema
>;
export type NotionSnapshotManifest = z.infer<typeof notionSnapshotManifestSchema>;

export type NotionPageSnapshotInput = {
  pageId: string;
  title: string;
  markdown: string;
  fetchedAt: string;
  lastEditedAt?: string;
  sourceTier: z.infer<typeof sourceTierSchema>;
  trustLevel: z.infer<typeof trustLevelSchema>;
  clientId: string;
  url?: string;
  linkedFrom?: string[];
};

export type NotionPageFetchRequest = {
  pageId: string;
  clientId: string;
  sourceTier: z.infer<typeof sourceTierSchema>;
  trustLevel: z.infer<typeof trustLevelSchema>;
  title?: string;
  linkedFrom?: string[];
};

export type NotionPageFetcher = {
  fetchPage(request: NotionPageFetchRequest): Promise<NotionPageSnapshotInput>;
};

export type FreshnessStatus =
  | "current"
  | "aging"
  | "foundational_allowed"
  | "stale"
  | "unknown";

export type NotionFreshnessResult = {
  status: FreshnessStatus;
  basis: "lastEditedAt" | "fetchedAt" | "none";
  ageDays?: number;
  allowedAsAuditEvidence: boolean;
  allowedAsCanonicalTruth: boolean;
  reason: string;
};

export type SnapshotCitationIssueCode =
  | "live_notion_reference"
  | "unknown_source_reference"
  | "notion_source_not_dated_snapshot";

export type SnapshotCitationIssue = {
  code: SnapshotCitationIssueCode;
  findingId: string;
  sourceRef: string;
  message: string;
};

export type SnapshotCitationValidationResult = {
  valid: boolean;
  issues: SnapshotCitationIssue[];
};

export type NotionSourceWorkflowIssueCode =
  | "missing_required_snapshot"
  | "snapshot_client_mismatch"
  | "source_manifest_missing_snapshot"
  | "trusted_snapshot_missing_last_edited"
  | "canonical_snapshot_not_trusted"
  | "snapshot_not_allowed_as_audit_evidence"
  | "snapshot_not_allowed_as_canonical_truth";

export type NotionSourceWorkflowIssue = {
  code: NotionSourceWorkflowIssueCode;
  severity: "blocker" | "caveat";
  pageId: string;
  sourceId?: string;
  message: string;
};

export type RequiredNotionSource = NotionPageFetchRequest & {
  required?: boolean;
};

export type NotionSourceWorkflowReview = {
  ready: boolean;
  issues: NotionSourceWorkflowIssue[];
  acceptedSourceIds: string[];
};

export function slugifyNotionTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "untitled";
}

export function notionSnapshotDate(input: { fetchedAt: string }): string {
  return input.fetchedAt.slice(0, 10);
}

export function buildNotionSnapshotPath(input: {
  title: string;
  fetchedAt: string;
}): string {
  return `sources/notion/${notionSnapshotDate(input)}-${slugifyNotionTitle(
    input.title,
  )}.md`;
}

export function buildNotionSnapshotId(input: {
  clientId: string;
  title: string;
  fetchedAt: string;
}): string {
  return `${input.clientId}-notion-${notionSnapshotDate(input)}-${slugifyNotionTitle(
    input.title,
  )}`;
}

export function renderNotionSnapshotMarkdown(input: NotionPageSnapshotInput): string {
  const lines = [
    "---",
    "source: notion",
    `pageId: ${input.pageId}`,
    `title: ${input.title}`,
    `fetchedAt: ${input.fetchedAt}`,
    ...(input.lastEditedAt ? [`lastEditedAt: ${input.lastEditedAt}`] : []),
    `sourceTier: ${input.sourceTier}`,
    `trustLevel: ${input.trustLevel}`,
    `client: ${input.clientId}`,
    "---",
    "",
    input.markdown.trim(),
    "",
  ];

  return lines.join("\n");
}

export function createNotionSnapshot(input: NotionPageSnapshotInput): {
  markdown: string;
  manifestEntry: NotionSnapshotManifestEntry;
  sourceSnapshot: SourceSnapshot;
} {
  const relativePath = buildNotionSnapshotPath(input);
  const id = buildNotionSnapshotId(input);
  const markdown = renderNotionSnapshotMarkdown(input);
  const checksum = `sha256:${createHash("sha256").update(markdown).digest("hex")}`;

  const manifestEntry: NotionSnapshotManifestEntry = {
    id,
    pageId: input.pageId,
    title: input.title,
    path: relativePath,
    fetchedAt: input.fetchedAt,
    lastEditedAt: input.lastEditedAt,
    sourceTier: input.sourceTier,
    trustLevel: input.trustLevel,
    client: input.clientId,
    checksum,
    url: input.url,
    linkedFrom: input.linkedFrom ?? [],
  };

  const sourceSnapshot: SourceSnapshot = {
    id,
    clientId: input.clientId,
    type: "notion",
    tier: input.sourceTier,
    trustLevel: input.trustLevel,
    title: input.title,
    path: relativePath,
    url: input.url,
    sourceId: input.pageId,
    fetchedAt: input.fetchedAt,
    lastEditedAt: input.lastEditedAt,
    checksum,
  };

  return { markdown, manifestEntry, sourceSnapshot };
}

export async function readNotionSnapshotManifest(
  clientDir: string,
): Promise<NotionSnapshotManifest | undefined> {
  const manifestPath = path.join(clientDir, "sources", "notion", "manifest.json");

  try {
    const raw = await readFile(manifestPath, "utf8");
    return notionSnapshotManifestSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function writeNotionSnapshot(
  clientDir: string,
  input: NotionPageSnapshotInput,
): Promise<{
  manifest: NotionSnapshotManifest;
  manifestEntry: NotionSnapshotManifestEntry;
  sourceSnapshot: SourceSnapshot;
}> {
  const snapshot = createNotionSnapshot(input);
  const snapshotPath = path.join(clientDir, snapshot.manifestEntry.path);
  const manifestPath = path.join(clientDir, "sources", "notion", "manifest.json");
  const existingManifest = await readNotionSnapshotManifest(clientDir);
  const existingSources = existingManifest?.sources ?? [];
  const nextSources = [
    ...existingSources.filter((source) => source.id !== snapshot.manifestEntry.id),
    snapshot.manifestEntry,
  ].sort((a, b) => a.id.localeCompare(b.id));

  const manifest: NotionSnapshotManifest = {
    clientId: input.clientId,
    generatedAt: input.fetchedAt,
    sources: nextSources,
  };

  await mkdir(path.dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, snapshot.markdown);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    manifest,
    manifestEntry: snapshot.manifestEntry,
    sourceSnapshot: snapshot.sourceSnapshot,
  };
}

export async function snapshotNotionPageFromFetcher(
  clientDir: string,
  fetcher: NotionPageFetcher,
  request: NotionPageFetchRequest,
): Promise<{
  manifest: NotionSnapshotManifest;
  manifestEntry: NotionSnapshotManifestEntry;
  sourceSnapshot: SourceSnapshot;
}> {
  const page = await fetcher.fetchPage(request);
  assertFetchedNotionPageMatchesRequest(page, request);
  return writeNotionSnapshot(clientDir, page);
}

export async function snapshotNotionSourcesFromFetcher(
  clientDir: string,
  fetcher: NotionPageFetcher,
  requests: NotionPageFetchRequest[],
): Promise<{
  manifest: NotionSnapshotManifest;
  sourceSnapshots: SourceSnapshot[];
}> {
  let manifest: NotionSnapshotManifest | undefined;
  const sourceSnapshots: SourceSnapshot[] = [];

  for (const request of requests) {
    const result = await snapshotNotionPageFromFetcher(clientDir, fetcher, request);
    manifest = result.manifest;
    sourceSnapshots.push(result.sourceSnapshot);
  }

  return {
    manifest: manifest ?? {
      clientId: requests[0]?.clientId ?? "unknown",
      generatedAt: new Date(0).toISOString(),
      sources: [],
    },
    sourceSnapshots,
  };
}

export function assertFetchedNotionPageMatchesRequest(
  page: NotionPageSnapshotInput,
  request: NotionPageFetchRequest,
): void {
  const mismatches = [
    page.pageId !== request.pageId
      ? `pageId "${page.pageId}" did not match requested "${request.pageId}"`
      : "",
    page.clientId !== request.clientId
      ? `clientId "${page.clientId}" did not match requested "${request.clientId}"`
      : "",
    page.sourceTier !== request.sourceTier
      ? `sourceTier "${page.sourceTier}" did not match requested "${request.sourceTier}"`
      : "",
    page.trustLevel !== request.trustLevel
      ? `trustLevel "${page.trustLevel}" did not match requested "${request.trustLevel}"`
      : "",
  ].filter(Boolean);

  if (mismatches.length) {
    throw new Error(`Fetched Notion page metadata mismatch: ${mismatches.join("; ")}.`);
  }
}

export function evaluateNotionFreshness(
  input: Pick<
    NotionPageSnapshotInput,
    "fetchedAt" | "lastEditedAt" | "sourceTier" | "linkedFrom"
  >,
  options: {
    now: string;
    freshnessWindowDays?: number;
    decayWindowDays?: number;
    currentSourceHubIds?: string[];
  },
): NotionFreshnessResult {
  const freshnessWindowDays = options.freshnessWindowDays ?? 30;
  const decayWindowDays = options.decayWindowDays ?? freshnessWindowDays * 3;
  const basis = input.lastEditedAt ? "lastEditedAt" : input.fetchedAt ? "fetchedAt" : "none";

  if (!input.lastEditedAt) {
    return {
      status: "unknown",
      basis,
      allowedAsAuditEvidence: false,
      allowedAsCanonicalTruth: false,
      reason:
        "Notion trust cannot be maintained from a fresh fetch alone; lastEditedAt metadata is required.",
    };
  }

  const ageMs = Date.parse(options.now) - Date.parse(input.lastEditedAt);
  const ageDays = Math.floor(ageMs / 86_400_000);

  if (Number.isFinite(ageDays) && ageDays <= freshnessWindowDays) {
    return {
      status: "current",
      basis,
      ageDays,
      allowedAsAuditEvidence: true,
      allowedAsCanonicalTruth: true,
      reason: `Fresh inside the ${freshnessWindowDays}-day project window.`,
    };
  }

  const linkedFromCurrentHub = (input.linkedFrom ?? []).some((sourceId) =>
    (options.currentSourceHubIds ?? []).includes(sourceId),
  );

  if (input.sourceTier === "foundational" && linkedFromCurrentHub) {
    return {
      status: "foundational_allowed",
      basis,
      ageDays,
      allowedAsAuditEvidence: true,
      allowedAsCanonicalTruth: false,
      reason:
        "Older foundational evidence is allowed because it is linked from the current source hub.",
    };
  }

  if (
    Number.isFinite(ageDays) &&
    ageDays <= decayWindowDays &&
    input.sourceTier !== "source_of_truth" &&
    input.sourceTier !== "canonical"
  ) {
    return {
      status: "aging",
      basis: "lastEditedAt",
      ageDays,
      allowedAsAuditEvidence: true,
      allowedAsCanonicalTruth: false,
      reason:
        `Not maintained inside the ${freshnessWindowDays}-day project window, ` +
        `but still inside the ${decayWindowDays}-day decay window for non-canonical evidence.`,
    };
  }

  return {
    status: "stale",
    basis,
    ageDays,
    allowedAsAuditEvidence: false,
    allowedAsCanonicalTruth: false,
    reason: `Outside the ${freshnessWindowDays}-day project window.`,
  };
}

export function validateFindingsCiteLocalSnapshots(
  findings: Finding[],
  manifest: SourceManifest,
): SnapshotCitationValidationResult {
  const sourcesById = new Map(manifest.sources.map((source) => [source.id, source]));
  const issues: SnapshotCitationIssue[] = [];

  for (const finding of findings) {
    for (const sourceRef of finding.sourceRefs) {
      if (sourceRef.startsWith("notion://") || sourceRef.includes("notion.so")) {
        issues.push({
          code: "live_notion_reference",
          findingId: finding.id,
          sourceRef,
          message: "Findings must cite dated local Notion snapshots, not live Notion URLs.",
        });
        continue;
      }

      const source = sourcesById.get(sourceRef);
      if (!source) {
        issues.push({
          code: "unknown_source_reference",
          findingId: finding.id,
          sourceRef,
          message: `Finding cites unknown source "${sourceRef}".`,
        });
        continue;
      }

      if (
        source.type === "notion" &&
        !source.path?.match(/^sources\/notion\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/)
      ) {
        issues.push({
          code: "notion_source_not_dated_snapshot",
          findingId: finding.id,
          sourceRef,
          message: `Notion source "${sourceRef}" must use a dated local snapshot path.`,
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function reviewNotionSourceWorkflow(input: {
  clientId: string;
  requestedSources: RequiredNotionSource[];
  notionManifest: NotionSnapshotManifest;
  sourceManifest: SourceManifest;
  now: string;
  freshnessWindowDays?: number;
  currentSourceHubIds?: string[];
}): NotionSourceWorkflowReview {
  const issues: NotionSourceWorkflowIssue[] = [];
  const notionEntriesByPageId = new Map(
    input.notionManifest.sources.map((source) => [source.pageId, source]),
  );
  const sourceManifestIds = new Set(input.sourceManifest.sources.map((source) => source.id));
  const acceptedSourceIds: string[] = [];

  for (const requestedSource of input.requestedSources) {
    const snapshot = notionEntriesByPageId.get(requestedSource.pageId);

    if (!snapshot) {
      if (requestedSource.required !== false) {
        issues.push({
          code: "missing_required_snapshot",
          severity: "blocker",
          pageId: requestedSource.pageId,
          message: `Required Notion page "${requestedSource.pageId}" has no dated local snapshot.`,
        });
      }
      continue;
    }

    if (snapshot.client !== input.clientId) {
      issues.push({
        code: "snapshot_client_mismatch",
        severity: "blocker",
        pageId: snapshot.pageId,
        sourceId: snapshot.id,
        message: `Snapshot "${snapshot.id}" belongs to "${snapshot.client}", not "${input.clientId}".`,
      });
    }

    if (!sourceManifestIds.has(snapshot.id)) {
      issues.push({
        code: "source_manifest_missing_snapshot",
        severity: "blocker",
        pageId: snapshot.pageId,
        sourceId: snapshot.id,
        message: `Snapshot "${snapshot.id}" is missing from the client source manifest.`,
      });
    }

    if (snapshot.trustLevel === "trusted" && !snapshot.lastEditedAt) {
      issues.push({
        code: "trusted_snapshot_missing_last_edited",
        severity: "blocker",
        pageId: snapshot.pageId,
        sourceId: snapshot.id,
        message: `Trusted Notion snapshot "${snapshot.id}" must include lastEditedAt.`,
      });
    }

    if (
      (snapshot.sourceTier === "source_of_truth" || snapshot.sourceTier === "canonical") &&
      snapshot.trustLevel !== "trusted"
    ) {
      issues.push({
        code: "canonical_snapshot_not_trusted",
        severity: "blocker",
        pageId: snapshot.pageId,
        sourceId: snapshot.id,
        message: `Canonical/source-of-truth snapshot "${snapshot.id}" must be trusted.`,
      });
    }

    const freshness = evaluateNotionFreshness(snapshot, {
      now: input.now,
      freshnessWindowDays: input.freshnessWindowDays,
      currentSourceHubIds: input.currentSourceHubIds,
    });

    if (!freshness.allowedAsAuditEvidence) {
      issues.push({
        code: "snapshot_not_allowed_as_audit_evidence",
        severity: "blocker",
        pageId: snapshot.pageId,
        sourceId: snapshot.id,
        message: `Snapshot "${snapshot.id}" is not allowed as audit evidence: ${freshness.reason}`,
      });
    }

    if (
      (snapshot.sourceTier === "source_of_truth" || snapshot.sourceTier === "canonical") &&
      !freshness.allowedAsCanonicalTruth
    ) {
      issues.push({
        code: "snapshot_not_allowed_as_canonical_truth",
        severity: "blocker",
        pageId: snapshot.pageId,
        sourceId: snapshot.id,
        message: `Snapshot "${snapshot.id}" is not allowed as canonical truth: ${freshness.reason}`,
      });
    }

    acceptedSourceIds.push(snapshot.id);
  }

  return {
    ready: issues.every((issue) => issue.severity !== "blocker"),
    issues,
    acceptedSourceIds,
  };
}
