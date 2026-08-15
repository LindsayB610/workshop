import { readFileSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import {
  normalizePublicReleaseVersion,
  parseArgs,
  preparePublicRelease,
  sha256,
} from "./prepare-public-release.mjs";

describe("prepare public Workshop release", () => {
  it("creates a stable Apple Silicon download and matching checksum from a notarized DMG", async () => {
    const root = await mkdtemp(join(tmpdir(), "workshop-public-release-"));
    const source = join(root, "Workshop_0.2.0_aarch64.dmg");
    const output = join(root, "public");
    writeFileSync(source, "notarized workshop bytes");

    const release = preparePublicRelease({
      dmgPath: source,
      version: "v0.2.0",
      outputDir: output,
      readFile: readFileSync,
      copyFile: (from, to) => writeFileSync(to, readFileSync(from)),
      makeDir: mkdirSync,
      writeFile: writeFileSync,
    });

    expect(release.version).toBe("0.2.0");
    expect(readFileSync(release.dmgPath, "utf8")).toBe("notarized workshop bytes");
    expect(readFileSync(release.checksumPath, "utf8")).toBe(
      `${sha256(Buffer.from("notarized workshop bytes"))}  Workshop-aarch64.dmg\n`,
    );
  });

  it("refuses an invalid version or a missing source DMG", () => {
    expect(() => normalizePublicReleaseVersion("not-a-version")).toThrow("Expected a plain semver");
    expect(() =>
      preparePublicRelease({
        dmgPath: join(tmpdir(), "missing-workshop.dmg"),
        version: "0.2.0",
        outputDir: tmpdir(),
        readFile: readFileSync,
        copyFile: () => undefined,
        makeDir: () => undefined,
        writeFile: () => undefined,
      }),
    ).toThrow("Required notarized DMG does not exist");
  });

  it("accepts only complete named command-line arguments", () => {
    expect(
      parseArgs(["--dmg", "Workshop.dmg", "--version", "0.2.0", "--output-dir", "release"]),
    ).toEqual({ dmg: "Workshop.dmg", version: "0.2.0", "output-dir": "release" });
    expect(() => parseArgs(["Workshop.dmg"])).toThrow("Unexpected positional argument");
    expect(() => parseArgs(["--dmg"])).toThrow("Missing value for --dmg");
  });
});
