import type { WorkshopUpdateManifest } from "./types";

export const WORKSHOP_UPDATE_ENDPOINT =
  "https://workshop-updates-lindsaybrunner.netlify.app/latest.json";

export const WORKSHOP_UPDATE_PUBKEY_PLACEHOLDER =
  "WORKSHOP_UPDATER_PUBLIC_KEY_TO_BE_GENERATED_BEFORE_FIRST_EXTERNAL_RELEASE";

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export function compareSemver(a: string, b: string): number {
  const left = normalizeVersion(a).split(".").map((part) => Number.parseInt(part, 10));
  const right = normalizeVersion(b).split(".").map((part) => Number.parseInt(part, 10));
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) {
      return delta > 0 ? 1 : -1;
    }
  }

  return 0;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareSemver(candidate, current) > 0;
}

export function validateStaticUpdateManifest(
  manifest: WorkshopUpdateManifest,
  platform: string,
): string[] {
  const errors: string[] = [];

  if (!manifest.version || Number.isNaN(Number.parseInt(normalizeVersion(manifest.version), 10))) {
    errors.push("Manifest version must be valid semver.");
  }

  const platformUpdate = manifest.platforms[platform];
  if (!platformUpdate) {
    errors.push(`Manifest is missing platform "${platform}".`);
    return errors;
  }

  if (!platformUpdate.url.startsWith("https://")) {
    errors.push("Update URL must use HTTPS.");
  }

  if (!platformUpdate.signature.trim()) {
    errors.push("Update signature is required.");
  }

  return errors;
}
