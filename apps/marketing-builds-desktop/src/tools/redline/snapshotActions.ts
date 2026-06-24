import { invoke } from "@tauri-apps/api/core";
import { buildLiveTargetSnapshot } from "@redline/core/live-target-snapshot";
import type { LiveTargetSnapshotInput } from "@redline/core/live-target-snapshot";
import { tools } from "../../tool-registry/tools";
import { readWorkspaceRootForTool } from "../../tool-registry/workspaceState";
import demoLandingPageHtml from "../../../../../clients/demo-redline/targets/fixtures/landing-page.html?raw";
import type { AuditTargetOption, RedlineWorkspace } from "./redlineData";

export type LiveUrlFetchResult = {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  html: string;
};

export type LiveSnapshotResult =
  | {
      status: "snapshotted";
      target: AuditTargetOption;
      fileCount: number;
      message: string;
    }
  | {
      status: "blocked";
      message: string;
    };

function targetIdForSnapshot(target: AuditTargetOption, fetchedAt: string) {
  return `${target.id.replace(/^queued-/, "")}-${fetchedAt.slice(0, 10)}`;
}

function textBetween(html: string, pattern: RegExp): string {
  return html.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function stripTags(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headingsFromHtml(html: string): string[] {
  return Array.from(html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi))
    .map((match) => stripTags(match[1] ?? ""))
    .filter(Boolean);
}

function extractSnapshotPage(input: {
  targetId: string;
  finalUrl: string;
  html: string;
}): LiveTargetSnapshotInput["page"] {
  const title = textBetween(input.html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription =
    input.html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] ??
    input.html.match(/<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i)?.[1] ??
    "";
  const body = textBetween(input.html, /<body\b[^>]*>([\s\S]*?)<\/body>/i) || input.html;
  const bodyText = stripTags(body);
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;

  return {
    id: input.targetId,
    url: input.finalUrl,
    title,
    metaDescription,
    canonicalUrl: textBetween(
      input.html,
      /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i,
    ),
    lastModified: "",
    publishedDate: "",
    headings: headingsFromHtml(input.html),
    bodyText,
    wordCount,
    isEmptyShell: wordCount < 50,
    links: [],
  };
}

function fallbackChecksumForHtml(html: string): string {
  let hash = 0;

  for (let index = 0; index < html.length; index += 1) {
    hash = (Math.imul(31, hash) + html.charCodeAt(index)) >>> 0;
  }

  return `fnv32:${hash.toString(16).padStart(8, "0")}`;
}

async function checksumForHtml(html: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(html);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    return `sha256:${hex}`;
  }

  return fallbackChecksumForHtml(html);
}

function mockLiveFetch(target: AuditTargetOption): LiveUrlFetchResult {
  return {
    url: target.path,
    finalUrl: target.path,
    fetchedAt: "2026-06-23T12:00:00.000Z",
    html: demoLandingPageHtml,
  };
}

export async function snapshotLiveTarget(
  workspace: RedlineWorkspace,
  target: AuditTargetOption | undefined,
): Promise<LiveSnapshotResult> {
  if (!target) {
    return {
      status: "blocked",
      message: "Choose a queued live URL before snapshotting.",
    };
  }

  if (target.type !== "queued_url") {
    return {
      status: "blocked",
      message: "Snapshot Live URL is only available for queued URL targets.",
    };
  }

  const fetched =
    typeof window !== "undefined" && window.__TAURI_INTERNALS__
      ? await invoke<LiveUrlFetchResult>("redline_fetch_live_url", { url: target.path })
      : mockLiveFetch(target);
  const fetchedAt = new Date(fetched.fetchedAt).toISOString();
  const targetId = targetIdForSnapshot(target, fetchedAt);
  const checksum = await checksumForHtml(fetched.html);
  const page = extractSnapshotPage({
    targetId,
    finalUrl: fetched.finalUrl,
    html: fetched.html,
  });
  const snapshot = buildLiveTargetSnapshot({
    clientId: workspace.clientId,
    targetId,
    url: target.path,
    finalUrl: fetched.finalUrl,
    html: fetched.html,
    fetchedAt,
    checksum,
    page,
  });

  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    await invoke<number>("redline_write_target_snapshot_files", {
      clientId: workspace.clientId,
      files: snapshot.files,
      overwrite: true,
      workspaceRoot: readWorkspaceRootForTool(tools, "redline"),
    });
  }

  return {
    status: "snapshotted",
    target: {
      id: targetId,
      label: `Live snapshot ${fetchedAt.slice(0, 10)}`,
      type: "saved_fixture",
      path: snapshot.htmlPath,
      reportTargetId: target.reportTargetId,
      sourceUrl: target.path,
      finalUrl: fetched.finalUrl,
      snapshotAt: fetchedAt,
      snapshotPath: snapshot.snapshotPath,
      textPath: snapshot.textPath,
      role: "current_reproducible_audit_target",
    },
    fileCount: snapshot.files.length,
    message: `Saved live snapshot for ${fetched.finalUrl} as ${targetId}.`,
  };
}
