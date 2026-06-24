import { useEffect, useMemo, useState } from "react";
import type { ToolDefinition } from "./types";

export const toolWorkspaceStorageKey = "workshop.toolWorkspaceState.v1";

export type ToolWorkspaceMode = "demo" | "external";

export type ToolWorkspaceSelection = {
  toolId: string;
  mode: ToolWorkspaceMode;
  root: string;
  label: string;
  updatedAt: string;
};

export type ToolWorkspaceState = {
  selections: ToolWorkspaceSelection[];
};

export type WorkspaceValidationResult =
  | {
      ok: true;
      normalizedRoot: string;
    }
  | {
      ok: false;
      message: string;
    };

const blockedClientIds = [["para", "sail"].join(""), "brunner-creative"];

export function defaultWorkspaceRootForTool(tool: ToolDefinition): string {
  return tool.defaultWorkspaceRoot;
}

export function defaultToolWorkspaceState(toolList: ToolDefinition[]): ToolWorkspaceState {
  return {
    selections: toolList.map((tool) => ({
      toolId: tool.id,
      mode: "demo",
      root: defaultWorkspaceRootForTool(tool),
      label: "Bundled demo workspace",
      updatedAt: "1970-01-01T00:00:00.000Z",
    })),
  };
}

export function normalizeWorkspaceRoot(root: string): WorkspaceValidationResult {
  const trimmed = root.trim().replace(/\\/g, "/").replace(/\/+$/, "");

  if (!trimmed) {
    return { ok: false, message: "Choose a workspace root before continuing." };
  }

  if (trimmed.includes("\0")) {
    return { ok: false, message: "Workspace paths cannot contain null bytes." };
  }

  if (trimmed.split("/").includes("..")) {
    return { ok: false, message: "Workspace paths cannot traverse upward." };
  }

  if (
    blockedClientIds.some((clientId) =>
      new RegExp(`(^|/)clients/${clientId}(?:/|$)`, "i").test(trimmed),
    )
  ) {
    return { ok: false, message: "Private client folders cannot be selected as bundled demo roots." };
  }

  return { ok: true, normalizedRoot: trimmed };
}

export function normalizeToolWorkspaceState(
  toolList: ToolDefinition[],
  storedState?: Partial<ToolWorkspaceState> | null,
): ToolWorkspaceState {
  const defaults = defaultToolWorkspaceState(toolList);
  const selections = new Map(defaults.selections.map((selection) => [selection.toolId, selection]));

  if (storedState && Array.isArray(storedState.selections)) {
    for (const storedSelection of storedState.selections) {
      const tool = toolList.find((candidate) => candidate.id === storedSelection?.toolId);
      if (!tool || typeof storedSelection?.root !== "string") {
        continue;
      }

      const normalized = normalizeWorkspaceRoot(storedSelection.root);
      if (!normalized.ok) {
        continue;
      }

      selections.set(tool.id, {
        toolId: tool.id,
        mode: storedSelection.mode === "external" ? "external" : "demo",
        root: normalized.normalizedRoot,
        label:
          typeof storedSelection.label === "string" && storedSelection.label.trim()
            ? storedSelection.label.trim()
            : "Local workspace",
        updatedAt:
          typeof storedSelection.updatedAt === "string"
            ? storedSelection.updatedAt
            : "1970-01-01T00:00:00.000Z",
      });
    }
  }

  return { selections: Array.from(selections.values()) };
}

export function getWorkspaceSelection(
  toolList: ToolDefinition[],
  state: ToolWorkspaceState,
  toolId: string,
): ToolWorkspaceSelection {
  return (
    state.selections.find((selection) => selection.toolId === toolId) ??
    defaultToolWorkspaceState(toolList).selections.find((selection) => selection.toolId === toolId) ??
    {
      toolId,
      mode: "demo",
      root: "",
      label: "No workspace",
      updatedAt: "1970-01-01T00:00:00.000Z",
    }
  );
}

export function setToolWorkspaceSelection(
  toolList: ToolDefinition[],
  state: ToolWorkspaceState,
  toolId: string,
  root: string,
  label = "Local workspace",
): { state: ToolWorkspaceState; workspaceFilesTouched: false; validation: WorkspaceValidationResult } {
  const validation = normalizeWorkspaceRoot(root);
  if (!validation.ok) {
    return { state: normalizeToolWorkspaceState(toolList, state), workspaceFilesTouched: false, validation };
  }

  const normalizedState = normalizeToolWorkspaceState(toolList, state);
  const nextSelection: ToolWorkspaceSelection = {
    toolId,
    mode: "external",
    root: validation.normalizedRoot,
    label,
    updatedAt: new Date().toISOString(),
  };

  return {
    state: {
      selections: [
        ...normalizedState.selections.filter((selection) => selection.toolId !== toolId),
        nextSelection,
      ],
    },
    workspaceFilesTouched: false,
    validation,
  };
}

export function resetToolWorkspaceSelection(
  toolList: ToolDefinition[],
  state: ToolWorkspaceState,
  toolId: string,
): { state: ToolWorkspaceState; workspaceFilesTouched: false } {
  const tool = toolList.find((candidate) => candidate.id === toolId);
  if (!tool) {
    return { state: normalizeToolWorkspaceState(toolList, state), workspaceFilesTouched: false };
  }

  const normalizedState = normalizeToolWorkspaceState(toolList, state);
  const defaultSelection = defaultToolWorkspaceState([tool]).selections[0];

  return {
    state: {
      selections: [
        ...normalizedState.selections.filter((selection) => selection.toolId !== toolId),
        defaultSelection,
      ],
    },
    workspaceFilesTouched: false,
  };
}

function readStoredState(): Partial<ToolWorkspaceState> | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  const stored = window.localStorage.getItem(toolWorkspaceStorageKey);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as Partial<ToolWorkspaceState>;
  } catch {
    return null;
  }
}

export function readWorkspaceRootForTool(
  toolList: ToolDefinition[],
  toolId: string,
): string | undefined {
  if (typeof window === "undefined" || !window.localStorage) {
    return undefined;
  }

  const state = normalizeToolWorkspaceState(toolList, readStoredState());
  const selection = getWorkspaceSelection(toolList, state, toolId);
  return selection.mode === "external" ? selection.root : undefined;
}

function writeStoredState(state: ToolWorkspaceState) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(toolWorkspaceStorageKey, JSON.stringify(state));
}

export function useToolWorkspaceState(toolList: ToolDefinition[]) {
  const [workspaceState, setWorkspaceState] = useState<ToolWorkspaceState>(() =>
    normalizeToolWorkspaceState(toolList, readStoredState()),
  );

  useEffect(() => {
    writeStoredState(workspaceState);
  }, [workspaceState]);

  return useMemo(
    () => ({
      workspaceState,
      getSelection: (toolId: string) => getWorkspaceSelection(toolList, workspaceState, toolId),
      setSelection: (toolId: string, root: string, label?: string) => {
        let result: ReturnType<typeof setToolWorkspaceSelection> | undefined;
        setWorkspaceState((currentState) => {
          result = setToolWorkspaceSelection(toolList, currentState, toolId, root, label);
          return result.state;
        });
        return result?.validation ?? normalizeWorkspaceRoot(root);
      },
      resetSelection: (toolId: string) => {
        setWorkspaceState(
          (currentState) =>
            resetToolWorkspaceSelection(toolList, currentState, toolId).state,
        );
      },
    }),
    [toolList, workspaceState],
  );
}
