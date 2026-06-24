import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import type { WorkshopUpdateCheckResult, WorkshopUpdaterClient } from "./types";

export function createTauriUpdaterClient(): WorkshopUpdaterClient {
  let pendingUpdate: Awaited<ReturnType<typeof check>> | null = null;

  return {
    async check(): Promise<WorkshopUpdateCheckResult> {
      pendingUpdate = await check();

      if (!pendingUpdate) {
        return { available: false };
      }

      return {
        available: true,
        version: pendingUpdate.version,
        notes: pendingUpdate.body,
      };
    },
    async install(onProgress) {
      if (!pendingUpdate) {
        pendingUpdate = await check();
      }

      if (!pendingUpdate) {
        throw new Error("No Workshop update is available to install.");
      }

      let total: number | undefined;
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? undefined;
          onProgress?.(0, total);
        }

        if (event.event === "Progress") {
          onProgress?.(event.data.chunkLength, total);
        }
      });
      await relaunch();
    },
  };
}
