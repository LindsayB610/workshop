import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendCrawlRunEvent,
  createExtractedPageCacheEntry,
  createResumeQueue,
  ingestSitemapXml,
  ingestUrlList,
  normalizeCrawlUrl,
  readCrawlRunEvents,
  readExtractedPageCache,
  shouldIncludeCrawlUrl,
  summarizeCrawlRunState,
  writeExtractedPageCache,
  type CrawlRunEvent,
} from "../src/crawl.js";

describe("multi-page crawling", () => {
  it("normalizes crawl URLs for stable dedupe", () => {
    expect(
      normalizeCrawlUrl("/Docs/?b=2&a=1#section", "https://PARASAIL.io/root/"),
    ).toBe("https://parasail.io/Docs?a=1&b=2");
    expect(normalizeCrawlUrl("https://parasail.io/docs/#intro")).toBe(
      "https://parasail.io/docs",
    );
  });

  it("ingests fixture sitemaps with include and exclude rules", () => {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://parasail.io/</loc></url>
        <url><loc>https://parasail.io/docs/getting-started/</loc></url>
        <url><loc>https://parasail.io/docs/drafts/private</loc></url>
        <url><loc>https://blog.parasail.io/docs/offsite</loc></url>
      </urlset>`;

    const result = ingestSitemapXml(sitemap, {
      baseUrl: "https://parasail.io/",
      include: ["https://parasail.io/docs*"],
      exclude: ["*/drafts/*"],
    });

    expect(result.queued).toEqual(["https://parasail.io/docs/getting-started"]);
    expect(result.skipped.map((url) => url.reason)).toEqual([
      "not_included",
      "excluded",
      "outside_host",
    ]);
  });

  it("dedupes URL lists and enforces crawl limits", () => {
    const result = ingestUrlList(
      [
        "https://parasail.io/docs/",
        "https://parasail.io/docs#overview",
        "https://parasail.io/pricing",
        "https://parasail.io/customers",
        "mailto:hello@parasail.io",
      ],
      { baseUrl: "https://parasail.io/", limit: 2 },
    );

    expect(result.queued).toEqual([
      "https://parasail.io/docs",
      "https://parasail.io/pricing",
    ]);
    expect(result.skipped.map((url) => url.reason)).toEqual([
      "duplicate",
      "over_limit",
      "invalid_url",
    ]);
  });

  it("reports include and exclude decisions for individual URLs", () => {
    expect(
      shouldIncludeCrawlUrl("https://parasail.io/docs/platform", {
        baseUrl: "https://parasail.io/",
        include: ["*/docs/*"],
      }),
    ).toEqual({ included: true });
    expect(
      shouldIncludeCrawlUrl("https://parasail.io/blog/platform", {
        baseUrl: "https://parasail.io/",
        include: ["*/docs/*"],
      }),
    ).toEqual({ included: false, reason: "not_included" });
    expect(
      shouldIncludeCrawlUrl("https://parasail.io/docs/private", {
        exclude: ["*/private"],
      }),
    ).toEqual({ included: false, reason: "excluded" });
  });

  it("writes and reads per-page extracted text cache entries", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "redline-crawl-cache-"));
    const html = `<!doctype html>
      <html>
        <head><title>Parasail Docs</title></head>
        <body>
          <nav>Ignore this nav</nav>
          <main>
            <h1>Deploy OSS inference</h1>
            <p>Parasail helps teams run production inference with capacity planning.</p>
            <a href="/pricing#top">Pricing</a>
          </main>
        </body>
      </html>`;

    const entry = createExtractedPageCacheEntry({
      id: "parasail-docs",
      url: "https://parasail.io/docs/",
      html,
      capturedAt: "2026-06-20T21:00:00.000Z",
    });
    const cachePath = await writeExtractedPageCache(root, entry);
    const raw = await readFile(cachePath, "utf8");
    const loaded = await readExtractedPageCache(cachePath);

    expect(raw).toContain("\"htmlChecksum\"");
    expect(loaded.page.title).toBe("Parasail Docs");
    expect(loaded.page.bodyText).toContain("production inference");
    expect(loaded.page.bodyText).not.toContain("Ignore this nav");
    expect(loaded.page.links[0]?.href).toBe("https://parasail.io/pricing");
  });

  it("reads JSONL run state and builds a resume queue", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "redline-crawl-state-"));
    const statePath = path.join(root, "runs", "run-1.jsonl");
    const events: CrawlRunEvent[] = [
      {
        runId: "run-1",
        url: "https://parasail.io/a",
        status: "queued",
        at: "2026-06-20T21:00:00.000Z",
      },
      {
        runId: "run-1",
        url: "https://parasail.io/a",
        status: "completed",
        at: "2026-06-20T21:01:00.000Z",
        pageCachePath: "cache/a.json",
      },
      {
        runId: "run-1",
        url: "https://parasail.io/b",
        status: "started",
        at: "2026-06-20T21:02:00.000Z",
      },
      {
        runId: "run-1",
        url: "https://parasail.io/c",
        status: "failed",
        at: "2026-06-20T21:03:00.000Z",
        error: "timeout",
      },
    ];

    for (const event of events) {
      await appendCrawlRunEvent(statePath, event);
    }

    const loaded = await readCrawlRunEvents(statePath);
    const summary = summarizeCrawlRunState(loaded);

    expect(summary.completed).toEqual(["https://parasail.io/a"]);
    expect(summary.started).toEqual(["https://parasail.io/b"]);
    expect(summary.failed).toEqual(["https://parasail.io/c"]);
    expect(summary.remaining).toEqual(["https://parasail.io/b"]);
    expect(
      createResumeQueue(
        [
          "https://parasail.io/a",
          "https://parasail.io/b",
          "https://parasail.io/c",
          "https://parasail.io/d",
        ],
        loaded,
      ),
    ).toEqual(["https://parasail.io/b", "https://parasail.io/d"]);
    expect(
      createResumeQueue(["https://parasail.io/c"], loaded, { retryFailed: true }),
    ).toEqual(["https://parasail.io/c"]);
  });
});
