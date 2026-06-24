import { invoke } from "@tauri-apps/api/core";
import type { OnboardingPacketExport } from "@redline/core/onboarding";
import { tools } from "../../tool-registry/tools";
import { readWorkspaceRootForTool } from "../../tool-registry/workspaceState";

export type PacketExportResult =
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

export async function exportOnboardingPacket(
  packet: OnboardingPacketExport,
  options: { overwrite?: boolean } = {},
): Promise<PacketExportResult> {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    const fileCount = await invoke<number>("redline_write_packet_files", {
      clientId: packet.clientId,
      files: packet.files.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
      overwrite: options.overwrite ?? false,
      workspaceRoot: readWorkspaceRootForTool(tools, "redline"),
    });

    return { status: "exported", clientId: packet.clientId, fileCount };
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(
      packet.files.map((file) => `# ${file.path}\n\n${file.contents}`).join("\n\n---\n\n"),
    );
    return {
      status: "copied",
      clientId: packet.clientId,
      fileCount: packet.files.length,
    };
  }

  return {
    status: "unavailable",
    clientId: packet.clientId,
    message: "Packet export is available in the packaged Workshop app.",
  };
}
