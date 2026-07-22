import { describe, expect, it } from "vitest";
import {
  retainSlateSourceOnReloadFailure,
  scheduleSlateReload,
  shouldReloadSlateSource,
} from "./slateModel";

const ucPath = "/private/uc.md";
const freezerPath = "/private/freezer-storage.md";
const approvedPaths = [ucPath, freezerPath];

describe("Slate refresh contract", () => {
  it("reloads an approved file after an atomic-save rename event from its parent directory", () => {
    expect(
      shouldReloadSlateSource(
        { watchedDirectory: "/private", changedPath: ucPath },
        approvedPaths,
      ),
    ).toBe(true);
  });

  it("does not authorize a neighboring file in the watched directory", () => {
    expect(
      shouldReloadSlateSource(
        { watchedDirectory: "/private", changedPath: "/private/unrelated.md" },
        approvedPaths,
      ),
    ).toBe(false);
  });

  it("does not authorize a matching filename outside the watched directory", () => {
    expect(
      shouldReloadSlateSource(
        { watchedDirectory: "/elsewhere", changedPath: "/elsewhere/uc.md" },
        approvedPaths,
      ),
    ).toBe(false);
  });

  it("does not authorize an approved path from an unrelated watched directory", () => {
    expect(
      shouldReloadSlateSource(
        { watchedDirectory: "/elsewhere", changedPath: ucPath },
        approvedPaths,
      ),
    ).toBe(false);
  });

  it("does not associate a UC change with the freezer source directory", () => {
    const sourcesInDifferentDirectories = ["/private/uc/uc.md", "/private/freezer/freezer.md"];

    expect(
      shouldReloadSlateSource(
        { watchedDirectory: "/private/freezer", changedPath: "/private/uc/uc.md" },
        sourcesInDifferentDirectories,
      ),
    ).toBe(false);
  });

  it("schedules a matching reload at the provisional 300 ms debounce boundary", () => {
    expect(
      scheduleSlateReload(
        { watchedDirectory: "/private", changedPath: freezerPath },
        approvedPaths,
        1_000,
      ),
    ).toEqual({ sourcePath: freezerPath, dueAt: 1_300 });
  });

  it("keeps the last successful render when a reload fails", () => {
    expect(
      retainSlateSourceOnReloadFailure(
        { content: "previous source", updatedAt: 1_000, error: null },
        "Could not read freezer source.",
      ),
    ).toEqual({
      content: "previous source",
      updatedAt: 1_000,
      error: "Could not read freezer source.",
    });
  });
});
