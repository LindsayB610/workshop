import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../../../..");

describe("Workshop release workflow", () => {
  it("publishes app updates only through explicit manual dispatch", () => {
    const workflow = readFileSync(
      path.join(repoRoot, ".github/workflows/release-workshop.yml"),
      "utf8",
    );

    expect(workflow).not.toContain("push:");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("WORKSHOP_RELEASE_NOTES");
    expect(workflow).toContain("WORKSHOP_RELEASE_NOTES: ${{ inputs.notes }}");
    expect(workflow).toContain('--notes "$WORKSHOP_RELEASE_NOTES"');
  });

  it("keeps required release secrets documented and wired into the workflow", () => {
    const workflow = readFileSync(
      path.join(repoRoot, ".github/workflows/release-workshop.yml"),
      "utf8",
    );
    const docs = readFileSync(path.join(repoRoot, "docs/workshop-updates.md"), "utf8");

    for (const secret of [
      "WORKSHOP_TAURI_SIGNING_PRIVATE_KEY",
      "WORKSHOP_TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
      "NETLIFY_AUTH_TOKEN",
    ]) {
      expect(workflow).toContain(`secrets.${secret}`);
      expect(docs).toContain(secret);
    }

    expect(workflow).toContain("netlify-cli deploy --prod");
    expect(workflow).toContain("actions/upload-artifact");
  });

  it("derives release versions from the live updater manifest by default", () => {
    const workflow = readFileSync(
      path.join(repoRoot, ".github/workflows/release-workshop.yml"),
      "utf8",
    );

    expect(workflow).toContain("required: false");
    expect(workflow).toContain("updater:next-version");
    expect(workflow).toContain("--manifest-url \"$WORKSHOP_UPDATE_BASE_URL/latest.json\"");
    expect(workflow).toContain("steps.release_version.outputs.version");
    expect(workflow).not.toContain("updater:bump-version --workspace @marketing-builds/desktop -- \"${{ inputs.version }}\"");
  });
});
