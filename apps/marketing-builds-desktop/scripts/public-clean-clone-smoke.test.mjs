import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  allowedPublicClientDirs,
  disableUpdaterArtifactsForPublicBuild,
  listPublicClientDirs,
  runPublicCleanCloneSmoke,
  stagePublicClone,
  validatePublicClone,
  validateReadme,
  validateTauriResources,
} from "./public-clean-clone-smoke.mjs";

const privateClientId = ["para", "sail"].join("");

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

async function createFixtureRepo() {
  const root = await mkdtemp(path.join(tmpdir(), "workshop-public-clone-fixture-"));
  for (const clientDir of [...allowedPublicClientDirs, privateClientId]) {
    mkdirSync(path.join(root, "clients", clientDir), { recursive: true });
    writeFileSync(path.join(root, "clients", clientDir, "client.yaml"), `clientId: ${clientDir}\n`);
  }

  mkdirSync(path.join(root, "apps/marketing-builds-desktop/src-tauri"), { recursive: true });
  writeJson(path.join(root, "apps/marketing-builds-desktop/src-tauri/tauri.conf.json"), {
    bundle: {
      resources: [
        "../../../clients/demo-redline",
        "../../../clients/demo-megaphone",
        "../../../clients/fixture",
        "../../../clients/template-redline",
        "../../../clients/template-megaphone",
      ],
    },
  });

  mkdirSync(path.join(root, "docs"), { recursive: true });
  writeJson(path.join(root, "docs/data-boundary-inventory.json"), {
    status: "fixture",
    classifications: [
      { path: "README.md", classification: "public-docs", publicSafe: true },
      { path: "docs", classification: "public-docs", publicSafe: true },
      { path: "apps", classification: "app-code", publicSafe: true },
      {
        path: "apps/marketing-builds-desktop/src-tauri/tauri.conf.json",
        classification: "app-code",
        publicSafe: true,
      },
      ...[...allowedPublicClientDirs].map((clientDir) => ({
        path: `clients/${clientDir}`,
        classification: clientDir.startsWith("template-") ? "template" : "safe-demo-fixture",
        publicSafe: true,
      })),
      {
        path: `clients/${privateClientId}`,
        classification: "private-excluded",
        publicSafe: false,
      },
    ],
    blockedTerms: [
      {
        id: "private-client",
        pattern: privateClientId,
        severity: "private-client",
        reason: "Private client should not be in public clone.",
      },
    ],
  });
  writeFileSync(
    path.join(root, "README.md"),
    [
      "Workshop opens with fictional demo data",
      "npm install",
      "npm test",
      "npm run test:public",
      "npm run desktop:dev",
      "npm run desktop:tauri -- build",
      "Redline",
      "Megaphone",
      "docs/private-workspaces.md",
    ].join("\n"),
  );

  return root;
}

describe("public clean clone smoke", () => {
  it("stages only public-safe client folders", async () => {
    const sourceRoot = await createFixtureRepo();
    const publicRoot = await mkdtemp(path.join(tmpdir(), "workshop-public-clone-out-"));

    stagePublicClone({ sourceRoot, destinationRoot: publicRoot });

    expect(listPublicClientDirs(publicRoot)).toEqual([...allowedPublicClientDirs].sort());
    expect(existsSync(path.join(publicRoot, "clients", privateClientId))).toBe(false);

    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(publicRoot, { recursive: true, force: true });
  });

  it("validates resource manifests and first-run docs in the staged clone", async () => {
    const sourceRoot = await createFixtureRepo();
    const publicRoot = await mkdtemp(path.join(tmpdir(), "workshop-public-clone-out-"));

    stagePublicClone({ sourceRoot, destinationRoot: publicRoot });
    const validation = validatePublicClone(publicRoot);

    expect(validation.ok).toBe(true);
    expect(validation.blockingFindings).toEqual([]);
    expect(validateTauriResources(publicRoot).violations).toEqual([]);
    expect(validateReadme(publicRoot)).toEqual([]);

    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(publicRoot, { recursive: true, force: true });
  });

  it("fails validation when a bundled Tauri resource points at the client root", async () => {
    const sourceRoot = await createFixtureRepo();
    const publicRoot = await mkdtemp(path.join(tmpdir(), "workshop-public-clone-out-"));

    stagePublicClone({ sourceRoot, destinationRoot: publicRoot });
    writeJson(path.join(publicRoot, "apps/marketing-builds-desktop/src-tauri/tauri.conf.json"), {
      bundle: { resources: ["../../../clients"] },
    });

    const validation = validatePublicClone(publicRoot);

    expect(validation.ok).toBe(false);
    expect(validation.resourceCheck.violations).toEqual([
      "Tauri resource bundles a client root: ../../../clients",
    ]);

    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(publicRoot, { recursive: true, force: true });
  });

  it("disables updater artifacts only in the staged public build config", async () => {
    const sourceRoot = await createFixtureRepo();
    const publicRoot = await mkdtemp(path.join(tmpdir(), "workshop-public-clone-out-"));

    stagePublicClone({ sourceRoot, destinationRoot: publicRoot });
    const configPath = disableUpdaterArtifactsForPublicBuild(publicRoot);

    expect(JSON.parse(readFileSync(configPath, "utf8")).bundle.createUpdaterArtifacts).toBe(false);
    expect(
      JSON.parse(
        readFileSync(
          path.join(sourceRoot, "apps/marketing-builds-desktop/src-tauri/tauri.conf.json"),
          "utf8",
        ),
      ).bundle.createUpdaterArtifacts,
    ).toBeUndefined();

    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(publicRoot, { recursive: true, force: true });
  });

  it("documents the full install, test, e2e, and package command plan", async () => {
    const sourceRoot = await createFixtureRepo();
    const publicRoot = await mkdtemp(path.join(tmpdir(), "workshop-public-clone-out-"));
    const result = runPublicCleanCloneSmoke({
      root: sourceRoot,
      destinationRoot: publicRoot,
      runCommands: false,
    });

    expect(result.status).toBe("passed");
    expect(result.commandsExecuted).toBe(false);
    expect(result.commandPlan).toEqual([
      "npm ci",
      "npm test",
      "npm run build",
      "npm run test:e2e --workspace @marketing-builds/desktop",
      "npm run desktop:tauri -- build",
    ]);
    expect(
      JSON.parse(readFileSync(path.join(publicRoot, "workshop-public-clone-smoke.json"), "utf8"))
        .status,
    ).toBe("passed");

    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(publicRoot, { recursive: true, force: true });
  });
});
