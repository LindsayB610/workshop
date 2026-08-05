import { describe, expect, it } from "vitest";
import {
  defaultToolInstallState,
  disableTool,
  enableTool,
  getAvailableBundledTools,
  getAvailableTools,
  getInstalledTools,
  normalizeToolInstallState,
  resetToolLocalState,
  toolInstallStorageKey,
  toolLocalStateKey,
} from "./installState";
import { tools } from "./tools";

describe("tool install state", () => {
  it("hides every unpromoted tool from a fresh Workshop install", () => {
    const state = defaultToolInstallState(tools);

    expect(state.schemaVersion).toBe(4);
    expect(state.enabledToolIds).toEqual([]);
    expect(getInstalledTools(tools, state)).toEqual([]);
    expect(getAvailableBundledTools(tools, state)).toEqual([]);
    expect(getAvailableTools(tools, state)).toEqual([]);
  });

  it("removes unpromoted tools from persisted install state", () => {
    expect(
      normalizeToolInstallState(tools, {
        schemaVersion: 4,
        enabledToolIds: ["redline", "pulse", "unknown", "redline"],
      }),
    ).toEqual({ schemaVersion: 4, enabledToolIds: [] });
  });

  it("does not revive legacy installs before their tools are promoted", () => {
    expect(
      normalizeToolInstallState(tools, {
        enabledToolIds: [],
      }),
    ).toEqual({ schemaVersion: 4, enabledToolIds: [] });
    expect(
      normalizeToolInstallState(tools, {
        enabledToolIds: ["pulse"],
      }),
    ).toEqual({ schemaVersion: 4, enabledToolIds: [] });
  });

  it("does not add planned tools during the version-three install-state migration", () => {
    expect(
      normalizeToolInstallState(tools, {
        schemaVersion: 3,
        enabledToolIds: ["redline", "pulse"],
      }),
    ).toEqual({ schemaVersion: 4, enabledToolIds: [] });
    expect(
      normalizeToolInstallState(tools, {
        schemaVersion: 3,
        enabledToolIds: [],
      }),
    ).toEqual({ schemaVersion: 4, enabledToolIds: [] });
  });

  it("keeps unpromoted persisted installs hidden", () => {
    const state = normalizeToolInstallState(tools, {
      enabledToolIds: ["redline", "megaphone"],
    });

    expect(getInstalledTools(tools, state)).toEqual([]);
    expect(getAvailableTools(tools, state)).toEqual([]);
  });

  it("refuses to install an unpromoted bundled app", () => {
    const initialState = defaultToolInstallState(tools);
    const restored = enableTool(tools, initialState, "redline");

    expect(restored.workspaceFilesTouched).toBe(false);
    expect(getInstalledTools(tools, restored.state)).toEqual([]);

    const disabled = disableTool(tools, restored.state, "redline");

    expect(disabled.workspaceFilesTouched).toBe(false);
    expect(getInstalledTools(tools, disabled.state)).toEqual([]);
    expect(getAvailableBundledTools(tools, disabled.state)).toEqual([]);
  });

  it("refuses to install an unpromoted external app launcher", () => {
    const initialState = defaultToolInstallState(tools);
    const installed = enableTool(tools, initialState, "pulse");

    expect(installed.workspaceFilesTouched).toBe(false);
    expect(getInstalledTools(tools, installed.state)).toEqual([]);
    expect(getAvailableTools(tools, installed.state)).toEqual([]);
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
