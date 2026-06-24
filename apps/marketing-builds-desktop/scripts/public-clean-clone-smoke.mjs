import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditPublicBoundary, loadInventory } from "./public-boundary-scan.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "../../..");

export const allowedPublicClientDirs = new Set([
  "demo-redline",
  "demo-megaphone",
  "fixture",
  "template-redline",
  "template-megaphone",
]);

const excludedTopLevelDirs = new Set([
  ".git",
  "node_modules",
  "reference",
  "workshop-private",
  "coverage",
]);

const excludedDirNames = new Set([
  "node_modules",
  "dist",
  "target",
  "coverage",
  "playwright-report",
  "test-results",
  ".vite",
]);

const requiredReadmeSnippets = [
  "npm install",
  "npm test",
  "npm run test:public",
  "npm run desktop:dev",
  "npm run desktop:tauri -- build",
  "Workshop opens with fictional demo data",
  "Redline",
  "Megaphone",
  "docs/private-workspaces.md",
];

const defaultCommandPlan = [
  ["npm", ["ci"]],
  ["npm", ["test"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "test:e2e", "--workspace", "@marketing-builds/desktop"]],
  ["npm", ["run", "desktop:tauri", "--", "build"]],
];

export function toPosix(value) {
  return value.split(path.sep).join("/");
}

function shouldExclude(relativePath, entryName) {
  const posix = toPosix(relativePath);
  const firstPart = posix.split("/")[0];

  if (excludedTopLevelDirs.has(firstPart) || excludedDirNames.has(entryName)) {
    return true;
  }

  if (posix.startsWith("clients/")) {
    const clientDir = posix.split("/")[1];
    return !allowedPublicClientDirs.has(clientDir);
  }

  return false;
}

export function stagePublicClone({
  sourceRoot = repoRoot,
  destinationRoot = mkdtempSync(path.join(tmpdir(), "workshop-public-clone-")),
} = {}) {
  mkdirSync(destinationRoot, { recursive: true });

  function copyDirectory(currentSource, currentDestination) {
    mkdirSync(currentDestination, { recursive: true });

    for (const entry of cpEntries(currentSource)) {
      const sourcePath = path.join(currentSource, entry.name);
      const relativePath = path.relative(sourceRoot, sourcePath);
      if (entry.isDirectory() && shouldExclude(relativePath, entry.name)) {
        continue;
      }
      if (entry.isFile() && shouldExclude(relativePath, entry.name)) {
        continue;
      }

      const destinationPath = path.join(currentDestination, entry.name);
      if (entry.isDirectory()) {
        copyDirectory(sourcePath, destinationPath);
      } else if (entry.isFile()) {
        cpSync(sourcePath, destinationPath);
      }
    }
  }

  copyDirectory(sourceRoot, destinationRoot);
  return destinationRoot;
}

function cpEntries(directory) {
  return Array.from(readdirSync(directory, { withFileTypes: true }));
}

