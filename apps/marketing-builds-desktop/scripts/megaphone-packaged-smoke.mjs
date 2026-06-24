#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

export async function runMegaphonePackagedSmoke(options = {}) {
  const startedAt = new Date().toISOString();
  const appPackage = JSON.parse(
    await readFile(path.join(appRoot, "package.json"), "utf8"),
  );
  const megaphoneRoot = options.megaphoneRoot ?? findMegaphoneRoot(appRoot);
  const bridgePath =
    options.bridgePath ?? path.join(megaphoneRoot, "packages/core/dist/bridgeCli.js");
  const smokeRoot =
    options.smokeRoot ?? (await mkdtemp(path.join(os.tmpdir(), "megaphone-smoke-")));
  const displayPath = options.displayPath ?? "clients/demo-megaphone";
  const clientRoot =
    options.clientRoot ?? path.resolve(appRoot, "../..", displayPath);

  const results = {
    appVersion: appPackage.version,
    startedAt,
    megaphoneRoot,
    smokeRoot,
    checks: [],
    generatedFiles: [],
  };

  try {
    assertBridgeExists(bridgePath);
    results.checks.push({ name: "bridge_present", status: "passed", bridgePath });

    const load = callBridge(bridgePath, {
      command: "load",
      clientRoot,
      displayPath,
    });
    assertEqual(load.clientId, "demo-megaphone", "load client id");
    assertNumberAtLeast(load.sourceCount, 1, "load source count");
    results.checks.push({
      name: "load_client_folder",
      status: "passed",
      sourceCount: load.sourceCount,
      artifactCount: load.artifactPaths.length,
    });

    const deterministic = callBridge(bridgePath, {
      command: "createPostPackage",
      clientRoot,
      displayPath,
      clientId: "demo-megaphone",
      topic: "public endpoint vs private endpoint smoke test",
      audience: ["founder", "CTO"],
      buyerProblem:
        "Teams need to know when public inference endpoints stop fitting production workload promises.",
      postType: "visual_explainer",
      allowAdjacentExamples: false,
      proofRisk: "medium",
      contentPillar: "operational_control",
    });
    const deterministicFiles = await writeSmokeFiles(smokeRoot, deterministic);
    results.generatedFiles.push(...deterministicFiles);
    results.checks.push({
      name: "create_deterministic_package",
      status: "passed",
      packageRoot: deterministic.packageRoot,
      fileCount: deterministic.files.length,
    });

    const opened = deterministicFiles.find((file) => file.endsWith("/brief.md"));
    if (!opened) {
      throw new Error("Smoke package did not include brief.md to open.");
    }
    await readFile(opened, "utf8");
    results.checks.push({ name: "open_generated_artifact", status: "passed", path: opened });

    const onboardingFile = path.join(
      smokeRoot,
      "clients/demo-influencer/onboarding/workshop-export-transcript.md",
    );
    await mkdir(path.dirname(onboardingFile), { recursive: true });
    await writeFile(onboardingFile, "# Workshop Export Transcript\n");
    results.generatedFiles.push(onboardingFile);
    results.checks.push({
      name: "export_onboarding_packet",
      status: "passed",
      path: onboardingFile,
    });

    const aiStatus = callBridge(bridgePath, {
      command: "testAiConnection",
      clientRoot,
      model: "gpt-5-mini",
    });
    if (!["available", "missing_credentials"].includes(aiStatus.availability)) {
      throw new Error(`Unexpected AI status: ${aiStatus.availability}`);
    }
    results.checks.push({
      name: "test_ai_connection_status",
      status: "passed",
      availability: aiStatus.availability,
      model: aiStatus.model,
    });

    const aiPackage = callBridge(bridgePath, {
      command: "createPostPackage",
      clientRoot,
      displayPath,
      clientId: "demo-megaphone",
      topic: "public endpoint vs private endpoint ai smoke test",
      audience: ["founder", "CTO"],
      buyerProblem:
        "Teams need to know when public inference endpoints stop fitting production workload promises.",
      postType: "visual_explainer",
      allowAdjacentExamples: false,
      proofRisk: "medium",
      contentPillar: "operational_control",
      aiDrafting: true,
      model: "gpt-5-mini",
    });
    const aiFiles = await writeSmokeFiles(smokeRoot, aiPackage);
    results.generatedFiles.push(...aiFiles);
    results.checks.push({
      name: "create_ai_package_or_fallback",
      status: "passed",
      packageRoot: aiPackage.packageRoot,
      fileCount: aiPackage.files.length,
      mode: aiPackage.files
        .find((file) => file.path.endsWith("ai-generation.md"))
        ?.contents.includes("Mode: fallback")
        ? "fallback"
        : "ai",
    });

    await assertFailureModes({ bridgePath, clientRoot, displayPath, smokeRoot, results });

    results.completedAt = new Date().toISOString();
    results.status = "passed";
    return results;
  } catch (error) {
    results.completedAt = new Date().toISOString();
    results.status = "failed";
    results.error = error instanceof Error ? error.message : String(error);
    throw Object.assign(new Error(results.error), { smokeResults: results });
  } finally {
    if (options.cleanup !== false && !options.smokeRoot) {
      await rm(smokeRoot, { recursive: true, force: true });
    }
  }
}

