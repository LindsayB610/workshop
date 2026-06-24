import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { ClientConfig, SourceManifest } from "./schemas.js";

export type PacketValidationIssueCode =
  | "client_id_mismatch"
  | "missing_required_canonical_module"
  | "missing_canonical_registry_entry"
  | "missing_canonical_file"
  | "missing_source_file"
  | "source_checksum_mismatch"
  | "missing_provenance_source"
  | "cross_client_reference";

export type PacketValidationIssue = {
  code: PacketValidationIssueCode;
  message: string;
  moduleId?: string;
  sourceId?: string;
};

export type PacketValidationResult = {
  valid: boolean;
  issues: PacketValidationIssue[];
};

export async function validateClientPacketFiles(
  clientDir: string,
  client: ClientConfig,
  manifest: SourceManifest,
): Promise<PacketValidationResult> {
  const issues: PacketValidationIssue[] = [];
  const sourceIds = new Set(manifest.sources.map((source) => source.id));
  const registryByModule = new Map(
    manifest.canonicalRegistry.map((entry) => [entry.moduleId, entry]),
  );

  if (client.clientId !== manifest.clientId) {
    issues.push({
      code: "client_id_mismatch",
      message: `Client config id "${client.clientId}" does not match manifest id "${manifest.clientId}".`,
    });
  }

  for (const source of manifest.sources) {
    if (source.clientId !== client.clientId) {
      issues.push({
        code: "cross_client_reference",
        message: `Source "${source.id}" belongs to client "${source.clientId}", not "${client.clientId}".`,
        sourceId: source.id,
      });
    }

    if (source.path) {
      const sourcePath = path.resolve(clientDir, source.path);
      try {
        await access(sourcePath);
      } catch {
        issues.push({
          code: "missing_source_file",
          message: `Source "${source.id}" file does not exist at ${source.path}.`,
          sourceId: source.id,
        });
        continue;
      }

      if (source.checksum?.startsWith("sha256:")) {
        const expectedChecksum = source.checksum.slice("sha256:".length);
        const fileBuffer = await readFile(sourcePath);
        const actualChecksum = createHash("sha256").update(fileBuffer).digest("hex");

        if (actualChecksum !== expectedChecksum) {
          issues.push({
            code: "source_checksum_mismatch",
            message: `Source "${source.id}" checksum does not match ${source.checksum}.`,
            sourceId: source.id,
          });
        }
      }
    }
  }

  for (const entry of manifest.canonicalRegistry) {
    if (entry.clientId !== client.clientId) {
      issues.push({
        code: "cross_client_reference",
        message: `Canonical module "${entry.moduleId}" belongs to client "${entry.clientId}", not "${client.clientId}".`,
        moduleId: entry.moduleId,
      });
    }

    for (const sourceId of entry.provenance) {
      if (!sourceIds.has(sourceId)) {
        issues.push({
          code: "missing_provenance_source",
          message: `Canonical module "${entry.moduleId}" references missing source "${sourceId}".`,
          moduleId: entry.moduleId,
          sourceId,
        });
      }
    }
  }

  for (const moduleId of client.requiredCanonicalModules) {
    if (!client.canonicalModules.includes(moduleId)) {
      issues.push({
        code: "missing_required_canonical_module",
        message: `Required canonical module "${moduleId}" is not listed in client canonicalModules.`,
        moduleId,
      });
    }

    const registryEntry = registryByModule.get(moduleId);
    if (!registryEntry) {
      issues.push({
        code: "missing_canonical_registry_entry",
        message: `Required canonical module "${moduleId}" has no manifest registry entry.`,
        moduleId,
      });
      continue;
    }

    const canonicalPath = path.resolve(clientDir, registryEntry.path);
    try {
      await access(canonicalPath);
    } catch {
      issues.push({
        code: "missing_canonical_file",
        message: `Required canonical module "${moduleId}" file does not exist at ${registryEntry.path}.`,
        moduleId,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
