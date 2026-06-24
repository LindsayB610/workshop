import { describe, expect, it } from "vitest";
import {
  compareReleaseVersions,
  formatReleaseVersion,
  nextPatchVersion,
  parseArgs,
  parseReleaseVersion,
  resolveWorkshopReleaseVersion,
} from "./resolve-workshop-release-version.mjs";

describe("resolve Workshop release version", () => {
  it("increments the live manifest patch version by default", () => {
    expect(resolveWorkshopReleaseVersion({ manifestVersion: "0.1.9" })).toBe("0.1.10");
  });

  it("accepts a manual override only when it is newer than the live manifest", () => {
    expect(
      resolveWorkshopReleaseVersion({
        manifestVersion: "0.1.9",
        overrideVersion: "0.2.0",
      }),
    ).toBe("0.2.0");

    expect(() =>
      resolveWorkshopReleaseVersion({
        manifestVersion: "0.1.9",
        overrideVersion: "0.1.6",
      }),
    ).toThrow("must be greater than the currently published version 0.1.9");
  });

  it("compares version segments numerically", () => {
    expect(compareReleaseVersions(parseReleaseVersion("0.1.10"), parseReleaseVersion("0.1.9"))).toBe(
      1,
    );
    expect(compareReleaseVersions(parseReleaseVersion("0.2.0"), parseReleaseVersion("0.10.0"))).toBe(
      -1,
    );
  });

  it("keeps release versions plain and patch-incrementable", () => {
    expect(formatReleaseVersion(nextPatchVersion(parseReleaseVersion("v1.2.9")))).toBe("1.2.10");
    expect(() => parseReleaseVersion("0.2.0-beta.1")).toThrow("Expected a plain semver version");
  });

  it("parses CLI arguments", () => {
    expect(
      parseArgs([
        "--manifest-url",
        "https://updates.example.com/latest.json",
        "--override",
        "0.2.0",
      ]),
    ).toEqual({
      "manifest-url": "https://updates.example.com/latest.json",
      override: "0.2.0",
    });
  });
});
