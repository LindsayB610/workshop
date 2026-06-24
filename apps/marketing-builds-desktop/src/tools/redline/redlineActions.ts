import { invoke } from "@tauri-apps/api/core";
import { tools } from "../../tool-registry/tools";
import { readWorkspaceRootForTool } from "../../tool-registry/workspaceState";

export type ArtifactOpenResult =
  | {
      status: "opened";
      path: string;
    }
  | {
      status: "copied";
      path: string;
    }
  | {
      status: "unavailable";
      path: string;
      message: string;
    };

export async function openRedlineArtifact(path: string): Promise<ArtifactOpenResult> {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    await invoke("redline_open_path", { path, workspaceRoot: readWorkspaceRootForTool(tools, "redline") });
    return { status: "opened", path };
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(path);
    return { status: "copied", path };
  }

  return {
    status: "unavailable",
    path,
    message: "Artifact opening is available in the packaged Workshop app.",
  };
}
