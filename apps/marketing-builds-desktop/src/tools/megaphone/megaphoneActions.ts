import { invoke } from "@tauri-apps/api/core";
import { tools } from "../../tool-registry/tools";
import {
  parsePrivateWorkspaceIndex,
  readWorkspaceRootForTool,
  type PrivateWorkspaceClient,
} from "../../tool-registry/workspaceState";
import type { MegaphonePostPackageFile, MegaphoneWorkspace } from "./megaphoneData";

export type MegaphoneClientLoadResult =
  | {
      status: "loaded";
      clientId: string;
      clientName: string;
      clientType: MegaphoneWorkspace["clientType"];
      path: string;
      readiness: MegaphoneWorkspace["readiness"];
      sourceCount: number;
      researchFiles: number;
      artifactPaths: string[];
      calendarItems: MegaphoneWorkspace["calendarItems"];
      measurementSignals: MegaphoneWorkspace["measurementSignals"];
      warnings: string[];
    }
  | {
      status: "unavailable";
      path: string;
      message: string;
    };

type MegaphoneLoadedClientFolder = Omit<
  Extract<MegaphoneClientLoadResult, { status: "loaded" }>,
  "status"
>;

export type MegaphoneWorkspaceIndexResult =
  | {
      status: "loaded";
      clients: PrivateWorkspaceClient[];
    }
  | {
      status: "unavailable";
      message: string;
    };

export type MegaphoneExportResult =
  | {
      status: "exported";
      clientId: string;
      fileCount: number;
    }
  | {
      status: "copied";
      clientId: string;
      fileCount: number;
    }
  | {
      status: "unavailable";
      clientId: string;
      message: string;
    };

export type MegaphoneOnboardingExportResult = MegaphoneExportResult;

export type MegaphonePackageCreateResult =
  | {
      status: "created";
      clientId: string;
      packageRoot: string;
      files: MegaphonePostPackageFile[];
    }
  | {
      status: "unavailable";
      clientId: string;
      message: string;
    };

export type MegaphoneAiConnectionResult =
  | {
      status: "available";
      provider: MegaphoneWorkspace["aiDrafting"]["provider"];
      model: string;
      message: string;
      fallbackEnabled: boolean;
    }
  | {
      status: "disabled" | "missing_credentials" | "unavailable";
      provider?: MegaphoneWorkspace["aiDrafting"]["provider"];
      model?: string;
      message: string;
      fallbackEnabled: boolean;
    };

export type MegaphoneAiCredentialResult =
  | {
      status: "available" | "disabled" | "missing_credentials" | "unavailable";
      provider: MegaphoneWorkspace["aiDrafting"]["provider"];
      model: string;
      storage: MegaphoneWorkspace["aiDrafting"]["storage"];
      message: string;
      fallbackEnabled: boolean;
    }
  | {
      status: "unavailable";
      message: string;
      fallbackEnabled: boolean;
    };

export type MegaphoneOpenResult =
  | {
      status: "opened";
      path: string;
    }
  | {
      status: "copied";
      path: string;
    }
  | {
      status: "unavailable";
      path: string;
      message: string;
    };

export type MegaphoneChatDocument = {
  id: string;
  title: string;
  content: string;
  sourceType?: "note" | "document" | "artifact" | "transcript";
};

export type MegaphoneChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type MegaphoneChatResult =
  | {
      status: "answered";
      provider: MegaphoneWorkspace["aiDrafting"]["provider"];
      model: string;
      assistantMessage: string;
      responseId?: string;
      contextSummary: string;
      warnings: string[];
    }
  | {
      status: "unavailable";
      provider?: MegaphoneWorkspace["aiDrafting"]["provider"];
      model?: string;
      assistantMessage: string;
      contextSummary?: string;
      warnings: string[];
      errorKind?: string;
    };

function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

function megaphoneWorkspaceRoot(): string | undefined {
  return readWorkspaceRootForTool(tools, "megaphone");
}

export async function loadMegaphoneWorkspaceIndex(): Promise<MegaphoneWorkspaceIndexResult> {
  if (typeof window === "undefined" || !window.__TAURI_INTERNALS__) {
    return {
      status: "unavailable",
      message: "Private workspace indexes are available in the packaged Workshop app.",
    };
  }

  const workspaceRoot = megaphoneWorkspaceRoot();
  if (!workspaceRoot) {
    return {
      status: "unavailable",
      message: "Choose a private Megaphone workspace before reading workspace.yaml.",
    };
  }

  try {
    const contents = await invoke<string | null>("read_private_workspace_index", {
      workspaceRoot,
    });
    if (!contents) {
      return {
        status: "unavailable",
        message: "No workspace.yaml was found in the selected private workspace.",
      };
    }

    const parsed = parsePrivateWorkspaceIndex(contents);
    if (!parsed.ok) {
      return {
        status: "unavailable",
        message: parsed.message,
      };
    }

    return {
      status: "loaded",
      clients: parsed.index.clients.filter(
        (client) =>
          client.tool === "megaphone" &&
          (client.status === "active" || client.status === "draft"),
      ),
    };
  } catch (error) {
    return {
      status: "unavailable",
      message: messageFromError(error, "Workshop could not read workspace.yaml."),
    };
  }
}

