import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const semverPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export function normalizeReleaseVersion(version) {
  const normalized = version.trim().replace(/^v/i, "");

  if (!semverPattern.test(normalized)) {
    throw new Error(`Expected a semver version like 0.2.0, received "${version}".`);
  }

  return normalized;
}

export function bumpWorkshopVersion(version, paths) {
  const normalized = normalizeReleaseVersion(version);

  for (const path of [paths.packageJsonPath, paths.tauriConfigPath]) {
    const json = JSON.parse(readFileSync(path, "utf8"));
    json.version = normalized;
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  }

  if (paths.appVersionPath) {
    writeFileSync(paths.appVersionPath, `export const WORKSHOP_VERSION = "${normalized}";\n`);
  }

  if (paths.cargoTomlPath) {
    const cargoToml = readFileSync(paths.cargoTomlPath, "utf8");
    const updatedCargoToml = cargoToml.replace(
      /(^\[package\]\n(?:.+\n)*?version = )"[^"]+"/m,
      `$1"${normalized}"`,
    );

    if (updatedCargoToml === cargoToml) {
      throw new Error(`Could not find [package] version in ${paths.cargoTomlPath}.`);
    }

    writeFileSync(paths.cargoTomlPath, updatedCargoToml);
  }

  return normalized;
}

const isCli = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;

if (isCli) {
  try {
    const version = process.argv[2];

    if (!version) {
      throw new Error("Usage: node scripts/bump-workshop-version.mjs 0.2.0");
    }

    const nextVersion = bumpWorkshopVersion(version, {
      appVersionPath: resolve("src/app-shell/appVersion.ts"),
      cargoTomlPath: resolve("src-tauri/Cargo.toml"),
      packageJsonPath: resolve("package.json"),
      tauriConfigPath: resolve("src-tauri/tauri.conf.json"),
    });

    console.log(`Workshop version bumped to ${nextVersion}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
