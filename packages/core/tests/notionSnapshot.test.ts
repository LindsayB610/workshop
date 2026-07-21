import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildNotionSnapshotPath, createNotionSnapshot, evaluateNotionFreshness, readNotionSnapshotManifest, reviewNotionSourceWorkflow, snapshotNotionPageFromFetcher, snapshotNotionSourcesFromFetcher, validateFindingsCiteLocalSnapshots, writeNotionSnapshot, type NotionPageSnapshotInput } from "../src/notionSnapshot.js";
import type { Finding, SourceManifest } from "../src/schemas.js";

function input(overrides: Partial<NotionPageSnapshotInput> = {}): NotionPageSnapshotInput {
  return { pageId: "demo-pmm", title: "Demo Product Brief", markdown: "# Demo Product Brief\n\nPublic-safe example.", fetchedAt: "2026-06-20T12:00:00.000Z", lastEditedAt: "2026-06-19T12:00:00.000Z", sourceTier: "source_of_truth", trustLevel: "trusted", clientId: "demo-client", url: "https://www.notion.so/example/demo-pmm", ...overrides };
}

describe("notion snapshot adapter", () => {
  it("creates dated local snapshots with stable metadata", () => {
    const snapshot = createNotionSnapshot(input());
    expect(buildNotionSnapshotPath(input())).toBe("sources/notion/2026-06-20-demo-product-brief.md");
    expect(snapshot.manifestEntry.id).toBe("demo-client-notion-2026-06-20-demo-product-brief");
    expect(snapshot.markdown).toContain("source: notion");
  });
  it("writes a local manifest before audit use", async () => {
    const clientDir = path.join(await mkdtemp(path.join(os.tmpdir(), "redline-notion-")), "clients", "demo-client");
    await mkdir(clientDir, { recursive: true });
    const result = await writeNotionSnapshot(clientDir, input());
    expect((await readNotionSnapshotManifest(clientDir))?.sources).toHaveLength(1);
    expect(await readFile(path.join(clientDir, result.manifestEntry.path), "utf8")).toContain("Public-safe example.");
  });
  it("writes connector-fetched pages and rejects request metadata mismatches", async () => {
    const clientDir = path.join(await mkdtemp(path.join(os.tmpdir(), "redline-fetcher-")), "clients", "demo-client");
    const fetcher = { async fetchPage(request: { pageId: string; clientId: string; sourceTier: "source_of_truth"; trustLevel: "trusted" }) { return input(request); } };
    const request = { pageId: "demo-pmm", clientId: "demo-client", sourceTier: "source_of_truth" as const, trustLevel: "trusted" as const };
    expect((await snapshotNotionPageFromFetcher(clientDir, fetcher, request)).manifest.sources).toHaveLength(1);
    await expect(snapshotNotionPageFromFetcher(clientDir, { async fetchPage() { return input({ pageId: "wrong-page" }); } }, request)).rejects.toThrow(/metadata mismatch/);
  });
  it("snapshots request lists and reviews required local evidence", async () => {
    const clientDir = path.join(await mkdtemp(path.join(os.tmpdir(), "redline-fetch-list-")), "clients", "demo-client");
    const requests = [
      { pageId: "demo-pmm", clientId: "demo-client", sourceTier: "source_of_truth" as const, trustLevel: "trusted" as const },
      { pageId: "demo-positioning", clientId: "demo-client", sourceTier: "canonical" as const, trustLevel: "trusted" as const },
    ];
    const result = await snapshotNotionSourcesFromFetcher(clientDir, { async fetchPage(request) { return input({ ...request, title: request.pageId }); } }, requests);
    const sourceManifest: SourceManifest = { clientId: "demo-client", generatedAt: input().fetchedAt, sources: result.sourceSnapshots, canonicalRegistry: [] };
    expect(reviewNotionSourceWorkflow({ clientId: "demo-client", requestedSources: requests, notionManifest: result.manifest, sourceManifest, now: input().fetchedAt }).ready).toBe(true);
    expect(reviewNotionSourceWorkflow({ clientId: "demo-client", requestedSources: [...requests, { ...requests[0], pageId: "missing" }], notionManifest: result.manifest, sourceManifest, now: input().fetchedAt }).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "missing_required_snapshot" })]));
  });
  it("applies freshness rules before treating a snapshot as truth", () => {
    expect(evaluateNotionFreshness(input(), { now: "2026-06-20T12:00:00.000Z", freshnessWindowDays: 30 }).status).toBe("current");
    expect(evaluateNotionFreshness(input({ lastEditedAt: "2026-05-01T12:00:00.000Z" }), { now: "2026-06-20T12:00:00.000Z", freshnessWindowDays: 30, decayWindowDays: 90 }).allowedAsCanonicalTruth).toBe(false);
  });
  it("rejects live Notion references in audit findings", () => {
    const snapshot = createNotionSnapshot(input());
    const manifest: SourceManifest = { clientId: "demo-client", generatedAt: input().fetchedAt, sources: [snapshot.sourceSnapshot], canonicalRegistry: [] };
    const finding: Finding = { id: "f1", clientId: "demo-client", targetId: "home", url: "https://demo.example/", mode: "message_alignment", label: "Test", priority: "medium", confidence: "high", quotedText: "Text", issue: "Issue", suggestedFix: "Fix", sourceRefs: ["https://www.notion.so/example/live"], proofNeeded: "Proof", editReadiness: "manual_review" };
    expect(validateFindingsCiteLocalSnapshots([finding], manifest).valid).toBe(false);
    expect(validateFindingsCiteLocalSnapshots([{ ...finding, sourceRefs: [snapshot.sourceSnapshot.id] }], manifest)).toEqual({ valid: true, issues: [] });
  });
});