function assertBridgeExists(bridgePath) {
  if (!existsSync(bridgePath)) {
    throw new Error(`Megaphone bridge is missing at ${bridgePath}. Run npm run build in megaphone.`);
  }
}

function callBridge(bridgePath, request) {
  const result = spawnSync(process.execPath, [bridgePath], {
    input: JSON.stringify(request),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = result.stdout.trim();
  if (!stdout) {
    throw new Error(`Megaphone bridge returned no output for ${request.command}.`);
  }

  const envelope = JSON.parse(stdout);
  if (!envelope.ok) {
    throw new Error(envelope.error ?? `Megaphone bridge failed for ${request.command}.`);
  }

  return envelope.data;
}

async function writeSmokeFiles(smokeRoot, postPackage) {
  const written = [];
  for (const file of postPackage.files) {
    const relative = normalizeSmokePath(file.path, postPackage.clientId);
    const fullPath = path.join(smokeRoot, relative);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.contents);
    written.push(fullPath);
  }
  return written;
}

export function normalizeSmokePath(filePath, clientId) {
  if (
    path.isAbsolute(filePath) ||
    filePath.includes("..") ||
    !filePath.startsWith(`clients/${clientId}/post-packages/`) ||
    !/\.(md|json)$/.test(filePath)
  ) {
    throw new Error(`Unsafe Megaphone smoke file path: ${filePath}`);
  }
  return filePath;
}

async function assertFailureModes({ bridgePath, clientRoot, displayPath, smokeRoot, results }) {
  const missingWorkspace = spawnSync(process.execPath, [bridgePath], {
    input: JSON.stringify({
      command: "load",
      clientRoot: path.join(smokeRoot, "missing-workspace"),
      displayPath: "clients/missing",
    }),
    encoding: "utf8",
  });
  const missingWorkspaceEnvelope = JSON.parse(missingWorkspace.stdout.trim());
  if (
    missingWorkspaceEnvelope.ok ||
    !String(missingWorkspaceEnvelope.error).includes("client.yaml")
  ) {
    throw new Error("Missing workspace failure mode was not captured.");
  }
  results.checks.push({ name: "missing_workspace_failure", status: "passed" });

  try {
    normalizeSmokePath("clients/demo-megaphone/sources/source.md", "demo-megaphone");
    throw new Error("Unsafe generated path was accepted.");
  } catch (error) {
    if (!String(error.message).includes("Unsafe Megaphone smoke file path")) {
      throw error;
    }
  }
  results.checks.push({ name: "bad_generated_path_failure", status: "passed" });

  const blockedFilePath = path.join(
    smokeRoot,
    "clients/demo-megaphone/post-packages/blocked-write/brief.md",
  );
  await mkdir(blockedFilePath, { recursive: true });
  try {
    await writeSmokeFiles(smokeRoot, {
      clientId: "demo-megaphone",
      files: [
        {
          path: "clients/demo-megaphone/post-packages/blocked-write/brief.md",
          contents: "blocked",
        },
      ],
    });
    throw new Error("Blocked write failure mode was not captured.");
  } catch (error) {
    if (!["EISDIR", "EPERM", "EACCES"].some((code) => String(error.message).includes(code))) {
      throw error;
    }
  }
  results.checks.push({ name: "denied_or_blocked_write_failure", status: "passed" });

  const badClient = spawnSync(process.execPath, [bridgePath], {
    input: JSON.stringify({
      command: "createPostPackage",
      clientRoot,
      displayPath,
      clientId: "demo-megaphone",
      topic: "bad post type",
      audience: ["founder"],
      buyerProblem: "Bad post type should fail.",
      postType: "not_a_post_type",
      proofRisk: "medium",
    }),
    encoding: "utf8",
  });
  const envelope = JSON.parse(badClient.stdout.trim());
  if (envelope.ok || !String(envelope.error).includes("Invalid enum value")) {
    throw new Error("Bad post type failure mode was not captured.");
  }
  results.checks.push({ name: "bad_input_failure", status: "passed" });
}

export function findMegaphoneRoot(start) {
  let current = path.resolve(start);
  while (current !== path.dirname(current)) {
    const sibling = path.join(path.dirname(current), "megaphone");
    if (sibling !== current && existsSync(path.join(sibling, "package.json"))) {
      return sibling;
    }
    current = path.dirname(current);
  }
  throw new Error("Could not find sibling megaphone repo.");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, received ${actual}.`);
  }
}

function assertNumberAtLeast(actual, minimum, label) {
  if (typeof actual !== "number" || actual < minimum) {
    throw new Error(`${label} expected at least ${minimum}, received ${actual}.`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMegaphonePackagedSmoke({ cleanup: false })
    .then((results) => {
      process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${JSON.stringify(error.smokeResults ?? { status: "failed", error: error.message }, null, 2)}\n`);
      process.exitCode = 1;
    });
}
