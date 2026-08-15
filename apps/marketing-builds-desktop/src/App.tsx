import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { PreferencesDialog } from "./app-shell/PreferencesDialog";
import { ToolShelf } from "./app-shell/ToolShelf";
import { WorkbenchShell } from "./app-shell/WorkbenchShell";
import { useAppearance } from "./app-shell/useAppearance";
import { useWorkshopUpdater } from "./app-shell/SettingsPanel";
import { useToolInstallState } from "./tool-registry/installState";
import { getToolById, tools } from "./tool-registry/tools";
import { useToolWorkspaceState } from "./tool-registry/workspaceState";
import { ToolView } from "./tools/toolViews";
import { browseWorkspaceRoot } from "./tools/workspaceRootBrowse";

export function App() {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const { appearance, setAppearance, tokens } = useAppearance();
  const updater = useWorkshopUpdater();
  const { installedTools, availableTools, enableTool, disableTool, resetToolLocalState } =
    useToolInstallState(tools);
  const { getSelection, setSelection, resetSelection } = useToolWorkspaceState(tools);
  const activeTool = activeToolId ? getToolById(activeToolId) : undefined;
  const activeToolIsInstalled = activeTool
    ? installedTools.some((tool) => tool.id === activeTool.id)
    : false;

  function promptForWorkspaceRoot(toolId: string, requestedRoot?: string) {
    const tool = getToolById(toolId);
    if (!tool) {
      return undefined;
    }

    if (requestedRoot !== undefined) {
      return setSelection(tool.id, requestedRoot);
    }

    const root = window.prompt(
      `Set a private ${tool.displayName} workspace root outside this repo.`,
      getSelection(tool.id).root,
    );
    if (root === null) {
      return undefined;
    }

    return setSelection(tool.id, root);
  }

  useEffect(() => {
    const openPreferences = () => setPreferencesOpen(true);
    const checkForUpdates = () => { void updater.checkNow(); };
    window.addEventListener("workshop:open-preferences", openPreferences);
    window.addEventListener("workshop:check-for-updates", checkForUpdates);
    let unlistenPreferences: (() => void) | undefined;
    let unlistenUpdates: (() => void) | undefined;
    void listen("workshop:open-preferences", openPreferences).then((release) => { unlistenPreferences = release; }).catch(() => undefined);
    void listen("workshop:check-for-updates", checkForUpdates).then((release) => { unlistenUpdates = release; }).catch(() => undefined);
    return () => {
      window.removeEventListener("workshop:open-preferences", openPreferences);
      window.removeEventListener("workshop:check-for-updates", checkForUpdates);
      unlistenPreferences?.();
      unlistenUpdates?.();
    };
  }, []);

  return (
    <div className="app-frame">
      {activeTool && activeToolIsInstalled ? (
        <WorkbenchShell activeTool={activeTool} onBackToTools={() => setActiveToolId(null)} updater={updater} showRouteNav={activeTool.navigationMode === "host"}>
          {({ activeRouteId }) => (
            <ToolView
              activeRouteId={activeRouteId}
              browseWorkspaceRoot={browseWorkspaceRoot}
              onClearWorkspaceRequest={(toolId) => resetSelection(toolId)}
              onSetWorkspaceRequest={promptForWorkspaceRoot}
              tool={activeTool}
              workspaceRoot={getSelection(activeTool.id).root}
            />
          )}
        </WorkbenchShell>
      ) : (
        <ToolShelf
          availableTools={availableTools}
          installedTools={installedTools}
          onDisableTool={(toolId) => {
            disableTool(toolId);
            if (activeToolId === toolId) {
              setActiveToolId(null);
            }
          }}
          onEnableTool={enableTool}
          onOpenWorkspace={setActiveToolId}
          onResetWorkspace={resetSelection}
          onResetToolState={resetToolLocalState}
          onSelectTool={setActiveToolId}
          onSetWorkspace={(toolId, root) => setSelection(toolId, root)}
          getWorkspaceSelection={getSelection}
          tokens={tokens}
          updater={updater}
        />
      )}
      <PreferencesDialog
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        appearance={appearance}
        tokens={tokens}
        onChangeAppearance={setAppearance}
        installedTools={installedTools}
        getWorkspaceSelection={getSelection}
        onRequestWorkspace={(toolId) => promptForWorkspaceRoot(toolId)}
        onForgetWorkspace={resetSelection}
        updater={updater}
      />
    </div>
  );
}
