import { invoke } from "@tauri-apps/api/core";

export type PulseProxyResponse<T> = {
  status: number;
  body: T;
};

export function isPulseProxyAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export async function loadPulseSnapshot<T>(runnerUrl: string, apiToken: string): Promise<PulseProxyResponse<T>> {
  requirePulseProxy();
  return invoke<PulseProxyResponse<T>>("pulse_load_snapshot", { runnerUrl, apiToken });
}

export async function completePulseOccurrence<T>(
  runnerUrl: string,
  apiToken: string,
  occurrenceId: string,
  completionNote?: string,
): Promise<PulseProxyResponse<T>> {
  requirePulseProxy();
  return invoke<PulseProxyResponse<T>>("pulse_mark_done", {
    runnerUrl,
    apiToken,
    occurrenceId,
    completionNote,
  });
}

function requirePulseProxy(): void {
  if (!isPulseProxyAvailable()) {
    throw new Error("Private Pulse connections are available in the packaged Workshop desktop app.");
  }
}
