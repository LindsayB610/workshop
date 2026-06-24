import { describe, expect, it } from "vitest";
import {
  defaultToolInstallState,
  disableTool,
  enableTool,
  getAvailableBundledTools,
  getInstalledTools,
  normalizeToolInstallState,
  resetToolLocalState,
  toolInstallStorageKey,
  toolLocalStateKey,
} from "./installState";
import { tools } from "./tools";

describe("tool install state", () => {
  it("defaults bundled Workshop tools to installed", () => {
    const state = defaultToolInstallState(tools);

    expect(state.enabledToolIds).toEqual(["redline", "megaphone"]);
    expect(getInstalledTools(tools, state).map((tool) => tool.id)).toEqual([
      "redline",
      "megaphone",
    ]);
    expect(getAvailableBundledTools(tools, state)).toEqual([]);
  });

  it("normalizes persisted state to known bundled tools", () => {
    expect(
      normalizeToolInstallState(tools, {
        enabledToolIds: ["redline", "unknown", "redline"],
      }),
    ).toEqual({ enabledToolIds: ["redline"] });
  });

  it("disables and restores one bundled tool without touching workspace files", () => {
    const initialState = defaultToolInstallState(tools);
    const disabled = disableTool(tools, initialState, "redline");

    expect(disabled.workspaceFilesTouched).toBe(false);
    expect(getInstalledTools(tools, disabled.state).map((tool) => tool.id)).toEqual([
      "megaphone",
    ]);
    expect(getAvailableBundledTools(tools, disabled.state).map((tool) => tool.id)).toEqual([
      "redline",
    ]);

    const restored = enableTool(tools, disabled.state, "redline");

    expect(restored.workspaceFilesTouched).toBe(false);
    expect(getInstalledTools(tools, restored.state).map((tool) => tool.id)).toEqual([
      "redline",
      "megaphone",
    ]);
  });

  it("resets only namespaced local UI state for one tool", () => {
    const storage = new Map<string, string>();
    const mockStorage = {
      get length() {
        return storage.size;
      },
      key(index: number) {
        return Array.from(storage.keys())[index] ?? null;
      },
      removeItem(key: string) {
        storage.delete(key);
      },
    } as Storage;
    storage.set(toolInstallStorageKey, JSON.stringify(defaultToolInstallState(tools)));
    storage.set(toolLocalStateKey("redline", "activeClient"), "demo-redline");
    storage.set(toolLocalStateKey("redline", "activeRoute"), "review");
    storage.set(toolLocalStateKey("megaphone", "activeClient"), "demo-megaphone");

    expect(resetToolLocalState("redline", mockStorage)).toEqual([
      "workshop.toolLocalState.redline.activeClient",
      "workshop.toolLocalState.redline.activeRoute",
    ]);
    expect(storage.has(toolInstallStorageKey)).toBe(true);
    expect(storage.has(toolLocalStateKey("megaphone", "activeClient"))).toBe(true);
    expect(storage.has(toolLocalStateKey("redline", "activeClient"))).toBe(false);
  });
});
