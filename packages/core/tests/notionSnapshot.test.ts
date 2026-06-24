import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildNotionSnapshotPath,
  createNotionSnapshot,
  evaluateNotionFreshness,
  readNotionSnapshotManifest,
  reviewNotionSourceWorkflow,
  snapshotNotionPageFromFetcher,
  snapshotNotionSourcesFromFetcher,
  validateFindingsCiteLocalSnapshots,
  writeNotionSnapshot,
  type RequiredNotionSource,
  type NotionPageSnapshotInput,
} from "../src/notionSnapshot.js";
import type { Finding, SourceManifest } from "../src/schemas.js";
import { privateFixtureIt } from "./privateFixtures.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

function notionInput(
  overrides: Partial<NotionPageSnapshotInput> = {},
): NotionPageSnapshotInput {
  return {
    pageId: "notion-page-pmm",
    title: "Product Marketing Master Document",
    markdown: "# Product Marketing Master Document\n\nTrusted PMM content.",
    fetchedAt: "2026-06-20T12:00:00.000Z",
    lastEditedAt: "2026-06-19T12:00:00.000Z",
    sourceTier: "source_of_truth",
    trustLevel: "trusted",
    clientId: "parasail",
    url: "https://www.notion.so/example/Product-Marketing-Master-Document",
    linkedFrom: [],
    ...overrides,
  };
}

function validFinding(sourceRefs: string[]): Finding {
  return {
    id: "finding-1",
    clientId: "parasail",
    targetId: "homepage",
    url: "https://parasail.example/",
    mode: "message_alignment",
    label: "Hero alignment",
    priority: "high",
    confidence: "high",
    quotedText: "Production OSS inference without the MLOps burden.",
    issue: "The page should reflect the approved PMM frame.",
    suggestedFix: "Use the approved PMM frame.",
    sourceRefs,
    proofNeeded: "Confirm launch-approved copy.",
    editReadiness: "manual_review",
  };
}

const requiredParasailNotionSources: RequiredNotionSource[] = [
  {
    pageId: "352621ba-0cb3-8067-bf33-dc9040309d6a",
    title: "Product Marketing Master Document",
    clientId: "parasail",
    sourceTier: "source_of_truth",
    trustLevel: "trusted",
  },
  {
    pageId: "35a621ba-0cb3-8168-be75-db4b651933fd",
    title: "Positioning",
    clientId: "parasail",
    sourceTier: "source_of_truth",
    trustLevel: "trusted",
  },
  {
    pageId: "35a621ba-0cb3-8163-8982-c3ede604fb24",
    title: "Parasail Positioning Canvas",
    clientId: "parasail",
    sourceTier: "canonical",
    trustLevel: "trusted",
  },
  {
    pageId: "35a621ba-0cb3-81cc-aa17-ede5975e793d",
    title: "Parasail Positioning Manifesto",
    clientId: "parasail",
    sourceTier: "source_of_truth",
    trustLevel: "trusted",
  },
  {
    pageId: "35a621ba-0cb3-816d-8419-d2ebf3c01fbb",
    title: "Messaging Architecture",
    clientId: "parasail",
    sourceTier: "canonical",
    trustLevel: "trusted",
  },
  {
    pageId: "376621ba-0cb3-80c3-b95d-c3df3b6272a0",
    title: "Product Strategy 2026 (DRAFT)",
    clientId: "parasail",
    sourceTier: "context",
    trustLevel: "provisional",
  },
  {
    pageId: "35d621ba-0cb3-8041-8838-c8980cc076fe",
    title: "Runable Intro Call Notes (4/27/26)",
    clientId: "parasail",
    sourceTier: "foundational",
    trustLevel: "foundational",
    linkedFrom: ["352621ba-0cb3-8067-bf33-dc9040309d6a"],
  },
  {
    pageId: "373621ba-0cb3-80fd-bce8-c9a6b4e3b774",
    title: "Go/no go on Ish studios",
    clientId: "parasail",
    sourceTier: "context",
    trustLevel: "provisional",
  },
];

