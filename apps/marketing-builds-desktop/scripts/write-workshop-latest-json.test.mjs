import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLatestJson, parseArgs } from "./write-workshop-latest-json.mjs";

async function createArtifacts() {
  const root = await mkdtemp(join(tmpdir(), "workshop-update-"));
  const paths = {
    app: join(root, "Workshop.app"),
    artifact: join(root, "Workshop.app.tar.gz"),
    dmg: join(root, "Workshop_0.2.0_aarch64.dmg"),
    sig: join(root, "Workshop.app.tar.gz.sig"),
  };

  mkdirSync(paths.app);
  writeFileSync(paths.artifact, "archive");
  writeFileSync(paths.dmg, "dmg");
  writeFileSync(paths.sig, "signature-value\n");

  return paths;
}

describe("write Workshop updater latest.json", () => {
  it("parses CLI options", () => {
    expect(parseArgs(["--version", "0.2.0", "--platform", "darwin-aarch64"])).toEqual({
      platform: "darwin-aarch64",
      version: "0.2.0",
    });
  });

  it("builds the static Tauri updater manifest from signed artifacts", async () => {
    const paths = await createArtifacts();

    expect(
      buildLatestJson({
        version: "v0.2.0",
        platform: "darwin-aarch64",
        artifact: paths.artifact,
        "signature-file": paths.sig,
        "app-bundle": paths.app,
        dmg: paths.dmg,
        "base-url": "https://updates.lindsaybrunner.com/workshop/",
        "pub-date": "2026-06-20T00:00:00.000Z",
        notes: "Signed updater dry run.",
      }),
    ).toEqual({
      version: "0.2.0",
      notes: "Signed updater dry run.",
      pub_date: "2026-06-20T00:00:00.000Z",
      platforms: {
        "darwin-aarch64": {
          signature: "signature-value",
          url: "https://updates.lindsaybrunner.com/workshop/Workshop.app.tar.gz",
        },
      },
    });
  });

  it("rejects insecure updater artifact URLs", async () => {
    const paths = await createArtifacts();

    expect(() =>
      buildLatestJson({
        version: "0.2.0",
        platform: "darwin-aarch64",
        artifact: paths.artifact,
        "signature-file": paths.sig,
        "app-bundle": paths.app,
        dmg: paths.dmg,
        "base-url": "http://updates.lindsaybrunner.com/workshop",
      }),
    ).toThrow("Updater artifact URL must use HTTPS.");
  });
});
