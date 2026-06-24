import type { ExtractedPage } from "./extract.js";

export type LiveTargetSnapshotInput = {
  clientId: string;
  url: string;
  html: string;
  fetchedAt: string;
  targetId?: string;
  finalUrl?: string;
  checksum?: string;
  page: ExtractedPage;
};

export type LiveTargetSnapshotFile = {
  path: string;
  contents: string;
};

export type LiveTargetSnapshot = {
  clientId: string;
  targetId: string;
  url: string;
  finalUrl: string;
  fetchedAt: string;
  htmlPath: string;
  textPath: string;
  snapshotPath: string;
  checksum: string;
  page: ExtractedPage;
  files: LiveTargetSnapshotFile[];
};

function slugifyTargetUrl(url: string): string {
  const parsed = new URL(url);
  const pathSlug = parsed.pathname
    .replace(/\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .join("-");
  const hostSlug = parsed.hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-");
  const slug = [hostSlug, pathSlug].filter(Boolean).join("-");

  return slug.toLowerCase().replace(/^-+|-+$/g, "") || "live-target";
}

function dateStamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid fetchedAt timestamp: ${value}`);
  }

  return parsed.toISOString().slice(0, 10);
}

function renderExtractedText(page: ExtractedPage): string {
  return [
    `Title: ${page.title}`,
    `URL: ${page.url}`,
    `Canonical URL: ${page.canonicalUrl}`,
    `Meta description: ${page.metaDescription}`,
    "",
    "Headings:",
    ...page.headings.map((heading) => `- ${heading}`),
    "",
    "Body:",
    page.bodyText,
    "",
  ].join("\n");
}

function renderSnapshotNote(snapshot: Omit<LiveTargetSnapshot, "files">): string {
  return [
    `# ${snapshot.targetId}`,
    "",
    `Source URL: ${snapshot.url}`,
    `Final URL: ${snapshot.finalUrl}`,
    `Fetched at: ${snapshot.fetchedAt}`,
    `Role: audit_target`,
    `HTML fixture: ${snapshot.htmlPath}`,
    `Extracted text: ${snapshot.textPath}`,
    `Checksum: ${snapshot.checksum}`,
    "",
    "Audit target only; do not cite as canonical messaging evidence.",
    "",
  ].join("\n");
}

export function buildLiveTargetSnapshot(
  input: LiveTargetSnapshotInput,
): LiveTargetSnapshot {
  const finalUrl = input.finalUrl ?? input.url;
  const stamp = dateStamp(input.fetchedAt);
  const targetId = input.targetId ?? `${slugifyTargetUrl(finalUrl)}-${stamp}`;
  const htmlPath = `clients/${input.clientId}/targets/fixtures/${targetId}.html`;
  const textPath = `clients/${input.clientId}/targets/extracted/${targetId}.txt`;
  const snapshotPath = `clients/${input.clientId}/targets/snapshots/${targetId}.md`;
  const page = {
    ...input.page,
    id: targetId,
    url: finalUrl,
  };
  const checksum = input.checksum ?? "unavailable";
  const baseSnapshot = {
    clientId: input.clientId,
    targetId,
    url: input.url,
    finalUrl,
    fetchedAt: new Date(input.fetchedAt).toISOString(),
    htmlPath,
    textPath,
    snapshotPath,
    checksum,
    page,
  };
  const files = [
    { path: htmlPath, contents: input.html },
    { path: textPath, contents: renderExtractedText(page) },
    { path: snapshotPath, contents: renderSnapshotNote(baseSnapshot) },
  ];

  return {
    ...baseSnapshot,
    files,
  };
}
