import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { z } from "zod";
import { extractPageFromHtml, type ExtractedPage } from "./extract.js";

export type CrawlSkipReason =
  | "invalid_url"
  | "duplicate"
  | "outside_host"
  | "not_included"
  | "excluded"
  | "over_limit";

export type CrawlSkippedUrl = {
  input: string;
  url?: string;
  reason: CrawlSkipReason;
};

export type CrawlRules = {
  baseUrl?: string;
  include?: string[];
  exclude?: string[];
  sameHostOnly?: boolean;
  limit?: number;
};

export type CrawlQueueBuildResult = {
  queued: string[];
  skipped: CrawlSkippedUrl[];
};

export type ExtractedPageCacheEntry = {
  id: string;
  url: string;
  capturedAt: string;
  htmlChecksum: string;
  page: ExtractedPage;
};

export const crawlRunEventSchema = z.object({
  runId: z.string().min(1),
  url: z.string().url(),
  status: z.enum(["queued", "started", "completed", "failed", "skipped"]),
  at: z.string().datetime(),
  pageCachePath: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});

export type CrawlRunEvent = z.infer<typeof crawlRunEventSchema>;

export type CrawlRunSummary = {
  queued: string[];
  started: string[];
  completed: string[];
  failed: string[];
  skipped: string[];
  remaining: string[];
};

function hashText(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function cacheFileName(url: string): string {
  return `${createHash("sha256").update(url).digest("hex")}.json`;
}

function wildcardPatternMatches(value: string, pattern: string): boolean {
  if (!pattern.includes("*")) {
    return value.includes(pattern);
  }

  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

function matchesAnyRule(url: string, patterns: string[] = []): boolean {
  return patterns.some((pattern) => wildcardPatternMatches(url, pattern));
}

export function normalizeCrawlUrl(rawUrl: string, baseUrl?: string): string {
  const url = new URL(rawUrl.trim(), baseUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported crawl URL protocol: ${url.protocol}`);
  }

  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname !== "/" ? url.pathname.replace(/\/+$/, "") : "/";

  const sortedSearchParams = [...url.searchParams.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  url.search = "";
  for (const [key, value] of sortedSearchParams) {
    url.searchParams.append(key, value);
  }

  return url.toString();
}

export function shouldIncludeCrawlUrl(url: string, rules: CrawlRules = {}): {
  included: boolean;
  reason?: CrawlSkipReason;
} {
  const normalizedUrl = normalizeCrawlUrl(url, rules.baseUrl);

  if (rules.baseUrl && rules.sameHostOnly !== false) {
    const candidate = new URL(normalizedUrl);
    const base = new URL(rules.baseUrl);
    if (candidate.host !== base.host) {
      return { included: false, reason: "outside_host" };
    }
  }

  if ((rules.include?.length ?? 0) > 0 && !matchesAnyRule(normalizedUrl, rules.include)) {
    return { included: false, reason: "not_included" };
  }

  if (matchesAnyRule(normalizedUrl, rules.exclude)) {
    return { included: false, reason: "excluded" };
  }

  return { included: true };
}

export function ingestUrlList(
  urls: string[],
  rules: CrawlRules = {},
): CrawlQueueBuildResult {
  const seen = new Set<string>();
  const queued: string[] = [];
  const skipped: CrawlSkippedUrl[] = [];

  for (const input of urls) {
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeCrawlUrl(input, rules.baseUrl);
    } catch {
      skipped.push({ input, reason: "invalid_url" });
      continue;
    }

    if (seen.has(normalizedUrl)) {
      skipped.push({ input, url: normalizedUrl, reason: "duplicate" });
      continue;
    }
    seen.add(normalizedUrl);

    const includeDecision = shouldIncludeCrawlUrl(normalizedUrl, rules);
    if (!includeDecision.included) {
      skipped.push({
        input,
        url: normalizedUrl,
        reason: includeDecision.reason ?? "not_included",
      });
      continue;
    }

    if (rules.limit !== undefined && queued.length >= rules.limit) {
      skipped.push({ input, url: normalizedUrl, reason: "over_limit" });
      continue;
    }

    queued.push(normalizedUrl);
  }

  return { queued, skipped };
}

export function parseSitemapUrls(xml: string): string[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("loc")
    .toArray()
    .map((element) => $(element).text().trim())
    .filter(Boolean);
}

export function ingestSitemapXml(
  xml: string,
  rules: CrawlRules = {},
): CrawlQueueBuildResult {
  return ingestUrlList(parseSitemapUrls(xml), rules);
}

export function createExtractedPageCacheEntry(input: {
  id: string;
  url: string;
  html: string;
  capturedAt: string;
  thinThreshold?: number;
}): ExtractedPageCacheEntry {
  const normalizedUrl = normalizeCrawlUrl(input.url);

  return {
    id: input.id,
    url: normalizedUrl,
    capturedAt: input.capturedAt,
    htmlChecksum: hashText(input.html),
    page: extractPageFromHtml({
      id: input.id,
      url: normalizedUrl,
      html: input.html,
      thinThreshold: input.thinThreshold,
    }),
  };
}

export async function writeExtractedPageCache(
  cacheDir: string,
  entry: ExtractedPageCacheEntry,
): Promise<string> {
  await mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, cacheFileName(entry.url));
  await writeFile(filePath, `${JSON.stringify(entry, null, 2)}\n`);
  return filePath;
}

export async function readExtractedPageCache(
  filePath: string,
): Promise<ExtractedPageCacheEntry> {
  return JSON.parse(await readFile(filePath, "utf8")) as ExtractedPageCacheEntry;
}

export function serializeCrawlRunEvent(event: CrawlRunEvent): string {
  return JSON.stringify(crawlRunEventSchema.parse(event));
}

export async function appendCrawlRunEvent(
  statePath: string,
  event: CrawlRunEvent,
): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await appendFile(statePath, `${serializeCrawlRunEvent(event)}\n`);
}

export async function readCrawlRunEvents(statePath: string): Promise<CrawlRunEvent[]> {
  try {
    const raw = await readFile(statePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => crawlRunEventSchema.parse(JSON.parse(line)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export function summarizeCrawlRunState(events: CrawlRunEvent[]): CrawlRunSummary {
  const latestByUrl = new Map<string, CrawlRunEvent>();

  for (const event of events) {
    latestByUrl.set(event.url, event);
  }

  const byStatus = {
    queued: [] as string[],
    started: [] as string[],
    completed: [] as string[],
    failed: [] as string[],
    skipped: [] as string[],
  };

  for (const event of latestByUrl.values()) {
    byStatus[event.status].push(event.url);
  }

  return {
    ...byStatus,
    remaining: [...byStatus.queued, ...byStatus.started],
  };
}

export function createResumeQueue(
  candidateUrls: string[],
  events: CrawlRunEvent[],
  options: { retryFailed?: boolean } = {},
): string[] {
  const latestByUrl = new Map<string, CrawlRunEvent>();
  for (const event of events) {
    latestByUrl.set(event.url, event);
  }

  return candidateUrls.filter((url) => {
    const event = latestByUrl.get(url);
    if (!event) {
      return true;
    }

    if (event.status === "failed") {
      return options.retryFailed === true;
    }

    return event.status === "queued" || event.status === "started";
  });
}
