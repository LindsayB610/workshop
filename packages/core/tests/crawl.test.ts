import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendCrawlRunEvent, createExtractedPageCacheEntry, createResumeQueue, ingestSitemapXml, normalizeCrawlUrl, readCrawlRunEvents, readExtractedPageCache, shouldIncludeCrawlUrl, summarizeCrawlRunState, writeExtractedPageCache } from "../src/crawl.js";

describe("multi-page crawling", () => {
  it("normalizes and filters demo URLs", () => {
    expect(normalizeCrawlUrl("/Docs/?b=2&a=1#section", "https://DEMO.example/root/")).toBe("https://demo.example/Docs?a=1&b=2");
    expect(shouldIncludeCrawlUrl("https://demo.example/docs/private", { baseUrl: "https://demo.example/", exclude: ["*/private"] })).toEqual({ included: false, reason: "excluded" });
  });
  it("applies sitemap inclusion rules", () => {
    const xml = "<urlset><url><loc>https://demo.example/docs/start/</loc></url><url><loc>https://demo.example/blog/</loc></url></urlset>";
    expect(ingestSitemapXml(xml, { baseUrl: "https://demo.example/", include: ["*/docs/*"] }).queued).toEqual(["https://demo.example/docs/start"]);
  });
  it("persists an extracted page cache entry", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "redline-crawl-"));
    const entry = createExtractedPageCacheEntry({ id: "docs", url: "https://demo.example/docs/", html: "<title>Demo Docs</title><main>Guide</main>", capturedAt: "2026-06-20T00:00:00.000Z" });
    const filePath = await writeExtractedPageCache(root, entry);
    expect((await readExtractedPageCache(filePath)).page.title).toBe("Demo Docs");
    expect(await readFile(filePath, "utf8")).toContain("htmlChecksum");
  });
  it("persists crawl state and resumes only unfinished work", async () => {
    const statePath = path.join(await mkdtemp(path.join(os.tmpdir(), "redline-crawl-state-")), "state.jsonl");
    await appendCrawlRunEvent(statePath, { runId: "run", url: "https://demo.example/a", status: "queued", at: "2026-06-20T00:00:00.000Z" });
    await appendCrawlRunEvent(statePath, { runId: "run", url: "https://demo.example/a", status: "completed", at: "2026-06-20T00:01:00.000Z" });
    await appendCrawlRunEvent(statePath, { runId: "run", url: "https://demo.example/b", status: "failed", at: "2026-06-20T00:02:00.000Z" });
    const events = await readCrawlRunEvents(statePath);
    expect(summarizeCrawlRunState(events).completed).toEqual(["https://demo.example/a"]);
    expect(createResumeQueue(["https://demo.example/a", "https://demo.example/b", "https://demo.example/c"], events)).toEqual(["https://demo.example/c"]);
    expect(createResumeQueue(["https://demo.example/b"], events, { retryFailed: true })).toEqual(["https://demo.example/b"]);
  });
});
