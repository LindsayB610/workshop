import { useState } from "react";
import { ToolShelf } from "./app-shell/ToolShelf";
import { WorkbenchShell } from "./app-shell/WorkbenchShell";
import { useToolInstallState } from "./tool-registry/installState";
import { getToolById, tools } from "./tool-registry/tools";
import { useToolWorkspaceState } from "./tool-registry/workspaceState";
import { ToolView } from "./tools/toolViews";

export function App() {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const { installedTools, availableTools, enableTool, disableTool, resetToolLocalState } =
    useToolInstallState(tools);
  const { getSelection, setSelection, resetSelection } = useToolWorkspaceState(tools);
  const activeTool = activeToolId ? getToolById(activeToolId) : undefined;
  const activeToolIsInstalled = activeTool
    ? installedTools.some((tool) => tool.id === activeTool.id)
    : false;

  return (
    <div className="app-frame">
      {activeTool && activeToolIsInstalled ? (
        <WorkbenchShell activeTool={activeTool} onBackToTools={() => setActiveToolId(null)}>
          {({ activeRouteId }) => <ToolView activeRouteId={activeRouteId} tool={activeTool} />}
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
        />
      )}
    </div>
  );
}
