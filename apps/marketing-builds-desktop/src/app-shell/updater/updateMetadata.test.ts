import { describe, expect, it } from "vitest";
import {
  compareSemver,
  isNewerVersion,
  validateStaticUpdateManifest,
  WORKSHOP_UPDATE_ENDPOINT,
} from "./updateMetadata";

describe("Workshop updater metadata", () => {
  it("compares versions with or without a v prefix", () => {
    expect(compareSemver("v1.2.0", "1.1.9")).toBe(1);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("0.9.9", "1.0.0")).toBe(-1);
    expect(isNewerVersion("0.2.0", "0.1.0")).toBe(true);
  });

  it("validates a static Tauri updater manifest", () => {
    expect(
      validateStaticUpdateManifest(
        {
          version: "0.2.0",
          platforms: {
            "darwin-aarch64": {
              url: "https://updates.lindsaybrunner.com/workshop/Workshop.app.tar.gz",
              signature: "signed",
            },
          },
        },
        "darwin-aarch64",
      ),
    ).toEqual([]);
  });

  it("rejects missing signatures and insecure update URLs", () => {
    expect(
      validateStaticUpdateManifest(
        {
          version: "0.2.0",
          platforms: {
            "darwin-aarch64": {
              url: "http://updates.lindsaybrunner.com/workshop/Workshop.app.tar.gz",
              signature: "",
            },
          },
        },
        "darwin-aarch64",
      ),
    ).toEqual(["Update URL must use HTTPS.", "Update signature is required."]);
  });

  it("pins the Workshop update endpoint", () => {
    expect(WORKSHOP_UPDATE_ENDPOINT).toBe(
      "https://workshop-updates-lindsaybrunner.netlify.app/latest.json",
    );
  });
});