export async function loadMegaphoneClientFolder(
  path: string,
): Promise<MegaphoneClientLoadResult> {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    return {
      status: "loaded",
      ...(await invoke<MegaphoneLoadedClientFolder>("megaphone_load_client_folder", {
        path,
        workspaceRoot: megaphoneWorkspaceRoot(),
      })),
    };
  }

  return {
    status: "unavailable",
    path,
    message: "Client folder loading is available in the packaged Workshop app.",
  };
}

export async function createMegaphonePostPackage(
  workspace: MegaphoneWorkspace,
  loadedClient: Extract<MegaphoneClientLoadResult, { status: "loaded" }> | null,
): Promise<MegaphonePackageCreateResult> {
  if (!loadedClient) {
    return {
      status: "unavailable",
      clientId: workspace.clientId,
      message: "Load a Megaphone client folder before creating a post package.",
    };
  }

  if (loadedClient.clientId !== workspace.clientId) {
    return {
      status: "unavailable",
      clientId: workspace.clientId,
      message: `Loaded client "${loadedClient.clientId}" does not match active client "${workspace.clientId}".`,
    };
  }

  if (typeof window === "undefined" || !window.__TAURI_INTERNALS__) {
    return {
      status: "unavailable",
      clientId: workspace.clientId,
      message: "Post package creation is available in the packaged Workshop app.",
    };
  }

  try {
    const postPackage = await invoke<{
      clientId: string;
      packageRoot: string;
      files: MegaphonePostPackageFile[];
    }>("megaphone_create_post_package", {
      clientId: workspace.clientId,
      clientPath: loadedClient.path,
      topic: workspace.activeBriefTopic,
      audience: workspace.activeAudience.split(",").map((audience) => audience.trim()),
      buyerProblem: workspace.activeBriefTopic,
      postType: workspace.activePostType,
      allowAdjacentExamples: workspace.allowAdjacentExamples,
      proofRisk: workspace.proofRisk,
      contentPillar: workspace.calendarItems[0]?.pillar,
      workspaceRoot: megaphoneWorkspaceRoot(),
    });

    return {
      status: "created",
      clientId: postPackage.clientId,
      packageRoot: postPackage.packageRoot,
      files: postPackage.files,
    };
  } catch (error) {
    return {
      status: "unavailable",
      clientId: workspace.clientId,
      message: messageFromError(error, "Megaphone could not create the post package."),
    };
  }
}

export async function testMegaphoneAiConnection(
  workspace: MegaphoneWorkspace,
  loadedClient: Extract<MegaphoneClientLoadResult, { status: "loaded" }> | null,
): Promise<MegaphoneAiConnectionResult> {
  if (!loadedClient) {
    return {
      status: "unavailable",
      message: "Load a Megaphone client folder before testing AI drafting.",
      fallbackEnabled: true,
    };
  }

  if (typeof window === "undefined" || !window.__TAURI_INTERNALS__) {
    return {
      status: workspace.aiDrafting.availability,
      provider: workspace.aiDrafting.provider,
      model: workspace.aiDrafting.model,
      message: "AI connection testing is available in the packaged Workshop app.",
      fallbackEnabled: workspace.aiDrafting.fallbackEnabled,
    };
  }

  try {
    const result = await invoke<{
      availability: MegaphoneWorkspace["aiDrafting"]["availability"];
      provider: MegaphoneWorkspace["aiDrafting"]["provider"];
      model: string;
      message: string;
      fallbackEnabled: boolean;
    }>("megaphone_test_ai_connection", {
      clientPath: loadedClient.path,
      model: workspace.aiDrafting.model,
      workspaceRoot: megaphoneWorkspaceRoot(),
    });

    return {
      status: result.availability,
      provider: result.provider,
      model: result.model,
      message: result.message,
      fallbackEnabled: result.fallbackEnabled,
    };
  } catch (error) {
    return {
      status: "unavailable",
      provider: workspace.aiDrafting.provider,
      model: workspace.aiDrafting.model,
      message: messageFromError(error, "Megaphone could not test the AI connection."),
      fallbackEnabled: true,
    };
  }
}

