import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { clientConfigSchema, sourceManifestSchema } from "@redline/core/schemas";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

const requiredDocs = [
  "docs/public-quickstart.md",
  "docs/private-workspaces.md",
  "docs/public-clean-clone-install.md",
  "docs/public-release-checklist.md",
  "docs/redline-packet-building.md",
  "docs/megaphone-corpus-building.md",
  "docs/troubleshooting-public-workspaces.md",
  "docs/contributing-tools.md",
];

function readRepoFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("public corpus-building docs", () => {
  it("keeps the required public setup docs linked from the README", () => {
    const readme = readRepoFile("README.md");

    for (const docPath of requiredDocs) {
      expect(existsSync(path.join(repoRoot, docPath)), docPath).toBe(true);
      expect(readme, docPath).toContain(docPath);
    }

    expect(readme).toContain("npm test");
    expect(readme).toContain("npm run desktop:dev");
    expect(readme).toContain("npm run public:check");
    expect(readme).toContain("npm run desktop:tauri -- build");
  });

  it("links deeper corpus-building guides from packaged tool docs", () => {
    const redlineDocs = readRepoFile("apps/marketing-builds-desktop/public/docs/tools/redline.md");
    const megaphoneDocs = readRepoFile("apps/marketing-builds-desktop/public/docs/tools/megaphone.md");

    expect(redlineDocs).toContain("docs/redline-packet-building.md");
    expect(redlineDocs).toContain("docs/public-quickstart.md");
    expect(redlineDocs).toContain("docs/private-workspaces.md");
    expect(redlineDocs).toContain("docs/troubleshooting-public-workspaces.md");
    expect(megaphoneDocs).toContain("docs/megaphone-corpus-building.md");
    expect(megaphoneDocs).toContain("docs/public-quickstart.md");
    expect(megaphoneDocs).toContain("docs/private-workspaces.md");
    expect(megaphoneDocs).toContain("docs/troubleshooting-public-workspaces.md");
  });

  it("keeps public docs free of private-client examples", () => {
    const blocked = /\bParasail\b|clients\/parasail|Brunner Creative|brunner-creative|\/Users\/lindsaybrunner/;

    for (const docPath of requiredDocs) {
      expect(readRepoFile(docPath), docPath).not.toMatch(blocked);
    }
  });

  it("keeps documented Redline templates parseable", () => {
    const client = YAML.parse(readRepoFile("clients/template-redline/client.yaml"));
    const manifest = JSON.parse(readRepoFile("clients/template-redline/source-manifest.json"));

    expect(clientConfigSchema.parse(client)).toMatchObject({
      clientId: "replace-with-client-id",
      canonicalModules: ["positioning"],
    });
    expect(sourceManifestSchema.parse(manifest)).toMatchObject({
      clientId: "replace-with-client-id",
    });
  });

  it("keeps documented Megaphone templates structurally complete", () => {
    const client = YAML.parse(readRepoFile("clients/template-megaphone/client.yaml"));
    const manifest = JSON.parse(readRepoFile("clients/template-megaphone/source-manifest.json"));

    expect(client).toMatchObject({
      clientId: "replace-with-client-id",
      clientType: "brand",
      defaultPrivacyStatus: "internal_only",
      canonicalModules: {
        icp: "canonical/icp.md",
        positioning: "canonical/positioning.md",
        buyerLanguage: "canonical/buyer-language.md",
        proofLibrary: "canonical/proof-library.md",
        objections: "canonical/objections.md",
        contentPriorities: "canonical/content-priorities.md",
      },
      linkedin: {
        strategy: "linkedin/strategy.yaml",
        postTypeTaxonomy: "linkedin/post-type-taxonomy.yaml",
      },
    });
    expect(manifest).toMatchObject({
      clientId: "replace-with-client-id",
      readiness: "needs_input",
      linkedinResearch: {
        corpus: {
          clientId: "replace-with-client-id",
        },
      },
    });

    for (const templatePath of [
      ...Object.values(client.canonicalModules),
      ...Object.values(client.linkedin),
      "sources/local/client-context.md",
      "sources/linkedin-research/research-readout.md",
      "sources/linkedin-research/post-type-taxonomy.csv",
    ]) {
      expect(
        existsSync(path.join(repoRoot, "clients/template-megaphone", templatePath)),
        templatePath,
      ).toBe(true);
    }
  });
});
