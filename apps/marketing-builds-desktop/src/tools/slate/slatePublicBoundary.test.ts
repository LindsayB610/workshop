import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const personalLocalPath = `/${["Users", "lindsaybrunner"].join("/")}`;
const prohibitedSourceFragment = ["GUPPI", "guppi-state"].join("/");
const textExtensions = new Set([".json", ".md", ".ts", ".tsx"]);

function filesBelow(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    return statSync(fullPath).isDirectory() ? filesBelow(fullPath) : [fullPath];
  });
}

describe("Slate public boundary", () => {
  it("keeps every checked-in Slate text file free of personal local paths", () => {
    const slateRoot = fileURLToPath(new URL("./", import.meta.url));
    const publicSlateDocs = path.resolve(slateRoot, "../../../public/docs/tools/slate.md");
    for (const filePath of [...filesBelow(slateRoot), publicSlateDocs].filter((candidate) => textExtensions.has(path.extname(candidate)))) {
      const contents = readFileSync(filePath, "utf8");
      expect(contents, filePath).not.toContain(personalLocalPath);
      expect(contents, filePath).not.toContain(prohibitedSourceFragment);
    }
  });

  it("keeps screenshots, snapshots, and generated render artifacts out of Slate source", () => {
    const slateRoot = fileURLToPath(new URL("./", import.meta.url));
    const prohibitedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".snap"]);

    for (const filePath of filesBelow(slateRoot)) {
      expect(prohibitedExtensions.has(path.extname(filePath)), filePath).toBe(false);
    }
  });
});
