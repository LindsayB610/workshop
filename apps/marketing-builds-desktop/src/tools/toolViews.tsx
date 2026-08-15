import { lazy, Suspense, type ComponentType } from "react";
import { getToolById } from "../tool-registry/tools";
import type { ToolDefinition } from "../tool-registry/types";
import type { WorkspaceValidationResult } from "../tool-registry/workspaceState";
import { MegaphoneTool } from "./megaphone/MegaphoneTool";
import { RedlineTool } from "./redline/RedlineTool";
import { ToolPlaceholder } from "./ToolPlaceholder";
import type { ToolViewProps } from "./types";

type ExternalWorkshopToolViewProps = {
  activeRouteId?: string;
  workspaceRoot?: string;
  requestWorkspaceRoot: (root?: string) => { ok: true } | { ok: false; message: string } | void;
  clearWorkspaceRoot?: () => void;
};

function lazyExternalToolView(
  load: () => Promise<{ WorkshopToolView: ComponentType<ExternalWorkshopToolViewProps> }>,
): ComponentType<ToolViewProps> {
  const ExternalToolView = lazy(async () => ({ default: (await load()).WorkshopToolView }));

  return function LazyExternalToolViewAdapter(props) {
    const clearWorkspaceRoot = props.onClearWorkspaceRequest;
    return (
      <Suspense fallback={<section aria-label={`${props.tool.displayName} is loading`}>Loading {props.tool.displayName}…</section>}>
        <ExternalToolView
          activeRouteId={props.activeRouteId}
          workspaceRoot={props.workspaceRoot}
          requestWorkspaceRoot={(root) => props.onSetWorkspaceRequest?.(props.tool.id, root)}
          clearWorkspaceRoot={clearWorkspaceRoot ? () => clearWorkspaceRoot(props.tool.id) : undefined}
        />
      </Suspense>
    );
  };
}

const toolViewById: Record<string, ComponentType<ToolViewProps>> = {
  megaphone: MegaphoneTool,
  pulse: lazyExternalToolView(() => import("@marketing-builds/pulse/workshop-plugin")),
  redline: RedlineTool,
  slate: lazyExternalToolView(() => import("slate-core")),
};

export function ToolView({
  activeRouteId,
  onClearWorkspaceRequest,
  onSetWorkspaceRequest,
  tool,
  workspaceRoot,
}: {
  activeRouteId?: string;
  onSetWorkspaceRequest?: (toolId: string, root?: string) => WorkspaceValidationResult | undefined;
  onClearWorkspaceRequest?: (toolId: string) => void;
  tool: ToolDefinition;
  workspaceRoot?: string;
}) {
  const View = toolViewById[tool.id] ?? ToolPlaceholder;
  return (
    <View
      activeRouteId={activeRouteId}
      onClearWorkspaceRequest={onClearWorkspaceRequest}
      onSetWorkspaceRequest={onSetWorkspaceRequest}
      tool={tool}
      workspaceRoot={workspaceRoot}
    />
  );
}

export function getToolViewById(toolId: string): ComponentType<ToolViewProps> | undefined {
  if (!getToolById(toolId)) {
    return undefined;
  }

  return toolViewById[toolId] ?? ToolPlaceholder;
}
