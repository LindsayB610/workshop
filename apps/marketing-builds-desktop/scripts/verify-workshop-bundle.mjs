import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function findSingle(files, pattern, label) {
  const matches = files.filter((file) => pattern.test(file));
  if (matches.length !== 1) {
    throw new Error(`Expected one ${label} bundle, found ${matches.length}: ${matches.join(", ") || "none"}.`);
  }
  return matches[0];
}

export function verifyWorkshopBundle(assetsDir) {
  const files = readdirSync(assetsDir);
  const shellBundle = findSingle(files, /^index-.*\.js$/, "initial Workshop shell");
  findSingle(files, /^plugin-pulse-.*\.js$/, "deferred Pulse plugin");
  findSingle(files, /^plugin-slate-.*\.js$/, "deferred Slate plugin");

  const shellBytes = statSync(path.join(assetsDir, shellBundle)).size;
  const maxShellBytes = 500_000;
  if (shellBytes > maxShellBytes) {
    throw new Error(`Initial Workshop shell is ${shellBytes} bytes; the ${maxShellBytes}-byte budget requires further code splitting.`);
  }

  return { shellBytes, maxShellBytes };
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = verifyWorkshopBundle(path.resolve(scriptDir, "../dist/assets"));
  console.log(`Workshop initial shell: ${result.shellBytes} bytes (budget: ${result.maxShellBytes}).`);
}
