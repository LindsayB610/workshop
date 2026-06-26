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
  it("defaults every Workshop app to available instead of installed", () => {
    const state = defaultToolInstallState(tools);

    expect(state.schemaVersion).toBe(3);
    expect(state.enabledToolIds).toEqual([]);
    expect(getInstalledTools(tools, state)).toEqual([]);
    expect(getAvailableBundledTools(tools, state).map((tool) => tool.id)).toEqual([
      "redline",
      "megaphone",
    ]);
    expect(getAvailableTools(tools, state).map((tool) => tool.id)).toEqual([
      "redline",
      "megaphone",
      "pulse",
    ]);
  });

  it("normalizes current persisted state to known tools", () => {
    expect(
      normalizeToolInstallState(tools, {
        schemaVersion: 3,
        enabledToolIds: ["redline", "pulse", "unknown", "redline"],
      }),
    ).toEqual({ schemaVersion: 3, enabledToolIds: ["redline", "pulse"] });
  });

  it("migrates unversioned install state without uninstalling legacy bundled tools", () => {
    expect(
      normalizeToolInstallState(tools, {
        enabledToolIds: [],
      }),
    ).toEqual({ schemaVersion: 3, enabledToolIds: ["redline", "megaphone"] });
    expect(
      normalizeToolInstallState(tools, {
        enabledToolIds: ["pulse"],
      }),
    ).toEqual({ schemaVersion: 3, enabledToolIds: ["redline", "megaphone", "pulse"] });
  });

  it("preserves older persisted installs and carries them into the current schema", () => {
    const state = normalizeToolInstallState(tools, {
      enabledToolIds: ["redline", "megaphone"],
    });

    expect(getInstalledTools(tools, state).map((tool) => tool.id)).toEqual([
      "redline",
      "megaphone",
    ]);
    expect(getAvailableTools(tools, state).map((tool) => tool.id)).toEqual(["pulse"]);
  });

  it("installs and disables one bundled app without touching workspace files", () => {
    const initialState = defaultToolInstallState(tools);
    const restored = enableTool(tools, initialState, "redline");

    expect(restored.workspaceFilesTouched).toBe(false);
    expect(getInstalledTools(tools, restored.state).map((tool) => tool.id)).toEqual([
      "redline",
    ]);

    const disabled = disableTool(tools, restored.state, "redline");

    expect(disabled.workspaceFilesTouched).toBe(false);
    expect(getInstalledTools(tools, disabled.state)).toEqual([]);
    expect(getAvailableBundledTools(tools, disabled.state).map((tool) => tool.id)).toEqual([
      "redline",
      "megaphone",
    ]);
  });

  it("installs an external app launcher without touching workspace files", () => {
    const initialState = defaultToolInstallState(tools);
    const installed = enableTool(tools, initialState, "pulse");

    expect(installed.workspaceFilesTouched).toBe(false);
    expect(getInstalledTools(tools, installed.state).map((tool) => tool.id)).toEqual(["pulse"]);
    expect(getAvailableTools(tools, installed.state).map((tool) => tool.id)).toEqual([
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
