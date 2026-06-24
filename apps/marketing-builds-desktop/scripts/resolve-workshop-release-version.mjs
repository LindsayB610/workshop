const releaseVersionPattern = /^v?(\d+)\.(\d+)\.(\d+)$/i;

export function parseReleaseVersion(version) {
  const match = version.trim().match(releaseVersionPattern);

  if (!match) {
    throw new Error(`Expected a plain semver version like 0.2.0, received "${version}".`);
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

export function formatReleaseVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function compareReleaseVersions(left, right) {
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] > right[key]) {
      return 1;
    }

    if (left[key] < right[key]) {
      return -1;
    }
  }

  return 0;
}

export function nextPatchVersion(version) {
  return {
    ...version,
    patch: version.patch + 1,
  };
}

export function resolveWorkshopReleaseVersion({ manifestVersion, overrideVersion }) {
  if (!manifestVersion) {
    throw new Error("Could not determine the current published Workshop version.");
  }

  const currentVersion = parseReleaseVersion(manifestVersion);

  if (!overrideVersion?.trim()) {
    return formatReleaseVersion(nextPatchVersion(currentVersion));
  }

  const requestedVersion = parseReleaseVersion(overrideVersion);

  if (compareReleaseVersions(requestedVersion, currentVersion) <= 0) {
    throw new Error(
      `Release version ${formatReleaseVersion(
        requestedVersion,
      )} must be greater than the currently published version ${formatReleaseVersion(
        currentVersion,
      )}.`,
    );
  }

  return formatReleaseVersion(requestedVersion);
}

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

async function readManifestVersion(manifestUrl) {
  const response = await fetch(manifestUrl, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch ${manifestUrl}: ${response.status} ${response.statusText}`);
  }

  const manifest = await response.json();

  if (typeof manifest.version !== "string") {
    throw new Error(`Manifest at ${manifestUrl} does not include a string version.`);
  }

  return manifest.version;
}

function printUsage() {
  console.log(`Usage:
node scripts/resolve-workshop-release-version.mjs \\
  --manifest-url https://updates.example.com/latest.json \\
  [--override 0.2.0]`);
}

const isCli = process.argv[1]?.endsWith("resolve-workshop-release-version.mjs") ?? false;

if (isCli) {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (!options["manifest-url"]) {
      throw new Error("Missing required option: --manifest-url");
    }

    const manifestVersion = await readManifestVersion(options["manifest-url"]);
    console.log(
      resolveWorkshopReleaseVersion({
        manifestVersion,
        overrideVersion: options.override,
      }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exitCode = 1;
  }
}
