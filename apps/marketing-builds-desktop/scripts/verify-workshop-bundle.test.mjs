import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { verifyWorkshopBundle } from "./verify-workshop-bundle.mjs";

async function runBundleCheck(files) {
  const root = await mkdtemp(path.join(tmpdir(), "workshop-bundle-check-"));
  const assets = path.join(root, "dist/assets");
  await mkdir(assets, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    await writeFile(path.join(assets, name), Buffer.alloc(bytes));
  }
  return { root, assets };
}

describe("Workshop bundle budget", () => {
  it("requires deferred plugin chunks and keeps the initial shell under budget", async () => {
    const fixture = await runBundleCheck({
      "index-demo.js": 499_999,
      "plugin-pulse-demo.js": 1,
      "plugin-slate-demo.js": 1,
    });
    expect(verifyWorkshopBundle(fixture.assets)).toEqual({ shellBytes: 499_999, maxShellBytes: 500_000 });
    await rm(fixture.root, { recursive: true, force: true });
  });

  it("fails when a plugin chunk or shell budget is missing", async () => {
    const fixture = await runBundleCheck({ "index-demo.js": 500_001, "plugin-pulse-demo.js": 1 });
    expect(() => verifyWorkshopBundle(fixture.assets)).toThrow("Expected one deferred Slate plugin bundle");
    await rm(fixture.root, { recursive: true, force: true });
  });

  it("fails when the initial shell exceeds its budget", async () => {
    const fixture = await runBundleCheck({
      "index-demo.js": 500_001,
      "plugin-pulse-demo.js": 1,
      "plugin-slate-demo.js": 1,
    });
    expect(() => verifyWorkshopBundle(fixture.assets)).toThrow("Initial Workshop shell is 500001 bytes");
    await rm(fixture.root, { recursive: true, force: true });
  });
});
