import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMegaphonePostPackage,
  chatWithMegaphoneAi,
  createMegaphoneAiPostPackage,
  clearMegaphoneAiCredential,
  exportMegaphoneOnboardingPacket,
  exportMegaphonePostPackage,
  getMegaphoneAiCredentialStatus,
  loadMegaphoneClientFolder,
  loadMegaphoneWorkspaceIndex,
  openMegaphoneArtifact,
  saveMegaphoneAiCredential,
  testMegaphoneAiConnection,
} from "./megaphoneActions";
import { toolWorkspaceStorageKey } from "../../tool-registry/workspaceState";
import {
  getMegaphoneWorkspace,
  type MegaphonePostPackageFile,
  type MegaphoneWorkspace,
} from "./megaphoneData";

const sampleFiles: MegaphonePostPackageFile[] = [
  {
    path: "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint-decision-tree/brief.md",
    contents: "# Brief\n",
  },
  {
    path: "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint-decision-tree/brief.json",
    contents: "{}\n",
  },
];

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

function withAiModel(workspace: MegaphoneWorkspace, model: string): MegaphoneWorkspace {
  return {
    ...workspace,
    aiDrafting: {
      ...workspace.aiDrafting,
      model,
    },
  };
}

function stubTauriWindowWithWorkspace(root: string) {
  const storage = new Map<string, string>();
  storage.set(
    toolWorkspaceStorageKey,
    JSON.stringify({
      selections: [
        {
          toolId: "megaphone",
          mode: "external",
          root,
          label: "Private workspace",
          updatedAt: "2026-06-26T00:00:00.000Z",
        },
      ],
    }),
  );

  vi.stubGlobal("window", {
    __TAURI_INTERNALS__: {},
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
}

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("Megaphone local artifact actions", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads client folders through the constrained Tauri command", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    invokeMock.mockResolvedValue({
      clientId: "demo-megaphone",
      clientName: "Northstar Demo Co.",
      clientType: "brand",
      path: "clients/demo-megaphone",
      readiness: "ready_to_brief",
      sourceCount: 31,
      researchFiles: 14,
      artifactPaths: [
        "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint-decision-tree/brief.md",
      ],
      calendarItems: [],
      measurementSignals: [],
      warnings: [],
    });

    await expect(loadMegaphoneClientFolder("clients/demo-megaphone")).resolves.toEqual({
      status: "loaded",
      clientId: "demo-megaphone",
      clientName: "Northstar Demo Co.",
      clientType: "brand",
      path: "clients/demo-megaphone",
      readiness: "ready_to_brief",
      sourceCount: 31,
      researchFiles: 14,
      artifactPaths: [
        "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint-decision-tree/brief.md",
      ],
      calendarItems: [],
      measurementSignals: [],
      warnings: [],
    });
    expect(invokeMock).toHaveBeenCalledWith("megaphone_load_client_folder", {
      path: "clients/demo-megaphone",
    });
  });

  it("loads Megaphone clients from a selected private workspace index", async () => {
    stubTauriWindowWithWorkspace("/Users/example/workshop-private");
    invokeMock.mockResolvedValue(`
version: 1
workspaceType: workshop-private
clients:
  - clientId: acme-megaphone
    root: clients/acme-megaphone
    tool: megaphone
    status: active
  - clientId: draft-megaphone
    root: clients/draft-megaphone
    tool: megaphone
    status: draft
  - clientId: old-megaphone
    root: clients/old-megaphone
    tool: megaphone
    status: archived
  - clientId: acme-redline
    root: clients/acme-redline
    tool: redline
    status: active
`);

    await expect(loadMegaphoneWorkspaceIndex()).resolves.toEqual({
      status: "loaded",
      clients: [
        {
          clientId: "acme-megaphone",
          root: "clients/acme-megaphone",
          tool: "megaphone",
          status: "active",
        },
        {
          clientId: "draft-megaphone",
          root: "clients/draft-megaphone",
          tool: "megaphone",
          status: "draft",
        },
      ],
    });
    expect(invokeMock).toHaveBeenCalledWith("read_private_workspace_index", {
      workspaceRoot: "/Users/example/workshop-private",
    });
  });

  it("reports invalid Megaphone private workspace indexes", async () => {
    stubTauriWindowWithWorkspace("/Users/example/workshop-private");
    invokeMock.mockResolvedValue(`
version: 1
workspaceType: workshop-private
clients:
  - clientId: acme-megaphone
    root: /Users/example/workshop-private/clients/acme-megaphone
    tool: megaphone
`);

    await expect(loadMegaphoneWorkspaceIndex()).resolves.toEqual({
      status: "unavailable",
      message: "Workspace client roots must be relative to the workspace root.",
    });
  });

  it("exports generated post package files through the Megaphone Tauri command", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const workspace = getMegaphoneWorkspace("demo-megaphone");
    invokeMock.mockResolvedValue(sampleFiles.length);

    await expect(exportMegaphonePostPackage(workspace, sampleFiles)).resolves.toEqual({
      status: "exported",
      clientId: "demo-megaphone",
      fileCount: sampleFiles.length,
    });
    expect(invokeMock).toHaveBeenCalledWith("megaphone_write_post_package_files", {
      clientId: "demo-megaphone",
      files: sampleFiles,
      overwrite: true,
    });
  });

  it("copies generated post package files in browser fallback mode", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const workspace = getMegaphoneWorkspace("demo-megaphone");

    await expect(exportMegaphonePostPackage(workspace, sampleFiles)).resolves.toEqual({
      status: "copied",
      clientId: "demo-megaphone",
      fileCount: sampleFiles.length,
    });
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining(sampleFiles[0].path),
    );
  });

  it("returns a visible package export error when clipboard copy is denied", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Clipboard permission denied.")),
      },
    });
    const workspace = getMegaphoneWorkspace("demo-megaphone");

    await expect(exportMegaphonePostPackage(workspace, sampleFiles)).resolves.toEqual({
      status: "unavailable",
      clientId: "demo-megaphone",
      message: "Clipboard permission denied.",
    });
  });

  it("exports onboarding packet files through the Megaphone Tauri command", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const workspace = getMegaphoneWorkspace("demo-influencer");
    invokeMock.mockResolvedValue(workspace.onboarding.exportFiles?.length ?? 0);

    await expect(exportMegaphoneOnboardingPacket(workspace)).resolves.toEqual({
      status: "exported",
      clientId: "demo-influencer",
      fileCount: 3,
    });
    expect(invokeMock).toHaveBeenCalledWith("megaphone_write_onboarding_files", {
      clientId: "demo-influencer",
      files: workspace.onboarding.exportFiles,
      overwrite: true,
    });
  });

  it("copies onboarding packet files in browser fallback mode", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const workspace = getMegaphoneWorkspace("demo-influencer");

    await expect(exportMegaphoneOnboardingPacket(workspace)).resolves.toEqual({
      status: "copied",
      clientId: "demo-influencer",
      fileCount: 3,
    });
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("onboarding/workshop-export-transcript.md"),
    );
  });

  it("returns a visible onboarding export error when clipboard copy is denied", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Clipboard permission denied.")),
      },
    });
    const workspace = getMegaphoneWorkspace("demo-influencer");

    await expect(exportMegaphoneOnboardingPacket(workspace)).resolves.toEqual({
      status: "unavailable",
      clientId: "demo-influencer",
      message: "Clipboard permission denied.",
    });
  });

  it("returns a clear unavailable result when no onboarding export files exist", async () => {
    const workspace = getMegaphoneWorkspace("demo-megaphone");

    await expect(exportMegaphoneOnboardingPacket(workspace)).resolves.toEqual({
      status: "unavailable",
      clientId: "demo-megaphone",
      message: "No onboarding export files are configured for this Megaphone client.",
    });
  });

  it("creates post packages from the loaded client folder through Tauri", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const workspace = getMegaphoneWorkspace("demo-megaphone");
    invokeMock.mockResolvedValue({
      clientId: "demo-megaphone",
      packageRoot:
        "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint-decision-tree",
      files: sampleFiles,
    });

    await expect(
      createMegaphonePostPackage(workspace, {
        status: "loaded",
        clientId: "demo-megaphone",
        clientName: "Northstar Demo Co.",
        clientType: "brand",
        path: "clients/demo-megaphone",
        readiness: "ready_to_brief",
        sourceCount: 31,
        researchFiles: 14,
        artifactPaths: [],
        calendarItems: [],
        measurementSignals: [],
        warnings: [],
      }),
    ).resolves.toEqual({
      status: "created",
      clientId: "demo-megaphone",
      packageRoot:
        "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint-decision-tree",
      files: sampleFiles,
    });
    expect(invokeMock).toHaveBeenCalledWith("megaphone_create_post_package", {
      clientId: "demo-megaphone",
      clientPath: "clients/demo-megaphone",
      topic: "source signal scorecard for service handoffs",
      audience: ["founder", "CTO"],
      buyerProblem: "source signal scorecard for service handoffs",
      postType: "visual_explainer",
      allowAdjacentExamples: false,
      proofRisk: "medium",
      contentPillar: "operational_control",
    });
  });

  it("tests the Megaphone AI connection through Tauri", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const workspace = withAiModel(getMegaphoneWorkspace("demo-megaphone"), "gpt-5");
    invokeMock.mockResolvedValue({
      availability: "missing_credentials",
      provider: "openai",
      model: "gpt-5",
      message: "OpenAI API key is not configured in local secure storage or .env.local.",
      fallbackEnabled: true,
    });

    await expect(
      testMegaphoneAiConnection(workspace, {
        status: "loaded",
        clientId: "demo-megaphone",
        clientName: "Northstar Demo Co.",
        clientType: "brand",
        path: "clients/demo-megaphone",
        readiness: "ready_to_brief",
        sourceCount: 31,
        researchFiles: 14,
        artifactPaths: [],
        calendarItems: [],
        measurementSignals: [],
        warnings: [],
      }),
    ).resolves.toEqual({
      status: "missing_credentials",
      provider: "openai",
      model: "gpt-5",
      message: "OpenAI API key is not configured in local secure storage or .env.local.",
      fallbackEnabled: true,
    });
    expect(invokeMock).toHaveBeenCalledWith("megaphone_test_ai_connection", {
      clientPath: "clients/demo-megaphone",
      model: "gpt-5",
    });
  });

  it("gets, saves, and clears secure AI credentials through Tauri without returning the key", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const workspace = withAiModel(getMegaphoneWorkspace("demo-megaphone"), "gpt-5");
    invokeMock
      .mockResolvedValueOnce({
        status: "missing_credentials",
        provider: "openai",
        model: "gpt-5",
        storage: "not_configured",
        message: "OpenAI API key is not saved in secure storage.",
        fallbackEnabled: true,
      })
      .mockResolvedValueOnce({
        status: "available",
        provider: "openai",
        model: "gpt-5",
        storage: "macos_keychain",
        message: "OpenAI API key is saved in local secure storage.",
        fallbackEnabled: true,
      })
      .mockResolvedValueOnce({
        status: "missing_credentials",
        provider: "openai",
        model: "gpt-5",
        storage: "not_configured",
        message: "OpenAI API key is not saved in secure storage.",
        fallbackEnabled: true,
      });

    await expect(getMegaphoneAiCredentialStatus(workspace)).resolves.toMatchObject({
      status: "missing_credentials",
      storage: "not_configured",
    });
    await expect(saveMegaphoneAiCredential(workspace, "sk-local-secret")).resolves.toMatchObject({
      status: "available",
      storage: "macos_keychain",
    });
    await expect(clearMegaphoneAiCredential(workspace)).resolves.toMatchObject({
      status: "missing_credentials",
      storage: "not_configured",
    });

    expect(invokeMock).toHaveBeenNthCalledWith(1, "megaphone_get_ai_credential_status", {
      model: "gpt-5",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "megaphone_save_ai_credential", {
      apiKey: "sk-local-secret",
      model: "gpt-5",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "megaphone_clear_ai_credential", {
      model: "gpt-5",
    });
  });

  it("refuses to save an empty AI credential before calling Tauri", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const workspace = getMegaphoneWorkspace("demo-megaphone");

    await expect(saveMegaphoneAiCredential(workspace, " ")).resolves.toEqual({
      status: "unavailable",
      message: "Enter an OpenAI API key before saving.",
      fallbackEnabled: true,
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("creates AI-assisted post packages from the loaded client folder through Tauri", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const workspace = withAiModel(getMegaphoneWorkspace("demo-megaphone"), "gpt-5");
    invokeMock.mockResolvedValue({
      clientId: "demo-megaphone",
      packageRoot:
        "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint-decision-tree",
      files: [
        ...sampleFiles,
        {
          path: "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint-decision-tree/ai-generation.md",
          contents: "# AI Draft Generation\n\n- Mode: ai\n",
        },
      ],
    });

    await expect(
      createMegaphoneAiPostPackage(workspace, {
        status: "loaded",
        clientId: "demo-megaphone",
        clientName: "Northstar Demo Co.",
        clientType: "brand",
        path: "clients/demo-megaphone",
        readiness: "ready_to_brief",
        sourceCount: 31,
        researchFiles: 14,
        artifactPaths: [],
        calendarItems: [],
        measurementSignals: [],
        warnings: [],
      }),
    ).resolves.toMatchObject({
      status: "created",
      clientId: "demo-megaphone",
    });
    expect(invokeMock).toHaveBeenCalledWith("megaphone_create_ai_post_package", {
      clientId: "demo-megaphone",
      clientPath: "clients/demo-megaphone",
      topic: "source signal scorecard for service handoffs",
      audience: ["founder", "CTO"],
      buyerProblem: "source signal scorecard for service handoffs",
      postType: "visual_explainer",
      allowAdjacentExamples: false,
      proofRisk: "medium",
      contentPillar: "operational_control",
      model: "gpt-5",
    });
  });

  it("keeps AI generation unavailable in browser fallback mode", async () => {
    vi.stubGlobal("window", {});
    const workspace = getMegaphoneWorkspace("demo-megaphone");

    await expect(
      createMegaphoneAiPostPackage(workspace, {
        status: "loaded",
        clientId: "demo-megaphone",
        clientName: "Northstar Demo Co.",
        clientType: "brand",
        path: "clients/demo-megaphone",
        readiness: "ready_to_brief",
        sourceCount: 31,
        researchFiles: 14,
        artifactPaths: [],
        calendarItems: [],
        measurementSignals: [],
        warnings: [],
      }),
    ).resolves.toEqual({
      status: "unavailable",
      clientId: "demo-megaphone",
      message: "AI draft generation is available in the packaged Workshop app.",
    });
  });

  it("sends contextual AI chat through Tauri with pasted notes and history", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const workspace = withAiModel(getMegaphoneWorkspace("demo-megaphone"), "gpt-5-mini");
    invokeMock.mockResolvedValue({
      status: "answered",
      provider: "openai",
      model: "gpt-5-mini",
      assistantMessage: "Review the proof boundary before publishing.",
      contextSummary: "Documents: 1",
      warnings: [],
    });

    await expect(
      chatWithMegaphoneAi(
        workspace,
        {
          status: "loaded",
          clientId: "demo-megaphone",
          clientName: "Northstar Demo Co.",
          clientType: "brand",
          path: "clients/demo-megaphone",
          readiness: "ready_to_brief",
          sourceCount: 31,
          researchFiles: 14,
          artifactPaths: [],
          calendarItems: [],
          measurementSignals: [],
          warnings: [],
        },
        {
          message: "What should I review?",
          documents: [
            {
              id: "workshop-notes",
              title: "Workshop notes",
              sourceType: "note",
              content: "Avoid unsupported benchmark claims.",
            },
          ],
          history: [{ role: "user", content: "Drafting a visual explainer." }],
        },
      ),
    ).resolves.toMatchObject({
      status: "answered",
      assistantMessage: "Review the proof boundary before publishing.",
    });
    expect(invokeMock).toHaveBeenCalledWith("megaphone_chat_with_context", {
      clientPath: "clients/demo-megaphone",
      model: "gpt-5-mini",
      message: "What should I review?",
      documents: [
        {
          id: "workshop-notes",
          title: "Workshop notes",
          sourceType: "note",
          content: "Avoid unsupported benchmark claims.",
        },
      ],
      history: [{ role: "user", content: "Drafting a visual explainer." }],
    });
  });

  it("keeps contextual AI chat unavailable in browser fallback mode", async () => {
    vi.stubGlobal("window", {});
    const workspace = getMegaphoneWorkspace("demo-megaphone");

    await expect(
      chatWithMegaphoneAi(
        workspace,
        {
          status: "loaded",
          clientId: "demo-megaphone",
          clientName: "Northstar Demo Co.",
          clientType: "brand",
          path: "clients/demo-megaphone",
          readiness: "ready_to_brief",
          sourceCount: 31,
          researchFiles: 14,
          artifactPaths: [],
          calendarItems: [],
          measurementSignals: [],
          warnings: [],
        },
        {
          message: "What should I review?",
          documents: [],
          history: [],
        },
      ),
    ).resolves.toEqual({
      status: "unavailable",
      provider: "openai",
      model: "gpt-5-mini",
      assistantMessage: "Contextual AI chat is available in the packaged Workshop app.",
      warnings: [],
    });
  });

  it("requires a loaded client before creating a post package", async () => {
    const workspace = getMegaphoneWorkspace("demo-megaphone");

    await expect(createMegaphonePostPackage(workspace, null)).resolves.toEqual({
      status: "unavailable",
      clientId: "demo-megaphone",
      message: "Load a Megaphone client folder before creating a post package.",
    });
  });

  it("opens Megaphone artifacts through the constrained Tauri command", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const path =
      "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint-decision-tree/brief.md";

    await expect(openMegaphoneArtifact(path)).resolves.toEqual({
      status: "opened",
      path,
    });
    expect(invokeMock).toHaveBeenCalledWith("megaphone_open_path", { path });
  });

  it("copies Megaphone artifact paths in browser fallback mode", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const path =
      "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint-decision-tree/brief.md";

    await expect(openMegaphoneArtifact(path)).resolves.toEqual({
      status: "copied",
      path,
    });
    expect(writeText).toHaveBeenCalledWith(path);
  });

  it("returns a visible artifact open error when clipboard copy is denied", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Clipboard permission denied.")),
      },
    });
    const path =
      "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint-decision-tree/brief.md";

    await expect(openMegaphoneArtifact(path)).resolves.toEqual({
      status: "unavailable",
      path,
      message: "Clipboard permission denied.",
    });
  });

  it("returns a visible open error when Tauri rejects an artifact path", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    invokeMock.mockRejectedValue("File does not exist: clients/demo-megaphone/post-packages/demo/brief.md");

    await expect(
      openMegaphoneArtifact("clients/demo-megaphone/post-packages/demo/brief.md"),
    ).resolves.toEqual({
      status: "unavailable",
      path: "clients/demo-megaphone/post-packages/demo/brief.md",
      message: "File does not exist: clients/demo-megaphone/post-packages/demo/brief.md",
    });
  });

  it("returns a visible export error when Tauri rejects a package write", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const workspace = getMegaphoneWorkspace("demo-megaphone");
    invokeMock.mockRejectedValue("Megaphone post packages must be written under clients/demo-megaphone/post-packages.");

    await expect(exportMegaphonePostPackage(workspace, sampleFiles)).resolves.toEqual({
      status: "unavailable",
      clientId: "demo-megaphone",
      message: "Megaphone post packages must be written under clients/demo-megaphone/post-packages.",
    });
  });

  it("returns a clear unavailable export result before a brief exists", async () => {
    const workspace = getMegaphoneWorkspace("demo-megaphone");

    await expect(exportMegaphonePostPackage(workspace, [])).resolves.toEqual({
      status: "unavailable",
      clientId: "demo-megaphone",
      message: "Create a post brief before exporting a Megaphone package.",
    });
  });
});
