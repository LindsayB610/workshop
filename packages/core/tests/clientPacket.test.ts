import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadCanonicalModules,
  summarizeCanonicalReadiness,
} from "../src/canonical.js";
import { loadClientPacket } from "../src/loadClientPacket.js";
import { privateFixtureIt } from "./privateFixtures.js";

async function createFixtureClient(overrides?: {
  clientIdMismatch?: boolean;
  missingCanonicalRegistryEntry?: boolean;
  missingCanonicalFile?: boolean;
  checksumMismatch?: boolean;
  missingSourceFile?: boolean;
  missingProvenanceSource?: boolean;
  missingRequiredCanonicalModule?: boolean;
  crossClientSource?: boolean;
}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "redline-"));
  const clientDir = path.join(root, "clients", "fixture");
  const canonicalDir = path.join(clientDir, "canonical");
  await mkdir(canonicalDir, { recursive: true });

  await writeFile(
    path.join(clientDir, "client.yaml"),
    [
      "clientId: fixture",
      "name: Fixture Client",
      "canonicalModules:",
      overrides?.missingRequiredCanonicalModule ? "  - buyer-language" : "  - positioning",
      "requiredCanonicalModules:",
      "  - positioning",
      "",
    ].join("\n"),
  );

  if (!overrides?.missingCanonicalFile) {
    await writeFile(
      path.join(canonicalDir, "positioning.md"),
      "# Positioning\n\nFixture positioning.\n",
    );
  }

  const provenance = overrides?.missingProvenanceSource
    ? ["missing-source"]
    : ["source-local-positioning"];

  const manifest = {
    clientId: overrides?.clientIdMismatch ? "other-client" : "fixture",
    generatedAt: "2026-06-20T00:00:00.000Z",
    sources: [
      {
        id: "source-local-positioning",
        clientId: overrides?.crossClientSource ? "other-client" : "fixture",
        type: "local",
        tier: "canonical",
        trustLevel: "trusted",
        title: "Positioning",
        path: overrides?.missingSourceFile
          ? "sources/missing-positioning.md"
          : "canonical/positioning.md",
        checksum: overrides?.checksumMismatch
          ? "sha256:0000000000000000000000000000000000000000000000000000000000000000"
          : "fixture-checksum",
      },
    ],
    canonicalRegistry: overrides?.missingCanonicalRegistryEntry
      ? []
      : [
          {
            moduleId: "positioning",
            clientId: "fixture",
            path: "canonical/positioning.md",
            readiness: "strong",
            provenance,
          },
        ],
  };

  await writeFile(
    path.join(clientDir, "source-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return clientDir;
}

describe("loadClientPacket", () => {
  privateFixtureIt("loads the checked-in Parasail Phase 1 packet", async () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const clientDir = path.resolve(testDir, "../../../clients/parasail");

    const packet = await loadClientPacket(clientDir);

    expect(packet.client.name).toBe("Parasail");
    expect(packet.client.requiredCanonicalModules).toEqual([
      "icp",
      "positioning",
      "buyer-language",
      "proof-library",
      "objections",
      "content-priorities",
    ]);
    expect(packet.validation).toEqual({ valid: true, issues: [] });
  });

  privateFixtureIt("parses Parasail freshness and trust metadata", async () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const clientDir = path.resolve(testDir, "../../../clients/parasail");

    const packet = await loadClientPacket(clientDir);
    const proofLibrary = packet.manifest.sources.find(
      (source) => source.id === "parasail-source-proof-library",
    );
    const baselineAudit = packet.manifest.sources.find(
      (source) => source.id === "parasail-source-homepage-baseline-audit",
    );

    expect(proofLibrary).toEqual(
      expect.objectContaining({
        trustLevel: "provisional",
        fetchedAt: "2026-06-20T00:00:00.000Z",
      }),
    );
    expect(baselineAudit).toEqual(
      expect.objectContaining({
        trustLevel: "trusted",
        lastEditedAt: "2026-06-02T00:00:00.000Z",
      }),
    );
  });

  privateFixtureIt("summarizes Parasail readiness across strong, partial, and missing states", async () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const clientDir = path.resolve(testDir, "../../../clients/parasail");
    const packet = await loadClientPacket(clientDir);

    const readiness = summarizeCanonicalReadiness(packet.manifest, [
      ...packet.client.requiredCanonicalModules,
      "geo-readiness",
    ]);

    expect(readiness.strong).toEqual(
      expect.arrayContaining([
        "icp",
        "positioning",
        "buyer-language",
        "objections",
        "content-priorities",
      ]),
    );
    expect(readiness.partial).toEqual(["proof-library"]);
    expect(readiness.missing).toEqual(["geo-readiness"]);
  });

  privateFixtureIt("loads Parasail-specific canonical content only when the Parasail packet is loaded", async () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const parasailDir = path.resolve(testDir, "../../../clients/parasail");
    const parasailPacket = await loadClientPacket(parasailDir);
    const parasailModules = await loadCanonicalModules(parasailPacket);

    expect(parasailModules.map((module) => module.moduleId)).toEqual(
      expect.arrayContaining(["icp", "positioning", "buyer-language"]),
    );
    expect(parasailModules.map((module) => module.content).join("\n")).toContain(
      "AI-native startups",
    );

    const fixturePacket = await loadClientPacket(await createFixtureClient());
    const fixtureModules = await loadCanonicalModules(fixturePacket);

    expect(fixtureModules.map((module) => module.content).join("\n")).not.toContain(
      "Parasail",
    );
  });

  it("loads the checked-in fixture client without Parasail source leakage", async () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const fixtureDir = path.resolve(testDir, "../../../clients/fixture");

    const packet = await loadClientPacket(fixtureDir);
    const modules = await loadCanonicalModules(packet);

    expect(packet.client.clientId).toBe("fixture");
    expect(packet.validation).toEqual({ valid: true, issues: [] });
    expect(modules.map((module) => module.content).join("\n")).not.toContain("Parasail");
  });

  it("loads a valid client packet", async () => {
    const clientDir = await createFixtureClient();

    const packet = await loadClientPacket(clientDir);

    expect(packet.client.name).toBe("Fixture Client");
    expect(packet.validation).toEqual({ valid: true, issues: [] });
  });

  it("reports client id mismatches between config and manifest", async () => {
    const clientDir = await createFixtureClient({ clientIdMismatch: true });

    const packet = await loadClientPacket(clientDir);

    expect(packet.validation.valid).toBe(false);
    expect(packet.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "client_id_mismatch",
        }),
      ]),
    );
  });

  it("reports required modules missing from canonicalModules", async () => {
    const clientDir = await createFixtureClient({
      missingRequiredCanonicalModule: true,
    });

    const packet = await loadClientPacket(clientDir);

    expect(packet.validation.valid).toBe(false);
    expect(packet.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_required_canonical_module",
          moduleId: "positioning",
        }),
      ]),
    );
  });

  it("reports missing canonical registry entries", async () => {
    const clientDir = await createFixtureClient({
      missingCanonicalRegistryEntry: true,
    });

    const packet = await loadClientPacket(clientDir);

    expect(packet.validation.valid).toBe(false);
    expect(packet.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_canonical_registry_entry",
          moduleId: "positioning",
        }),
      ]),
    );
  });

  it("reports missing required canonical files", async () => {
    const clientDir = await createFixtureClient({ missingCanonicalFile: true });

    const packet = await loadClientPacket(clientDir);

    expect(packet.validation.valid).toBe(false);
    expect(packet.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_canonical_file",
          moduleId: "positioning",
        }),
      ]),
    );
  });

  it("reports missing local source snapshot files", async () => {
    const clientDir = await createFixtureClient({ missingSourceFile: true });

    const packet = await loadClientPacket(clientDir);

    expect(packet.validation.valid).toBe(false);
    expect(packet.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_source_file",
          sourceId: "source-local-positioning",
        }),
      ]),
    );
  });

  it("reports source checksum mismatches", async () => {
    const clientDir = await createFixtureClient({ checksumMismatch: true });

    const packet = await loadClientPacket(clientDir);

    expect(packet.validation.valid).toBe(false);
    expect(packet.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "source_checksum_mismatch",
          sourceId: "source-local-positioning",
        }),
      ]),
    );
  });

  it("reports missing provenance sources", async () => {
    const clientDir = await createFixtureClient({ missingProvenanceSource: true });

    const packet = await loadClientPacket(clientDir);

    expect(packet.validation.valid).toBe(false);
    expect(packet.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_provenance_source",
          moduleId: "positioning",
          sourceId: "missing-source",
        }),
      ]),
    );
  });

  it("reports cross-client source references", async () => {
    const clientDir = await createFixtureClient({ crossClientSource: true });

    const packet = await loadClientPacket(clientDir);

    expect(packet.validation.valid).toBe(false);
    expect(packet.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "cross_client_reference",
          sourceId: "source-local-positioning",
        }),
      ]),
    );
  });
});
