import { WorkbenchShell } from "../../app-shell/WorkbenchShell";
import { getToolById } from "../../tool-registry/tools";
import { ToolView } from "../toolViews";

const slate = getToolById("slate");

export function SlatePreview() {
  if (!slate) {
    throw new Error("Slate must be registered before it can be previewed.");
  }

  return (
    <div className="app-frame slate-preview-app">
      <WorkbenchShell activeTool={slate} onBackToTools={() => undefined} showBackToTools={false} showRouteNav={false}>
        {({ activeRouteId }) => <ToolView activeRouteId={activeRouteId} tool={slate} />}
      </WorkbenchShell>
    </div>
  );
}
