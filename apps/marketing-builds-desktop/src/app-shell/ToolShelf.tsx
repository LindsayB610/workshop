import { Ellipsis, FolderOpen, PackagePlus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { SettingsPanel } from "./SettingsPanel";
import { ToolLogo } from "./ToolLogo";
import { Button } from "../components/ui/button";
import type { ToolDefinition } from "../tool-registry/types";
import { tools } from "../tool-registry/tools";
import type { ToolWorkspaceSelection, WorkspaceValidationResult } from "../tool-registry/workspaceState";

export function ToolShelf({
  installedTools = tools,
  availableTools = [],
  catalogInitiallyOpen = false,
  onSelectTool,
  onEnableTool = () => undefined,
  onDisableTool = () => undefined,
  onOpenWorkspace = onSelectTool,
  onResetWorkspace = () => undefined,
  onResetToolState = () => undefined,
  onSetWorkspace = () => ({ ok: true, normalizedRoot: "" }),
  getWorkspaceSelection = (tool) => ({
    toolId: tool,
    mode: "demo",
    root: "",
    label: "Bundled demo workspace",
    updatedAt: "1970-01-01T00:00:00.000Z",
  }),
}: {
  installedTools?: ToolDefinition[];
  availableTools?: ToolDefinition[];
  catalogInitiallyOpen?: boolean;
  onSelectTool: (toolId: string) => void;
  onEnableTool?: (toolId: string) => void;
  onDisableTool?: (toolId: string) => void;
  onOpenWorkspace?: (toolId: string) => void;
  onResetWorkspace?: (toolId: string) => void;
  onResetToolState?: (toolId: string) => void;
  onSetWorkspace?: (toolId: string, root: string) => WorkspaceValidationResult;
  getWorkspaceSelection?: (toolId: string) => ToolWorkspaceSelection;
}) {
  const [catalogOpen, setCatalogOpen] = useState(catalogInitiallyOpen);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const hasAvailableTools = availableTools.length > 0;

  return (
    <main className="tool-shelf-screen">
      <header className="tool-shelf-header">
        <div className="brand-mark" aria-label="Lindsay Brunner brand mark">
          LB
        </div>
        <div>
          <p className="eyebrow">Marketing builds</p>
          <h1>Workshop</h1>
        </div>
      </header>

      <div className="tool-shelf-update">
        <SettingsPanel visibility="actionable" />
      </div>

      <div className="tool-shelf-actions">
        {hasAvailableTools ? (
          <Button
            className="add-tools-button"
            variant="primary"
            onClick={() => setCatalogOpen((isOpen) => !isOpen)}
          >
            <PackagePlus size={18} aria-hidden="true" />
            <span>Add New Tools</span>
          </Button>
        ) : null}
        {statusMessage ? (
          <p className="tool-shelf-status" role="status">
            {statusMessage}
          </p>
        ) : null}
      </div>

      {catalogOpen && hasAvailableTools ? (
        <section className="tool-catalog" aria-label="Add New Tools catalog">
          {availableTools.map((tool) => (
            <article key={tool.id} className="tool-catalog-card">
              <ToolLogo tool={tool} />
              <div>
                <p className="eyebrow">Bundled tool</p>
                <h2>{tool.displayName}</h2>
                <p>{tool.description}</p>
                <small>{tool.workspaceRequirement}</small>
              </div>
              <div className="tool-catalog-actions">
                <a href={tool.docsPath} rel="noreferrer" target="_blank">
                  View docs
                </a>
                <Button
                  variant="primary"
                  onClick={() => {
                    onEnableTool(tool.id);
                    setStatusMessage(`${tool.displayName} is installed. Local workspaces were not changed.`);
                    setCatalogOpen(false);
                  }}
                >
                  Install
                </Button>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="tool-shelf" aria-label="Workshop tools">
        {installedTools.map((tool) => (
          <ToolChiclet
            key={tool.id}
            tool={tool}
            onSelectTool={onSelectTool}
            onDisableTool={(toolId) => {
              onDisableTool(toolId);
              setStatusMessage(`${tool.displayName} is disabled. ${tool.uninstallSafetyCopy}`);
            }}
            onChooseWorkspace={() => {
              onOpenWorkspace(tool.id);
            }}
            onResetWorkspace={() => {
              onResetWorkspace(tool.id);
              setStatusMessage(`${tool.displayName} is using the bundled demo workspace.`);
            }}
            onResetState={() => {
              onResetToolState(tool.id);
              setStatusMessage(`${tool.displayName} local UI state was reset. Workspace files were not touched.`);
            }}
            onSetWorkspace={() => {
              const root = window.prompt(
                `Set a private ${tool.displayName} workspace root outside this repo.`,
                getWorkspaceSelection(tool.id).root,
              );
              if (root === null) {
                return;
              }
              const result = onSetWorkspace(tool.id, root);
              setStatusMessage(
                result.ok
                  ? `${tool.displayName} will use ${result.normalizedRoot}. Workspace files were not changed.`
                  : result.message,
              );
            }}
            workspaceSelection={getWorkspaceSelection(tool.id)}
          />
        ))}
      </section>
    </main>
  );
}

function ToolChiclet({
  tool,
  onSelectTool,
  onDisableTool,
  onChooseWorkspace,
  onResetWorkspace,
  onResetState,
  onSetWorkspace,
  workspaceSelection,
}: {
  tool: ToolDefinition;
  onSelectTool: (toolId: string) => void;
  onDisableTool: (toolId: string) => void;
  onChooseWorkspace: () => void;
  onResetWorkspace: () => void;
  onResetState: () => void;
  onSetWorkspace: () => void;
  workspaceSelection: ToolWorkspaceSelection;
}) {
  return (
    <article className="tool-chiclet-wrap">
      <button
        type="button"
        className="tool-chiclet"
        onClick={() => onSelectTool(tool.id)}
        aria-describedby={`${tool.id}-tooltip`}
      >
        <ToolLogo tool={tool} />
        <span className="tool-chiclet-label">
          <strong>{tool.displayName}</strong>
          <small>{tool.status === "ready" ? "Ready" : "Planned"}</small>
        </span>
        <span id={`${tool.id}-tooltip`} role="tooltip" className="tool-tooltip">
          {tool.description}
        </span>
      </button>
      <details className="tool-action-menu">
        <summary aria-label={`${tool.displayName} tool actions`}>
          <Ellipsis size={18} aria-hidden="true" />
        </summary>
        <div className="tool-action-menu-panel" role="menu">
          <a role="menuitem" href={tool.docsPath} rel="noreferrer" target="_blank">
            View docs
          </a>
          <p className="tool-workspace-menu-summary">
            {workspaceSelection.mode === "external" ? "Private root" : "Demo root"}:{" "}
            <code>{workspaceSelection.root || tool.defaultWorkspaceRoot}</code>
          </p>
          <button type="button" role="menuitem" onClick={onChooseWorkspace}>
            <FolderOpen size={15} aria-hidden="true" />
            <span>Open workspace</span>
          </button>
          <button type="button" role="menuitem" onClick={onSetWorkspace}>
            <FolderOpen size={15} aria-hidden="true" />
            <span>Set private workspace</span>
          </button>
          <button type="button" role="menuitem" onClick={onResetWorkspace}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>Use demo workspace</span>
          </button>
          <button type="button" role="menuitem" onClick={onResetState}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>Reset local state</span>
          </button>
          <button type="button" role="menuitem" onClick={() => onDisableTool(tool.id)}>
            <Trash2 size={15} aria-hidden="true" />
            <span>Disable tool</span>
          </button>
          <small>{tool.uninstallSafetyCopy}</small>
        </div>
      </details>
    </article>
  );
}
