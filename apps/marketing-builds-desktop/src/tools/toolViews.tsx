import type { ComponentType } from "react";
import { WorkshopToolView as PulseWorkshopToolView } from "@marketing-builds/pulse/workshop-plugin";
import { WorkshopToolView as SlateWorkshopToolView } from "slate-core";
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

function adaptExternalToolView(
  ExternalToolView: ComponentType<ExternalWorkshopToolViewProps>,
): ComponentType<ToolViewProps> {
  return function ExternalToolViewAdapter({
    activeRouteId,
    onClearWorkspaceRequest,
    onSetWorkspaceRequest,
    tool,
    workspaceRoot,
  }) {
    return (
      <ExternalToolView
        activeRouteId={activeRouteId}
        workspaceRoot={workspaceRoot}
        requestWorkspaceRoot={(root) => onSetWorkspaceRequest?.(tool.id, root)}
        clearWorkspaceRoot={onClearWorkspaceRequest ? () => onClearWorkspaceRequest(tool.id) : undefined}
      />
    );
  };
}

const toolViewById: Record<string, ComponentType<ToolViewProps>> = {
  megaphone: MegaphoneTool,
  pulse: adaptExternalToolView(PulseWorkshopToolView),
  redline: RedlineTool,
  slate: adaptExternalToolView(SlateWorkshopToolView),
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
