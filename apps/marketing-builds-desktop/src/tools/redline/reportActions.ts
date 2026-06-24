import { invoke } from "@tauri-apps/api/core";
import { tools } from "../../tool-registry/tools";
import { readWorkspaceRootForTool } from "../../tool-registry/workspaceState";
import type { RedlineReportExportFile, RedlineWorkspace } from "./redlineData";

export type ReportExportResult =
  | {
      status: "exported";
      clientId: string;
      fileCount: number;
    }
  | {
      status: "copied";
      clientId: string;
      fileCount: number;
    }
  | {
      status: "unavailable";
      clientId: string;
      message: string;
    };

export async function exportRedlineReports(
  workspace: RedlineWorkspace,
  files: RedlineReportExportFile[],
): Promise<ReportExportResult> {
  if (!files.length) {
    return {
      status: "unavailable",
      clientId: workspace.clientId,
      message: "Run an audit before exporting reports.",
    };
  }

  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    const fileCount = await invoke<number>("redline_write_packet_files", {
      clientId: workspace.clientId,
      files,
      overwrite: true,
      workspaceRoot: readWorkspaceRootForTool(tools, "redline"),
    });

    return { status: "exported", clientId: workspace.clientId, fileCount };
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(
      files.map((file) => `# ${file.path}\n\n${file.contents}`).join("\n\n---\n\n"),
    );
    return { status: "copied", clientId: workspace.clientId, fileCount: files.length };
  }

  return {
    status: "unavailable",
    clientId: workspace.clientId,
    message: "Report export is available in the packaged Workshop app.",
  };
}
