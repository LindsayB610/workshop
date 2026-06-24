import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const defaultInventoryPath = path.join(repoRoot, "docs/data-boundary-inventory.json");

const defaultIgnoredDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "target",
  ".turbo",
  ".vite",
  "coverage",
]);

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function loadInventory(inventoryPath = defaultInventoryPath) {
  return JSON.parse(readFileSync(inventoryPath, "utf8"));
}

function normalizeEntryPath(entryPath) {
  return entryPath.replace(/^\.\/+/, "").replace(/\/+$/g, "");
}

export function classifyPath(relativePath, inventory) {
  const normalized = normalizeEntryPath(relativePath);
  const matches = inventory.classifications
    .map((entry) => ({
      ...entry,
      path: normalizeEntryPath(entry.path),
    }))
    .filter((entry) => normalized === entry.path || normalized.startsWith(`${entry.path}/`))
    .sort((left, right) => right.path.length - left.path.length);

  return matches[0] ?? null;
}

function shouldIgnoreDir(name) {
  return defaultIgnoredDirs.has(name);
}

export function listRepositoryFiles(root = repoRoot) {
  const files = [];

  function visit(currentDir) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.isDirectory() && shouldIgnoreDir(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = toPosixPath(path.relative(root, fullPath));

      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  visit(root);
  return files.sort();
}

function readTextFile(root, relativePath) {
  const fullPath = path.join(root, relativePath);
  const stats = statSync(fullPath);

  if (stats.size > 1_000_000) {
    return "";
  }

  try {
    return readFileSync(fullPath, "utf8");
  } catch {
    return "";
  }
}

function findingStatus(classification) {
  if (!classification) {
    return "unreviewed";
  }

  if (classification.classification === "private-excluded") {
    return "reviewed-private-excluded";
  }

  if (classification.publicSafe === false) {
    return "reviewed-not-public-safe";
  }

  return "reviewed";
}

function addFinding(findings, finding) {
  findings.push({
    ...finding,
    status: finding.status ?? findingStatus(finding.classification),
  });
}

function scanTerms({ root, files, inventory, findings }) {
  const termRules = inventory.blockedTerms.filter((rule) => rule.pattern);

  for (const relativePath of files) {
    const text = readTextFile(root, relativePath);
    if (!text) {
      continue;
    }

    const classification = classifyPath(relativePath, inventory);

    for (const rule of termRules) {
      const regex = new RegExp(rule.pattern, "gi");
      const matches = text.match(regex);

      if (!matches?.length) {
        continue;
      }

      const allowedTerms = new Set(classification?.allowedTerms ?? []);
      const uniqueMatches = [...new Set(matches)].filter((match) => !allowedTerms.has(match));

      if (!uniqueMatches.length) {
        continue;
      }

      addFinding(findings, {
        type: "blocked-term",
        ruleId: rule.id,
        severity: rule.severity,
        path: relativePath,
        matches: uniqueMatches.slice(0, 8),
        classification,
        reason: rule.reason,
      });
    }
  }
}

function scanPathRules({ files, inventory, findings }) {
  const pathRules = inventory.blockedTerms.filter((rule) => rule.pathPattern);

  for (const relativePath of files) {
    const classification = classifyPath(relativePath, inventory);

    for (const rule of pathRules) {
      const regex = new RegExp(rule.pathPattern);
      if (!regex.test(relativePath)) {
        continue;
      }

      addFinding(findings, {
        type: "blocked-path",
        ruleId: rule.id,
        severity: rule.severity,
        path: relativePath,
        classification,
        reason: rule.reason,
      });
    }
  }
}

function scanClientFolders({ root, inventory, findings }) {
  const clientsRoot = path.join(root, "clients");
  if (!existsSync(clientsRoot)) {
    return;
  }

  for (const entry of readdirSync(clientsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const relativePath = `clients/${entry.name}`;
    const classification = classifyPath(relativePath, inventory);

    if (!classification) {
      addFinding(findings, {
        type: "unclassified-client-folder",
        severity: "classification-required",
        path: relativePath,
        classification,
        reason: "Every checked-in client-like folder must be classified as demo, template, or private-excluded.",
      });
    }
  }
}

function tauriResources(config) {
  return config.bundle?.resources ?? [];
}

function scanTauriResources({ root, inventory, findings }) {
  const tauriConfigPath = "apps/marketing-builds-desktop/src-tauri/tauri.conf.json";
  const fullPath = path.join(root, tauriConfigPath);
  if (!existsSync(fullPath)) {
    return;
  }

  const config = JSON.parse(readFileSync(fullPath, "utf8"));
  const classification = classifyPath(tauriConfigPath, inventory);

  for (const resource of tauriResources(config)) {
    const normalizedResource = toPosixPath(resource);
    if (/(^|\/)\.\.\/\.\.\/\.\.\/clients$|clients$/.test(normalizedResource)) {
      addFinding(findings, {
        type: "tauri-private-resource",
        severity: "bundle-private-client-root",
        path: tauriConfigPath,
        resource: normalizedResource,
        classification,
        status: "reviewed-not-public-safe",
        reason: "Tauri currently bundles the client root, including private client context.",
      });
    }
  }
}

function summarize(findings) {
  const byStatus = findings.reduce((counts, finding) => {
    counts[finding.status] = (counts[finding.status] ?? 0) + 1;
    return counts;
  }, {});

  const bySeverity = findings.reduce((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
    return counts;
  }, {});

  return {
    totalFindings: findings.length,
    byStatus,
    bySeverity,
  };
}

export function auditPublicBoundary(options = {}) {
  const root = options.root ? path.resolve(options.root) : repoRoot;
  const inventoryPath = options.inventoryPath
    ? path.resolve(options.inventoryPath)
    : path.join(root, "docs/data-boundary-inventory.json");
  const inventory = options.inventory ?? loadInventory(inventoryPath);
  const files = options.files ?? listRepositoryFiles(root);
  const findings = [];

  scanTerms({ root, files, inventory, findings });
  scanPathRules({ files, inventory, findings });
  scanClientFolders({ root, inventory, findings });
  scanTauriResources({ root, inventory, findings });

  return {
    inventoryStatus: inventory.status,
    filesScanned: files.length,
    findings,
    summary: summarize(findings),
  };
}

export function parseArgs(argv) {
  const options = {
    strict: false,
    json: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--root") {
      options.root = argv[index + 1];
      index += 1;
    } else if (arg === "--inventory") {
      options.inventoryPath = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

function hasBlockingFindings(result) {
  return result.findings.some((finding) =>
    ["unreviewed", "reviewed-not-public-safe"].includes(finding.status),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  const result = auditPublicBoundary(options);
  console.log(JSON.stringify(result, null, 2));

  if (options.strict && hasBlockingFindings(result)) {
    process.exitCode = 1;
  }
}