export function listPublicClientDirs(root) {
  const clientsRoot = path.join(root, "clients");
  if (!existsSync(clientsRoot)) {
    return [];
  }

  return readdirSync(clientsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function validateTauriResources(root) {
  const configPath = path.join(root, "apps/marketing-builds-desktop/src-tauri/tauri.conf.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const resources = config.bundle?.resources ?? [];
  const violations = [];

  for (const resource of resources) {
    const normalized = toPosix(resource);
    if (normalized.endsWith("/clients") || normalized === "clients") {
      violations.push(`Tauri resource bundles a client root: ${resource}`);
      continue;
    }

    const resourceName = normalized.split("/").at(-1);
    if (!allowedPublicClientDirs.has(resourceName)) {
      violations.push(`Tauri resource is not a public demo/template folder: ${resource}`);
    }

    const fullPath = path.resolve(path.dirname(configPath), resource);
    if (!existsSync(fullPath)) {
      violations.push(`Tauri resource does not exist in public clone: ${resource}`);
    }
  }

  return { resources, violations };
}

export function disableUpdaterArtifactsForPublicBuild(root) {
  const configPath = path.join(root, "apps/marketing-builds-desktop/src-tauri/tauri.conf.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.bundle = {
    ...(config.bundle ?? {}),
    createUpdaterArtifacts: false,
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}

export function validateReadme(root) {
  const readme = readFileSync(path.join(root, "README.md"), "utf8");
  return requiredReadmeSnippets.filter((snippet) => !readme.includes(snippet));
}

export function validatePublicClone(root) {
  const inventory = loadInventory(path.join(root, "docs/data-boundary-inventory.json"));
  const boundary = auditPublicBoundary({ root, inventory });
  const clientDirs = listPublicClientDirs(root);
  const disallowedClients = clientDirs.filter((clientDir) => !allowedPublicClientDirs.has(clientDir));
  const resourceCheck = validateTauriResources(root);
  const missingReadmeSnippets = validateReadme(root);
  const blockingFindings = boundary.findings.filter((finding) =>
    ["unreviewed", "reviewed-not-public-safe", "reviewed-private-excluded"].includes(
      finding.status,
    ),
  );

  return {
    root,
    clientDirs,
    boundarySummary: boundary.summary,
    blockingFindings,
    disallowedClients,
    resourceCheck,
    missingReadmeSnippets,
    ok:
      blockingFindings.length === 0 &&
      disallowedClients.length === 0 &&
      resourceCheck.violations.length === 0 &&
      missingReadmeSnippets.length === 0,
  };
}

function runCommand(root, command, args, options = {}) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: options.verbose ? "inherit" : "pipe",
    env: process.env,
    encoding: "utf8",
  });

  return {
    command: [command, ...args].join(" "),
    startedAt,
    status: result.status ?? 1,
    stdout: result.stdout?.slice(-4000) ?? "",
    stderr: result.stderr?.slice(-4000) ?? "",
  };
}

export function runCommandPlan(root, options = {}) {
  const commands = options.commands ?? defaultCommandPlan;
  const results = [];
  let publicBuildConfigPath;

  for (const [command, args] of commands) {
    const commandText = [command, ...args].join(" ");
    if (options.disableUpdaterArtifactsBeforePackage && commandText === "npm run desktop:tauri -- build") {
      publicBuildConfigPath = disableUpdaterArtifactsForPublicBuild(root);
    }
    const result = runCommand(root, command, args, options);
    results.push(result);
    if (result.status !== 0) {
      break;
    }
  }

  return { results, publicBuildConfigPath };
}

export function parseArgs(argv) {
  const options = {
    keep: false,
    runCommands: false,
    verbose: false,
    root: repoRoot,
    destinationRoot: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--keep") {
      options.keep = true;
    } else if (arg === "--run-commands") {
      options.runCommands = true;
    } else if (arg === "--verbose") {
      options.verbose = true;
    } else if (arg === "--root") {
      options.root = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--out") {
      options.destinationRoot = path.resolve(argv[index + 1]);
      options.keep = true;
      index += 1;
    }
  }

  return options;
}

export function runPublicCleanCloneSmoke(options = {}) {
  const publicRoot = stagePublicClone({
    sourceRoot: options.root ?? repoRoot,
    destinationRoot: options.destinationRoot,
  });
  const validation = validatePublicClone(publicRoot);
  const commandRun = options.runCommands
    ? runCommandPlan(publicRoot, {
        verbose: options.verbose,
        disableUpdaterArtifactsBeforePackage: true,
      })
    : { results: [], publicBuildConfigPath: undefined };
  const commandResults = commandRun.results;
  const commandFailure = commandResults.find((result) => result.status !== 0);
  const ok = validation.ok && !commandFailure;
  const result = {
    status: ok ? "passed" : "failed",
    publicRoot,
    validation,
    publicBuildConfigPath: commandRun.publicBuildConfigPath,
    commandResults,
    commandPlan: defaultCommandPlan.map(([command, args]) => [command, ...args].join(" ")),
    commandsExecuted: options.runCommands,
  };

  writeFileSync(
    path.join(publicRoot, "workshop-public-clone-smoke.json"),
    JSON.stringify(result, null, 2),
  );

  if (!options.keep && !options.destinationRoot) {
    rmSync(publicRoot, { recursive: true, force: true });
  }

  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  const result = runPublicCleanCloneSmoke(options);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}
