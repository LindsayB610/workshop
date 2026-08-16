import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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

  it("injects and verifies the reviewed Finder layout before notarizing a public DMG", () => {
    const workflow = readFileSync(
      path.join(repoRoot, ".github/workflows/release-workshop.yml"),
      "utf8",
    );
    const prepareScript = readFileSync(
      path.join(repoRoot, "apps/marketing-builds-desktop/scripts/prepare-dmg-installer.sh"),
      "utf8",
    );
    const verifyScript = readFileSync(
      path.join(repoRoot, "apps/marketing-builds-desktop/scripts/verify-dmg-installer.sh"),
      "utf8",
    );
    const finderLayout = readFileSync(
      path.join(repoRoot, "apps/marketing-builds-desktop/src-tauri/dmg/Workshop.DS_Store"),
    );
    const finderBackground = readFileSync(
      path.join(repoRoot, "apps/marketing-builds-desktop/src-tauri/dmg/installer-background-repositioned.png"),
    );
    const installerArrow = readFileSync(
      path.join(repoRoot, "apps/marketing-builds-desktop/src-tauri/dmg/installer-arrow.png"),
    );

    const prepareStep = workflow.indexOf("Apply deterministic Finder layout to the DMG");
    const verifyStep = workflow.indexOf("Verify DMG installer contents");
    const resignDmg = workflow.indexOf('codesign --force --sign "$APPLE_SIGNING_IDENTITY" --timestamp "$DMG_PATH"');
    const verifyDmg = workflow.indexOf('codesign --verify --verbose=2 "$DMG_PATH"');
    const notarizeDmg = workflow.indexOf("xcrun notarytool submit");
    const assessDmg = workflow.indexOf("spctl -a -vvv -t install");

    expect(prepareStep).toBeGreaterThanOrEqual(0);
    expect(verifyStep).toBeGreaterThan(prepareStep);
    expect(workflow).toContain("scripts/prepare-dmg-installer.sh");
    expect(workflow).toContain("scripts/verify-dmg-installer.sh");
    expect(workflow).toContain("src-tauri/dmg/Workshop.DS_Store");
    expect(workflow).toContain("src-tauri/dmg/installer-background-repositioned.png");
    expect(resignDmg).toBeGreaterThan(verifyStep);
    expect(verifyDmg).toBeGreaterThan(resignDmg);
    expect(notarizeDmg).toBeGreaterThan(verifyDmg);
    expect(assessDmg).toBeGreaterThan(notarizeDmg);
    expect(prepareScript).toContain("rm -f \"$MOUNT_DIR/.VolumeIcon.icns\"");
    expect(prepareScript).toContain("cp \"$LAYOUT_PATH\" \"$MOUNT_DIR/.DS_Store\"");
    expect(prepareScript).toContain("BACKGROUND_NAME=\"$(basename \"$BACKGROUND_PATH\")\"");
    expect(prepareScript).toContain("cp \"$BACKGROUND_PATH\" \"$MOUNT_DIR/.background/$BACKGROUND_NAME\"");
    expect(prepareScript).toContain("hdiutil convert \"$DMG_PATH\" -format UDRW");
    expect(prepareScript).toContain("-format UDZO");
    expect(prepareScript).toContain("$3 ~ /^\\/Volumes\\//");
    expect(verifyScript).toContain("cmp -s \"$LAYOUT_PATH\" \"$MOUNT_DIR/.DS_Store\"");
    expect(verifyScript).toContain("cmp -s \"$BACKGROUND_PATH\" \"$MOUNT_DIR/.background/$BACKGROUND_NAME\"");
    expect(verifyScript).toContain("[ ! -d \"$MOUNT_DIR/Workshop.app\" ]");
    expect(verifyScript).toContain("[ -e \"$MOUNT_DIR/.VolumeIcon.icns\" ]");
    expect(finderLayout.subarray(4, 8).toString("ascii")).toBe("Bud1");
    expect(finderLayout.includes(Buffer.from("installer-background-repositioned.png"))).toBe(true);
    expect(finderBackground.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(installerArrow.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(createHash("sha256").update(installerArrow).digest("hex")).toBe(
      "17c516d76a95424218dfbe571e2c528e050ed941bc2b0094026dedabe84f621d",
    );
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
