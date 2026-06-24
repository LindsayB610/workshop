import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import {
  clientConfigSchema,
  sourceManifestSchema,
  type ClientConfig,
  type SourceManifest,
} from "./schemas.js";
import {
  validateClientPacketFiles,
  type PacketValidationResult,
} from "./validation.js";

export type ClientPacket = {
  clientDir: string;
  client: ClientConfig;
  manifest: SourceManifest;
  validation: PacketValidationResult;
};

async function readStructuredFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  return YAML.parse(raw);
}

export async function loadClientPacket(clientDir: string): Promise<ClientPacket> {
  const clientConfigPath = path.join(clientDir, "client.yaml");
  const sourceManifestPath = path.join(clientDir, "source-manifest.json");

  const client = clientConfigSchema.parse(await readStructuredFile(clientConfigPath));
  const manifest = sourceManifestSchema.parse(await readStructuredFile(sourceManifestPath));
  const validation = await validateClientPacketFiles(clientDir, client, manifest);

  return {
    clientDir,
    client,
    manifest,
    validation,
  };
}
