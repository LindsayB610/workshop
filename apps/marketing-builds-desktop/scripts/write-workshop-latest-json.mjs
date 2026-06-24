import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

export function buildLatestJson(options) {
  const required = [
    "version",
    "platform",
    "artifact",
    "signature-file",
    "app-bundle",
    "dmg",
    "base-url",
  ];
  const missing = required.filter((key) => !options[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required option(s): ${missing.map((key) => `--${key}`).join(", ")}`);
  }

  const artifactPath = resolve(options.artifact);
  const signaturePath = resolve(options["signature-file"]);
  const appBundlePath = resolve(options["app-bundle"]);
  const dmgPath = resolve(options.dmg);

  for (const path of [artifactPath, signaturePath, appBundlePath, dmgPath]) {
    if (!existsSync(path)) {
      throw new Error(`Required release artifact does not exist: ${path}`);
    }
  }

  const signature = readFileSync(signaturePath, "utf8").trim();

  if (!signature) {
    throw new Error(`Signature file is empty: ${signaturePath}`);
  }

  const baseUrl = options["base-url"].replace(/\/+$/, "");
  const artifactUrl = `${baseUrl}/${basename(artifactPath)}`;

  if (!artifactUrl.startsWith("https://")) {
    throw new Error("Updater artifact URL must use HTTPS.");
  }

  return {
    version: options.version.replace(/^v/i, ""),
    notes: options.notes,
    pub_date: options["pub-date"] ?? new Date().toISOString(),
    platforms: {
      [options.platform]: {
        signature,
        url: artifactUrl,
      },
    },
  };
}

export function writeLatestJson(options) {
  const outputPath = resolve(options.output ?? "latest.json");
  const latestJson = buildLatestJson(options);
  writeFileSync(outputPath, `${JSON.stringify(latestJson, null, 2)}\n`);
  return outputPath;
}

function printUsage() {
  console.log(`Usage:
node scripts/write-workshop-latest-json.mjs \\
  --version 0.2.0 \\
  --platform darwin-aarch64 \\
  --artifact src-tauri/target/release/bundle/macos/Workshop.app.tar.gz \\
  --signature-file src-tauri/target/release/bundle/macos/Workshop.app.tar.gz.sig \\
  --app-bundle src-tauri/target/release/bundle/macos/Workshop.app \\
  --dmg src-tauri/target/release/bundle/dmg/Workshop_0.2.0_aarch64.dmg \\
  --base-url https://updates.lindsaybrunner.com/workshop \\
  --output dist/latest.json`);
}

const isCli = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;

if (isCli) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const outputPath = writeLatestJson(options);
    console.log(`Wrote ${outputPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exitCode = 1;
  }
}