export async function getMegaphoneAiCredentialStatus(
  workspace: MegaphoneWorkspace,
): Promise<MegaphoneAiCredentialResult> {
  if (typeof window === "undefined" || !window.__TAURI_INTERNALS__) {
    return {
      status: workspace.aiDrafting.availability,
      provider: workspace.aiDrafting.provider,
      model: workspace.aiDrafting.model,
      storage: workspace.aiDrafting.storage,
      message: "Secure AI credential status is available in the packaged Workshop app.",
      fallbackEnabled: workspace.aiDrafting.fallbackEnabled,
    };
  }

  try {
    return await invoke<MegaphoneAiCredentialResult>("megaphone_get_ai_credential_status", {
      model: workspace.aiDrafting.model,
    });
  } catch (error) {
    return {
      status: "unavailable",
      message: messageFromError(error, "Megaphone could not read AI credential status."),
      fallbackEnabled: true,
    };
  }
}

export async function saveMegaphoneAiCredential(
  workspace: MegaphoneWorkspace,
  apiKey: string,
): Promise<MegaphoneAiCredentialResult> {
  if (!apiKey.trim()) {
    return {
      status: "unavailable",
      message: "Enter an OpenAI API key before saving.",
      fallbackEnabled: true,
    };
  }

  if (typeof window === "undefined" || !window.__TAURI_INTERNALS__) {
    return {
      status: "unavailable",
      message: "Secure AI credential storage is available in the packaged Workshop app.",
      fallbackEnabled: true,
    };
  }

  try {
    return await invoke<MegaphoneAiCredentialResult>("megaphone_save_ai_credential", {
      apiKey,
      model: workspace.aiDrafting.model,
    });
  } catch (error) {
    return {
      status: "unavailable",
      message: messageFromError(error, "Megaphone could not save the AI credential."),
      fallbackEnabled: true,
    };
  }
}

export async function clearMegaphoneAiCredential(
  workspace: MegaphoneWorkspace,
): Promise<MegaphoneAiCredentialResult> {
  if (typeof window === "undefined" || !window.__TAURI_INTERNALS__) {
    return {
      status: "unavailable",
      message: "Secure AI credential clearing is available in the packaged Workshop app.",
      fallbackEnabled: true,
    };
  }

  try {
    return await invoke<MegaphoneAiCredentialResult>("megaphone_clear_ai_credential", {
      model: workspace.aiDrafting.model,
    });
  } catch (error) {
    return {
      status: "unavailable",
      message: messageFromError(error, "Megaphone could not clear the AI credential."),
      fallbackEnabled: true,
    };
  }
}

export async function createMegaphoneAiPostPackage(
  workspace: MegaphoneWorkspace,
  loadedClient: Extract<MegaphoneClientLoadResult, { status: "loaded" }> | null,
): Promise<MegaphonePackageCreateResult> {
  if (!loadedClient) {
    return {
      status: "unavailable",
      clientId: workspace.clientId,
      message: "Load a Megaphone client folder before generating AI drafts.",
    };
  }

  if (loadedClient.clientId !== workspace.clientId) {
    return {
      status: "unavailable",
      clientId: workspace.clientId,
      message: `Loaded client "${loadedClient.clientId}" does not match active client "${workspace.clientId}".`,
    };
  }

  if (typeof window === "undefined" || !window.__TAURI_INTERNALS__) {
    return {
      status: "unavailable",
      clientId: workspace.clientId,
      message: "AI draft generation is available in the packaged Workshop app.",
    };
  }

  try {
    const postPackage = await invoke<{
      clientId: string;
      packageRoot: string;
      files: MegaphonePostPackageFile[];
    }>("megaphone_create_ai_post_package", {
      clientId: workspace.clientId,
      clientPath: loadedClient.path,
      topic: workspace.activeBriefTopic,
      audience: workspace.activeAudience.split(",").map((audience) => audience.trim()),
      buyerProblem: workspace.activeBriefTopic,
      postType: workspace.activePostType,
      allowAdjacentExamples: workspace.allowAdjacentExamples,
      proofRisk: workspace.proofRisk,
      contentPillar: workspace.calendarItems[0]?.pillar,
      model: workspace.aiDrafting.model,
      workspaceRoot: megaphoneWorkspaceRoot(),
    });

    return {
      status: "created",
      clientId: postPackage.clientId,
      packageRoot: postPackage.packageRoot,
      files: postPackage.files,
    };
  } catch (error) {
    return {
      status: "unavailable",
      clientId: workspace.clientId,
      message: messageFromError(error, "Megaphone could not generate AI drafts."),
    };
  }
}