describe("notion snapshot adapter", () => {
  it("builds dated local snapshot paths from fetched time and title", () => {
    expect(buildNotionSnapshotPath(notionInput())).toBe(
      "sources/notion/2026-06-20-product-marketing-master-document.md",
    );
  });

  it("creates a manifest entry and source snapshot with required Notion metadata", () => {
    const snapshot = createNotionSnapshot(notionInput());

    expect(snapshot.manifestEntry).toEqual(
      expect.objectContaining({
        id: "parasail-notion-2026-06-20-product-marketing-master-document",
        pageId: "notion-page-pmm",
        title: "Product Marketing Master Document",
        fetchedAt: "2026-06-20T12:00:00.000Z",
        lastEditedAt: "2026-06-19T12:00:00.000Z",
        sourceTier: "source_of_truth",
        trustLevel: "trusted",
        client: "parasail",
        path: "sources/notion/2026-06-20-product-marketing-master-document.md",
      }),
    );
    expect(snapshot.sourceSnapshot).toEqual(
      expect.objectContaining({
        id: "parasail-notion-2026-06-20-product-marketing-master-document",
        clientId: "parasail",
        type: "notion",
        tier: "source_of_truth",
        trustLevel: "trusted",
        sourceId: "notion-page-pmm",
      }),
    );
    expect(snapshot.markdown).toContain("source: notion");
    expect(snapshot.markdown).toContain("# Product Marketing Master Document");
    expect(snapshot.manifestEntry.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("writes snapshots and a local manifest before audit use", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "redline-notion-"));
    const clientDir = path.join(root, "clients", "parasail");
    await mkdir(clientDir, { recursive: true });

    const result = await writeNotionSnapshot(clientDir, notionInput());
    const manifest = await readNotionSnapshotManifest(clientDir);
    const markdown = await readFile(
      path.join(clientDir, result.manifestEntry.path),
      "utf8",
    );

    expect(manifest?.sources).toHaveLength(1);
    expect(manifest?.sources[0]).toEqual(result.manifestEntry);
    expect(markdown).toContain("Trusted PMM content.");
  });

  it("can snapshot a page through a connector-backed fetcher interface", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "redline-fetcher-"));
    const clientDir = path.join(root, "clients", "parasail");
    await mkdir(clientDir, { recursive: true });

    const result = await snapshotNotionPageFromFetcher(
      clientDir,
      {
        async fetchPage(request) {
          return notionInput({
            pageId: request.pageId,
            clientId: request.clientId,
            sourceTier: request.sourceTier,
            trustLevel: request.trustLevel,
            linkedFrom: request.linkedFrom,
          });
        },
      },
      {
        pageId: "notion-page-pmm",
        clientId: "parasail",
        sourceTier: "source_of_truth",
        trustLevel: "trusted",
        linkedFrom: ["parasail-current-pmm"],
      },
    );

    expect(result.manifest.sources[0]).toEqual(
      expect.objectContaining({
        pageId: "notion-page-pmm",
        client: "parasail",
        linkedFrom: ["parasail-current-pmm"],
      }),
    );
  });

  it("snapshots a connector-backed request list and rejects metadata mismatches", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "redline-fetch-list-"));
    const clientDir = path.join(root, "clients", "parasail");
    await mkdir(clientDir, { recursive: true });

    const result = await snapshotNotionSourcesFromFetcher(
      clientDir,
      {
        async fetchPage(request) {
          return notionInput({
            pageId: request.pageId,
            title: request.title ?? "Untitled",
            clientId: request.clientId,
            sourceTier: request.sourceTier,
            trustLevel: request.trustLevel,
          });
        },
      },
      [
        {
          pageId: "notion-page-pmm",
          title: "Product Marketing Master Document",
          clientId: "parasail",
          sourceTier: "source_of_truth",
          trustLevel: "trusted",
        },
        {
          pageId: "notion-page-positioning",
          title: "Positioning",
          clientId: "parasail",
          sourceTier: "canonical",
          trustLevel: "trusted",
        },
      ],
    );

    expect(result.manifest.sources).toHaveLength(2);
    await expect(
      snapshotNotionSourcesFromFetcher(
        clientDir,
        {
          async fetchPage(request) {
            return notionInput({
              pageId: "wrong-page",
              clientId: request.clientId,
              sourceTier: request.sourceTier,
              trustLevel: request.trustLevel,
            });
          },
        },
        [
          {
            pageId: "notion-page-pmm",
            clientId: "parasail",
            sourceTier: "source_of_truth",
            trustLevel: "trusted",
          },
        ],
      ),
    ).rejects.toThrow(/metadata mismatch/);
  });

  it("treats fresh Notion pages as allowed audit evidence and canonical truth", () => {
    const freshness = evaluateNotionFreshness(notionInput(), {
      now: "2026-06-20T12:00:00.000Z",
      freshnessWindowDays: 30,
    });

    expect(freshness).toEqual(
      expect.objectContaining({
        status: "current",
        basis: "lastEditedAt",
        allowedAsAuditEvidence: true,
        allowedAsCanonicalTruth: true,
      }),
    );
  });

  it("does not renew Notion trust from a fresh fetch when the page is not maintained", () => {
    const freshness = evaluateNotionFreshness(
      notionInput({
        fetchedAt: "2026-06-20T12:00:00.000Z",
        lastEditedAt: undefined,
      }),
      {
        now: "2026-06-20T12:00:00.000Z",
        freshnessWindowDays: 30,
      },
    );

    expect(freshness).toEqual(
      expect.objectContaining({
        status: "unknown",
        basis: "fetchedAt",
        allowedAsAuditEvidence: false,
        allowedAsCanonicalTruth: false,
      }),
    );
    expect(freshness.reason).toContain("fresh fetch alone");
  });

  it("decays non-canonical Notion pages into evidence-only trust before they become stale", () => {
    const freshness = evaluateNotionFreshness(
      notionInput({
        sourceTier: "context",
        trustLevel: "provisional",
        lastEditedAt: "2026-05-01T12:00:00.000Z",
      }),
      {
        now: "2026-06-20T12:00:00.000Z",
        freshnessWindowDays: 30,
        decayWindowDays: 90,
      },
    );

    expect(freshness).toEqual(
      expect.objectContaining({
        status: "aging",
        basis: "lastEditedAt",
        ageDays: 50,
        allowedAsAuditEvidence: true,
        allowedAsCanonicalTruth: false,
      }),
    );
  });

  it("does not allow stale canonical Notion pages to remain canonical truth", () => {
    const freshness = evaluateNotionFreshness(
      notionInput({
        sourceTier: "source_of_truth",
        trustLevel: "trusted",
        lastEditedAt: "2026-05-01T12:00:00.000Z",
      }),
      {
        now: "2026-06-20T12:00:00.000Z",
        freshnessWindowDays: 30,
        decayWindowDays: 90,
      },
    );

    expect(freshness).toEqual(
      expect.objectContaining({
        status: "stale",
        allowedAsAuditEvidence: false,
        allowedAsCanonicalTruth: false,
      }),
    );
  });

  it("allows stale customer evidence only as foundational evidence when linked from the current PMM hub", () => {
    const freshness = evaluateNotionFreshness(
      notionInput({
        title: "Runable Intro Call Notes",
        sourceTier: "foundational",
        lastEditedAt: "2026-04-01T12:00:00.000Z",
        linkedFrom: ["parasail-current-pmm"],
      }),
      {
        now: "2026-06-20T12:00:00.000Z",
        freshnessWindowDays: 30,
        currentSourceHubIds: ["parasail-current-pmm"],
      },
    );

    expect(freshness).toEqual(
      expect.objectContaining({
        status: "foundational_allowed",
        allowedAsAuditEvidence: true,
        allowedAsCanonicalTruth: false,
      }),
    );
  });

  it("does not infer freshness from a URL or successful fetch alone", () => {
    const freshness = evaluateNotionFreshness(
      notionInput({
        fetchedAt: "",
        lastEditedAt: undefined,
        url: "https://www.notion.so/example",
      }),
      {
        now: "2026-06-20T12:00:00.000Z",
        freshnessWindowDays: 30,
      },
    );

    expect(freshness).toEqual(
      expect.objectContaining({
        status: "unknown",
        allowedAsAuditEvidence: false,
        allowedAsCanonicalTruth: false,
      }),
    );
  });

  it("rejects audit findings that cite live Notion instead of dated local snapshots", () => {
    const sourceManifest: SourceManifest = {
      clientId: "parasail",
      generatedAt: "2026-06-20T12:00:00.000Z",
      sources: [
        createNotionSnapshot(notionInput()).sourceSnapshot,
        {
          id: "parasail-source-positioning",
          clientId: "parasail",
          type: "local",
          tier: "canonical",
          trustLevel: "trusted",
          title: "Positioning",
          path: "canonical/positioning.md",
        },
      ],
      canonicalRegistry: [],
    };

    expect(
      validateFindingsCiteLocalSnapshots(
        [
          validFinding([
            "https://www.notion.so/example/Product-Marketing-Master-Document",
          ]),
        ],
        sourceManifest,
      ),
    ).toEqual(
      expect.objectContaining({
        valid: false,
        issues: [
          expect.objectContaining({
            code: "live_notion_reference",
          }),
        ],
      }),
    );

    expect(
      validateFindingsCiteLocalSnapshots(
        [
          validFinding([
            "parasail-notion-2026-06-20-product-marketing-master-document",
            "parasail-source-positioning",
          ]),
        ],
        sourceManifest,
      ),
    ).toEqual({ valid: true, issues: [] });
  });

  privateFixtureIt("tracks the checked-in Parasail Notion snapshots in both manifests", () => {
    const notionManifest = JSON.parse(
      readFileSync(
        path.join(repoRoot, "clients/parasail/sources/notion/manifest.json"),
        "utf8",
      ),
    );
    const sourceManifest = JSON.parse(
      readFileSync(path.join(repoRoot, "clients/parasail/source-manifest.json"), "utf8"),
    ) as SourceManifest;
    const notionSourceIds = new Set(
      sourceManifest.sources
        .filter((source) => source.type === "notion")
        .map((source) => source.id),
    );

    expect(notionManifest.sources).toHaveLength(16);
    expect(notionManifest.sources.map((source: { title: string }) => source.title)).toEqual(
      expect.arrayContaining([
        "Product Marketing Master Document",
        "Positioning",
        "Parasail Positioning Canvas",
        "Parasail Positioning Manifesto",
        "Messaging Architecture",
        "Product Strategy 2026 (DRAFT)",
        "Runable Intro Call Notes (4/27/26)",
        "Skyfall AI Intro Call (5/11/26)",
        "Mike <> Cantina Labs Transcript (4/30/26)",
        "Iconic Games Intro Call (4/29/26)",
        "Parasail <> Ngram Intro Call (4/28/26)",
        "Venice Sync 4/16",
        "Investor Note on Gravity",
        "Writer - Call Summary 6/3",
        "H2 Roadmap",
        "Go/no go on Ish studios",
      ]),
    );

    for (const snapshot of notionManifest.sources) {
      expect(snapshot.path).toMatch(/^sources\/notion\/2026-06-20-.+\.md$/);
      expect(snapshot.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(notionSourceIds.has(snapshot.id)).toBe(true);
    }
  });

  privateFixtureIt("reviews the checked-in Parasail Notion source workflow as ready", () => {
    const notionManifest = JSON.parse(
      readFileSync(
        path.join(repoRoot, "clients/parasail/sources/notion/manifest.json"),
        "utf8",
      ),
    );
    const sourceManifest = JSON.parse(
      readFileSync(path.join(repoRoot, "clients/parasail/source-manifest.json"), "utf8"),
    ) as SourceManifest;

    const review = reviewNotionSourceWorkflow({
      clientId: "parasail",
      requestedSources: requiredParasailNotionSources,
      notionManifest,
      sourceManifest,
      now: "2026-06-20T21:00:00.000Z",
      freshnessWindowDays: 45,
      currentSourceHubIds: ["352621ba-0cb3-8067-bf33-dc9040309d6a"],
    });

    expect(review).toEqual(
      expect.objectContaining({
        ready: true,
        issues: [],
      }),
    );
    expect(review.acceptedSourceIds).toContain(
      "parasail-notion-2026-06-20-product-marketing-master-document",
    );
  });

  it("blocks incomplete or untrusted Notion workflows before audit use", () => {
    const snapshot = createNotionSnapshot(
      notionInput({
        lastEditedAt: undefined,
        sourceTier: "source_of_truth",
        trustLevel: "trusted",
      }),
    );
    const notionManifest = {
      clientId: "parasail",
      generatedAt: "2026-06-20T12:00:00.000Z",
      sources: [snapshot.manifestEntry],
    };
    const sourceManifest: SourceManifest = {
      clientId: "parasail",
      generatedAt: "2026-06-20T12:00:00.000Z",
      sources: [],
      canonicalRegistry: [],
    };

    const review = reviewNotionSourceWorkflow({
      clientId: "parasail",
      requestedSources: [
        {
          pageId: "notion-page-pmm",
          clientId: "parasail",
          sourceTier: "source_of_truth",
          trustLevel: "trusted",
        },
        {
          pageId: "missing-page",
          clientId: "parasail",
          sourceTier: "canonical",
          trustLevel: "trusted",
        },
      ],
      notionManifest,
      sourceManifest,
      now: "2026-06-20T12:00:00.000Z",
      freshnessWindowDays: 30,
    });

    expect(review.ready).toBe(false);
    expect(review.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "source_manifest_missing_snapshot",
        "trusted_snapshot_missing_last_edited",
        "missing_required_snapshot",
      ]),
    );
  });
});
