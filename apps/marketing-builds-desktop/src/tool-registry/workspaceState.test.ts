import { describe, expect, it } from "vitest";
import { tools } from "./tools";
import {
  defaultToolWorkspaceState,
  getWorkspaceSelection,
  normalizeToolWorkspaceState,
  normalizeWorkspaceRoot,
  resetToolWorkspaceSelection,
  setToolWorkspaceSelection,
  toolWorkspaceStorageKey,
} from "./workspaceState";

const privateClientId = ["para", "sail"].join("");

describe("tool workspace state", () => {
  it("defaults bundled tools to sanitized demo workspaces", () => {
    const state = defaultToolWorkspaceState(tools);

    expect(getWorkspaceSelection(tools, state, "redline")).toMatchObject({
      mode: "demo",
      root: "clients/demo-redline",
    });
    expect(getWorkspaceSelection(tools, state, "megaphone")).toMatchObject({
      mode: "demo",
      root: "clients/demo-megaphone",
    });
    expect(JSON.stringify(state).toLowerCase()).not.toContain(privateClientId);
  });

  it("validates stored workspace roots without touching workspace files", () => {
    expect(normalizeWorkspaceRoot(" /Users/example/workshop-private ")).toEqual({
      ok: true,
      normalizedRoot: "/Users/example/workshop-private",
    });
    expect(normalizeWorkspaceRoot("../clients/demo-redline")).toMatchObject({ ok: false });
    expect(normalizeWorkspaceRoot(`clients/${privateClientId}`)).toMatchObject({ ok: false });

    const result = setToolWorkspaceSelection(
      tools,
      defaultToolWorkspaceState(tools),
      "redline",
      "/Users/example/workshop-private",
      "Private workspace",
    );

    expect(result.workspaceFilesTouched).toBe(false);
    expect(result.validation).toMatchObject({ ok: true });
    expect(getWorkspaceSelection(tools, result.state, "redline")).toMatchObject({
      mode: "external",
      root: "/Users/example/workshop-private",
      label: "Private workspace",
    });
  });

  it("normalizes bad stored state back to safe defaults", () => {
    const state = normalizeToolWorkspaceState(tools, {
      selections: [
        {
          toolId: "redline",
          mode: "external",
          root: `clients/${privateClientId}`,
          label: "Bad private root",
          updatedAt: "2026-06-23T00:00:00.000Z",
        },
      ],
    });

    expect(getWorkspaceSelection(tools, state, "redline")).toMatchObject({
      mode: "demo",
      root: "clients/demo-redline",
    });
  });

  it("resets an external workspace to demo without deleting files", () => {
    const selected = setToolWorkspaceSelection(
      tools,
      defaultToolWorkspaceState(tools),
      "megaphone",
      "/Users/example/workshop-private",
    ).state;

    const reset = resetToolWorkspaceSelection(tools, selected, "megaphone");

    expect(reset.workspaceFilesTouched).toBe(false);
    expect(getWorkspaceSelection(tools, reset.state, "megaphone")).toMatchObject({
      mode: "demo",
      root: "clients/demo-megaphone",
    });
  });

  it("keeps recent workspace state in local UI storage only", () => {
    expect(toolWorkspaceStorageKey).toBe("workshop.toolWorkspaceState.v1");
    expect(toolWorkspaceStorageKey).not.toContain("clients/");
  });
});
