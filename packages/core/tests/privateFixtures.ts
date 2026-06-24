import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(testDir, "../../..");
export const privateParasailDir = path.join(repoRoot, "clients/parasail");
export const hasPrivateParasailFixtures = existsSync(
  path.join(privateParasailDir, "client.yaml"),
);

export const privateFixtureIt = hasPrivateParasailFixtures ? it : it.skip;
export const privateFixtureDescribe = hasPrivateParasailFixtures ? describe : describe.skip;
