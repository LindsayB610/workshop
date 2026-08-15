import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";

const releaseVersionPattern = /^v?(\d+)\.(\d+)\.(\d+)$/i;
const publicDmgName = "Workshop-aarch64.dmg";

export function normalizePublicReleaseVersion(value) {
  const match = value?.trim().match(releaseVersionPattern);

  if (!match) {
    throw new Error(`Expected a plain semver version like 0.2.0, received "${value ?? ""}".`);
  }

  return `${match[1]}.${match[2]}.${match[3]}`;
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function preparePublicRelease({ dmgPath, version, outputDir, readFile, copyFile, makeDir, writeFile }) {
  const normalizedVersion = normalizePublicReleaseVersion(version);

  if (!existsSync(dmgPath)) {
    throw new Error(`Required notarized DMG does not exist: ${dmgPath}`);
  }

  makeDir(outputDir, { recursive: true });
  const publicDmgPath = resolve(outputDir, publicDmgName);
  const checksumPath = resolve(outputDir, `${publicDmgName}.sha256`);

  copyFile(dmgPath, publicDmgPath);
  const checksum = sha256(readFile(publicDmgPath));
  writeFile(
    checksumPath,
    `${checksum}  ${publicDmgName}\n`,
    "utf8",
  );

  return {
    version: normalizedVersion,
    source: basename(dmgPath),
    dmgPath: publicDmgPath,
    checksumPath,
    checksum,
  };
}

export function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${argument}`);
    }

    const key = argument.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

const isCli = process.argv[1]?.endsWith("prepare-public-release.mjs") ?? false;

if (isCli) {
  try {
    const options = parseArgs(process.argv.slice(2));

    for (const required of ["dmg", "version", "output-dir"]) {
      if (!options[required]) {
        throw new Error(`Missing required option --${required}`);
      }
    }

    const release = preparePublicRelease({
      dmgPath: resolve(options.dmg),
      version: options.version,
      outputDir: resolve(options["output-dir"]),
      readFile: readFileSync,
      copyFile: copyFileSync,
      makeDir: mkdirSync,
      writeFile: writeFileSync,
    });

    console.log(JSON.stringify(release));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
