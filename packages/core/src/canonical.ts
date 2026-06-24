import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ClientPacket } from "./loadClientPacket.js";
import type { CanonicalRegistryEntry, Readiness, SourceManifest } from "./schemas.js";

export type CanonicalModuleContent = {
  moduleId: string;
  readiness: Readiness;
  path: string;
  content: string;
};

export type ReadinessSummary = {
  byModule: Record<string, Readiness>;
  strong: string[];
  partial: string[];
  missing: string[];
};

export function summarizeCanonicalReadiness(
  manifest: SourceManifest,
  requiredModuleIds: string[] = [],
): ReadinessSummary {
  const byModule: Record<string, Readiness> = {};

  for (const entry of manifest.canonicalRegistry) {
    byModule[entry.moduleId] = entry.readiness;
  }

  for (const moduleId of requiredModuleIds) {
    if (!byModule[moduleId]) {
      byModule[moduleId] = "missing";
    }
  }

  return {
    byModule,
    strong: Object.keys(byModule).filter((moduleId) => byModule[moduleId] === "strong"),
    partial: Object.keys(byModule).filter((moduleId) => byModule[moduleId] === "partial"),
    missing: Object.keys(byModule).filter((moduleId) => byModule[moduleId] === "missing"),
  };
}

export async function readCanonicalModule(
  clientDir: string,
  entry: CanonicalRegistryEntry,
): Promise<CanonicalModuleContent> {
  const content = await readFile(path.resolve(clientDir, entry.path), "utf8");

  return {
    moduleId: entry.moduleId,
    readiness: entry.readiness,
    path: entry.path,
    content,
  };
}

export async function loadCanonicalModules(
  packet: ClientPacket,
): Promise<CanonicalModuleContent[]> {
  return Promise.all(
    packet.manifest.canonicalRegistry.map((entry) =>
      readCanonicalModule(packet.clientDir, entry),
    ),
  );
}
