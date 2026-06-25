import { useEffect, useMemo, useState } from "react";
import type { ToolDefinition } from "./types";

export const toolInstallStorageKey = "workshop.toolInstallState.v2";
export const toolLocalStatePrefix = "workshop.toolLocalState.";

export type ToolInstallState = {
  enabledToolIds: string[];
};

export type ToolInstallActionResult = {
  state: ToolInstallState;
  workspaceFilesTouched: false;
};

export function defaultToolInstallState(toolList: ToolDefinition[]): ToolInstallState {
  return {
    enabledToolIds: toolList.filter((tool) => tool.defaultInstalled).map((tool) => tool.id),
  };
}

export function normalizeToolInstallState(
  toolList: ToolDefinition[],
  storedState?: Partial<ToolInstallState> | null,
): ToolInstallState {
  const knownToolIds = new Set(toolList.map((tool) => tool.id));
  const defaultState = defaultToolInstallState(toolList);
  if (!storedState || !Array.isArray(storedState.enabledToolIds)) {
    return defaultState;
  }

  const enabledToolIds = storedState.enabledToolIds.filter((toolId, index, toolIds) => {
    return knownToolIds.has(toolId) && toolIds.indexOf(toolId) === index;
  });

  return { enabledToolIds };
}

export function getInstalledTools(
  toolList: ToolDefinition[],
  state: ToolInstallState,
): ToolDefinition[] {
  const enabledToolIds = new Set(state.enabledToolIds);
  return toolList.filter((tool) => enabledToolIds.has(tool.id));
}

export function getAvailableBundledTools(
  toolList: ToolDefinition[],
  state: ToolInstallState,
): ToolDefinition[] {
  const enabledToolIds = new Set(state.enabledToolIds);
  return toolList.filter(
    (tool) => tool.installMode === "bundled" && !enabledToolIds.has(tool.id),
  );
}

export function getAvailableTools(
  toolList: ToolDefinition[],
  state: ToolInstallState,
): ToolDefinition[] {
  const enabledToolIds = new Set(state.enabledToolIds);
  return toolList.filter((tool) => !enabledToolIds.has(tool.id));
}

export function enableTool(
  toolList: ToolDefinition[],
  state: ToolInstallState,
  toolId: string,
): ToolInstallActionResult {
  const tool = toolList.find((candidate) => candidate.id === toolId);
  if (!tool || state.enabledToolIds.includes(toolId)) {
    return { state: normalizeToolInstallState(toolList, state), workspaceFilesTouched: false };
  }

  return {
    state: normalizeToolInstallState(toolList, {
      enabledToolIds: [...state.enabledToolIds, toolId],
    }),
    workspaceFilesTouched: false,
  };
}

export function disableTool(
  toolList: ToolDefinition[],
  state: ToolInstallState,
  toolId: string,
): ToolInstallActionResult {
  return {
    state: normalizeToolInstallState(toolList, {
      enabledToolIds: state.enabledToolIds.filter((enabledToolId) => enabledToolId !== toolId),
    }),
    workspaceFilesTouched: false,
  };
}

export function toolLocalStateKey(toolId: string, key: string): string {
  return `${toolLocalStatePrefix}${toolId}.${key}`;
}

export function resetToolLocalState(toolId: string, storage: Storage): string[] {
  const prefix = `${toolLocalStatePrefix}${toolId}.`;
  const removedKeys: string[] = [];

  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) {
      storage.removeItem(key);
      removedKeys.push(key);
    }
  }

  return removedKeys.sort();
}

function readStoredState(): Partial<ToolInstallState> | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(toolInstallStorageKey);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as Partial<ToolInstallState>;
  } catch {
    return null;
  }
}

function writeStoredState(state: ToolInstallState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(toolInstallStorageKey, JSON.stringify(state));
}

export function useToolInstallState(toolList: ToolDefinition[]) {
  const [installState, setInstallState] = useState<ToolInstallState>(() =>
    normalizeToolInstallState(toolList, readStoredState()),
  );

  useEffect(() => {
    writeStoredState(installState);
  }, [installState]);

  return useMemo(
    () => ({
      installState,
      installedTools: getInstalledTools(toolList, installState),
      availableTools: getAvailableTools(toolList, installState),
      enableTool: (toolId: string) => {
        setInstallState((currentState) => enableTool(toolList, currentState, toolId).state);
      },
      disableTool: (toolId: string) => {
        setInstallState((currentState) => disableTool(toolList, currentState, toolId).state);
      },
      resetToolLocalState: (toolId: string) => {
        if (typeof window !== "undefined") {
          resetToolLocalState(toolId, window.localStorage);
        }
      },
    }),
    [installState, toolList],
  );
}
