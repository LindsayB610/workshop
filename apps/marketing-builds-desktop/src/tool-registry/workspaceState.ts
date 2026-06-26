import { useEffect, useMemo, useState } from "react";
import { parse as parseYaml } from "yaml";
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

export type PrivateWorkspaceClientStatus = "active" | "draft" | "archived";

export type PrivateWorkspaceClient = {
  clientId: string;
  root: string;
  tool: string;
  status: PrivateWorkspaceClientStatus;
};

export type PrivateWorkspaceIndex = {
  version: 1;
  workspaceType: string;
  clients: PrivateWorkspaceClient[];
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

export type WorkspaceIndexParseResult =
  | {
      ok: true;
      index: PrivateWorkspaceIndex;
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

function normalizeWorkspaceClientRoot(root: string): WorkspaceValidationResult {
  const normalized = normalizeWorkspaceRoot(root);
  if (!normalized.ok) {
    return normalized;
  }

  const { normalizedRoot } = normalized;
  if (normalizedRoot.startsWith("/")) {
    return { ok: false, message: "Workspace client roots must be relative to the workspace root." };
  }

  if (!/^clients\/[^/]+$/.test(normalizedRoot)) {
    return { ok: false, message: "Workspace client roots must look like clients/<client-id>." };
  }

  return { ok: true, normalizedRoot };
}

export function parsePrivateWorkspaceIndex(contents: string): WorkspaceIndexParseResult {
  let parsed: unknown;
  try {
    parsed = parseYaml(contents);
  } catch {
    return { ok: false, message: "workspace.yaml is not valid YAML." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, message: "workspace.yaml must contain a mapping." };
  }

  const record = parsed as Record<string, unknown>;
  if (record.version !== 1) {
    return { ok: false, message: "workspace.yaml version must be 1." };
  }

  if (typeof record.workspaceType !== "string" || !record.workspaceType.trim()) {
    return { ok: false, message: "workspace.yaml requires a workspaceType." };
  }

  if (!Array.isArray(record.clients)) {
    return { ok: false, message: "workspace.yaml requires a clients list." };
  }

  const clients: PrivateWorkspaceClient[] = [];
  const seenClientIds = new Set<string>();
  for (const rawClient of record.clients) {
    if (!rawClient || typeof rawClient !== "object" || Array.isArray(rawClient)) {
      return { ok: false, message: "Each workspace client must be a mapping." };
    }

    const client = rawClient as Record<string, unknown>;
    if (typeof client.clientId !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(client.clientId)) {
      return { ok: false, message: "Workspace client ids must be lowercase slugs." };
    }

    if (seenClientIds.has(client.clientId)) {
      return { ok: false, message: `Duplicate workspace client id: ${client.clientId}.` };
    }
    seenClientIds.add(client.clientId);

    if (typeof client.root !== "string") {
      return { ok: false, message: `Workspace client ${client.clientId} requires a root.` };
    }

    const normalizedRoot = normalizeWorkspaceClientRoot(client.root);
    if (!normalizedRoot.ok) {
      return { ok: false, message: normalizedRoot.message };
    }

    if (normalizedRoot.normalizedRoot !== `clients/${client.clientId}`) {
      return {
        ok: false,
        message: `Workspace client ${client.clientId} root must be clients/${client.clientId}.`,
      };
    }

    if (typeof client.tool !== "string" || !/^[a-z][a-z0-9-]*$/.test(client.tool)) {
      return { ok: false, message: `Workspace client ${client.clientId} requires a tool slug.` };
    }

    const status = typeof client.status === "string" ? client.status : "active";
    if (status !== "active" && status !== "draft" && status !== "archived") {
      return {
        ok: false,
        message: `Workspace client ${client.clientId} has an unsupported status.`,
      };
    }

    clients.push({
      clientId: client.clientId,
      root: normalizedRoot.normalizedRoot,
      tool: client.tool,
      status,
    });
  }

  return {
    ok: true,
    index: {
      version: 1,
      workspaceType: record.workspaceType.trim(),
      clients,
    },
  };
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