export async function chatWithMegaphoneAi(
  workspace: MegaphoneWorkspace,
  loadedClient: Extract<MegaphoneClientLoadResult, { status: "loaded" }> | null,
  input: {
    message: string;
    documents: MegaphoneChatDocument[];
    history: MegaphoneChatTurn[];
  },
): Promise<MegaphoneChatResult> {
  if (!loadedClient) {
    return {
      status: "unavailable",
      assistantMessage: "Load a Megaphone client folder before starting an AI chat.",
      warnings: [],
    };
  }

  if (!input.message.trim()) {
    return {
      status: "unavailable",
      assistantMessage: "Enter a message before starting an AI chat.",
      warnings: [],
    };
  }

  if (typeof window === "undefined" || !window.__TAURI_INTERNALS__) {
    return {
      status: "unavailable",
      provider: workspace.aiDrafting.provider,
      model: workspace.aiDrafting.model,
      assistantMessage: "Contextual AI chat is available in the packaged Workshop app.",
      warnings: [],
    };
  }

  try {
    return await invoke<MegaphoneChatResult>("megaphone_chat_with_context", {
      clientPath: loadedClient.path,
      model: workspace.aiDrafting.model,
      message: input.message,
      documents: input.documents,
      history: input.history,
      workspaceRoot: megaphoneWorkspaceRoot(),
    });
  } catch (error) {
    return {
      status: "unavailable",
      provider: workspace.aiDrafting.provider,
      model: workspace.aiDrafting.model,
      assistantMessage: messageFromError(error, "Megaphone could not start the AI chat."),
      warnings: [],
    };
  }
}

export async function exportMegaphonePostPackage(
  workspace: MegaphoneWorkspace,
  files: MegaphonePostPackageFile[],
): Promise<MegaphoneExportResult> {
  if (!files.length) {
    return {
      status: "unavailable",
      clientId: workspace.clientId,
      message: "Create a post brief before exporting a Megaphone package.",
    };
  }

  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const fileCount = await invoke<number>("megaphone_write_post_package_files", {
        clientId: workspace.clientId,
        files,
        overwrite: true,
        workspaceRoot: megaphoneWorkspaceRoot(),
      });

      return { status: "exported", clientId: workspace.clientId, fileCount };
    } catch (error) {
      return {
        status: "unavailable",
        clientId: workspace.clientId,
        message: messageFromError(error, "Megaphone could not export the post package."),
      };
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(
        files.map((file) => `# ${file.path}\n\n${file.contents}`).join("\n\n---\n\n"),
      );
      return { status: "copied", clientId: workspace.clientId, fileCount: files.length };
    } catch (error) {
      return {
        status: "unavailable",
        clientId: workspace.clientId,
        message: messageFromError(error, "Megaphone could not copy the post package."),
      };
    }
  }

  return {
    status: "unavailable",
    clientId: workspace.clientId,
    message: "Post package export is available in the packaged Workshop app.",
  };
}

export async function exportMegaphoneOnboardingPacket(
  workspace: MegaphoneWorkspace,
): Promise<MegaphoneOnboardingExportResult> {
  const files = workspace.onboarding.exportFiles ?? [];
  if (!files.length) {
    return {
      status: "unavailable",
      clientId: workspace.clientId,
      message: "No onboarding export files are configured for this Megaphone client.",
    };
  }

  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const fileCount = await invoke<number>("megaphone_write_onboarding_files", {
        clientId: workspace.clientId,
        files,
        overwrite: true,
        workspaceRoot: megaphoneWorkspaceRoot(),
      });

      return { status: "exported", clientId: workspace.clientId, fileCount };
    } catch (error) {
      return {
        status: "unavailable",
        clientId: workspace.clientId,
        message: messageFromError(error, "Megaphone could not export the onboarding packet."),
      };
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(
        files.map((file) => `# ${file.path}\n\n${file.contents}`).join("\n\n---\n\n"),
      );
      return { status: "copied", clientId: workspace.clientId, fileCount: files.length };
    } catch (error) {
      return {
        status: "unavailable",
        clientId: workspace.clientId,
        message: messageFromError(error, "Megaphone could not copy the onboarding packet."),
      };
    }
  }

  return {
    status: "unavailable",
    clientId: workspace.clientId,
    message: "Onboarding export is available in the packaged Workshop app.",
  };
}

export async function openMegaphoneArtifact(path: string): Promise<MegaphoneOpenResult> {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      await invoke("megaphone_open_path", { path, workspaceRoot: megaphoneWorkspaceRoot() });
      return { status: "opened", path };
    } catch (error) {
      return {
        status: "unavailable",
        path,
        message: messageFromError(error, "Megaphone could not open the artifact."),
      };
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(path);
      return { status: "copied", path };
    } catch (error) {
      return {
        status: "unavailable",
        path,
        message: messageFromError(error, "Megaphone could not copy the artifact path."),
      };
    }
  }

  return {
    status: "unavailable",
    path,
    message: "Artifact opening is available in the packaged Workshop app.",
  };
}
