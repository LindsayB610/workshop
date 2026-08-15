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
    expect(workflow).toContain("npm run test:coverage");
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
    expect(workflow).toContain("set -o pipefail");
    expect(workflow).toContain("workshop-tauri-build.log");
    expect(workflow).toContain("workshop-dmg-build-diagnostics");
  });

  it("falls back to a signed updater release until public-installer credentials are complete", () => {
    const workflow = readFileSync(
      path.join(repoRoot, ".github/workflows/release-workshop.yml"),
      "utf8",
    );

    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("WORKSHOP_APPLE_DEVELOPER_ID_CERTIFICATE");
    expect(workflow).toContain("APPLE_SIGNING_IDENTITY");
    expect(workflow).toContain("WORKSHOP_NOTARY_PRIVATE_KEY");
    expect(workflow).toContain("Determine public installer mode");
    expect(workflow).toContain('public_installer=false');
    expect(workflow).toContain("Publishing a signed updater release only.");
    expect(workflow).toContain("if: steps.distribution_mode.outputs.public_installer == 'true'");
    expect(workflow).toContain("env -u APPLE_CERTIFICATE -u APPLE_CERTIFICATE_PASSWORD -u APPLE_SIGNING_IDENTITY");
    expect(workflow).toContain("xcrun notarytool submit");
    expect(workflow).toContain("xcrun stapler staple");
    expect(workflow).toContain("codesign --verify --deep --strict");
    expect(workflow).toContain("spctl -a -vvv -t install");
    expect(workflow).toContain("prepare-public-release.mjs");
    expect(workflow).toContain("gh release create");
    expect(workflow).toContain("Workshop-aarch64.dmg");
    expect(workflow.indexOf("Deploy updater payload to Netlify")).toBeLessThan(
      workflow.indexOf("Publish public GitHub Release"),
    );
  });

  it("removes Tauri's implementation-only volume icon before notarizing a public DMG", () => {
    const workflow = readFileSync(
      path.join(repoRoot, ".github/workflows/release-workshop.yml"),
      "utf8",
    );
    const cleanupScript = readFileSync(
      path.join(repoRoot, "apps/marketing-builds-desktop/scripts/remove-dmg-volume-icon.sh"),
      "utf8",
    );

    const cleanupStep = workflow.indexOf("Remove DMG volume-icon implementation file");
    const resignDmg = workflow.indexOf('codesign --force --sign "$APPLE_SIGNING_IDENTITY" --timestamp "$DMG_PATH"');
    const verifyDmg = workflow.indexOf('codesign --verify --verbose=2 "$DMG_PATH"');
    const notarizeDmg = workflow.indexOf("xcrun notarytool submit");
    const assessDmg = workflow.indexOf("spctl -a -vvv -t install");

    expect(cleanupStep).toBeGreaterThanOrEqual(0);
    expect(workflow).toContain("scripts/remove-dmg-volume-icon.sh");
    expect(resignDmg).toBeGreaterThan(cleanupStep);
    expect(verifyDmg).toBeGreaterThan(resignDmg);
    expect(notarizeDmg).toBeGreaterThan(verifyDmg);
    expect(assessDmg).toBeGreaterThan(notarizeDmg);
    expect(cleanupScript).toContain("rm -f \"$MOUNT_DIR/.VolumeIcon.icns\"");
    expect(cleanupScript).toContain("hdiutil convert \"$DMG_PATH\" -format UDRW");
    expect(cleanupScript).toContain("-format UDZO");
    expect(cleanupScript).toContain("$3 ~ /^\\/Volumes\\//");
  });

  it("uses the permanent public Workshop identifier", () => {
    const tauriConfig = readFileSync(
      path.join(repoRoot, "apps/marketing-builds-desktop/src-tauri/tauri.conf.json"),
      "utf8",
    );
    const releaseChecklist = readFileSync(
      path.join(repoRoot, "docs/release-checklist.md"),
      "utf8",
    );
    const publicReleaseChecklist = readFileSync(
      path.join(repoRoot, "docs/public-release-checklist.md"),
      "utf8",
    );

    expect(tauriConfig).toContain('"identifier": "com.lindsaybrunner.workshop"');
    expect(tauriConfig).toContain('"hardenedRuntime": true');
    expect(tauriConfig).toContain('"minimumSystemVersion": "11.0"');
    expect(tauriConfig).not.toContain("com.lindsaybrunner.marketingbuilds");
    expect(releaseChecklist).toContain("unless Lindsay has");
    expect(releaseChecklist).toContain("explicitly approved");
    expect(publicReleaseChecklist).toContain("Compatibility Boundary");
    expect(publicReleaseChecklist).toContain("written migration");
    expect(publicReleaseChecklist).toContain("rollback plan");
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
