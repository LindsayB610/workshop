import type { ComponentType } from "react";
import { WorkshopToolView as SlateWorkshopToolView } from "slate-core";
import { getToolById } from "../tool-registry/tools";
import type { ToolDefinition } from "../tool-registry/types";
import { MegaphoneTool } from "./megaphone/MegaphoneTool";
import { PulseTool } from "./pulse/PulseTool";
import { RedlineTool } from "./redline/RedlineTool";
import { ToolPlaceholder } from "./ToolPlaceholder";
import type { ToolViewProps } from "./types";

type ExternalWorkshopToolViewProps = {
  activeRouteId?: string;
  workspaceRoot?: string;
  requestWorkspaceRoot: (root?: string) => void;
};

function adaptExternalToolView(
  ExternalToolView: ComponentType<ExternalWorkshopToolViewProps>,
): ComponentType<ToolViewProps> {
  return function ExternalToolViewAdapter({
    activeRouteId,
    onSetWorkspaceRequest,
    tool,
    workspaceRoot,
  }) {
    return (
      <ExternalToolView
        activeRouteId={activeRouteId}
        workspaceRoot={workspaceRoot}
        requestWorkspaceRoot={(root) => onSetWorkspaceRequest?.(tool.id, root)}
      />
    );
  };
}

const toolViewById: Record<string, ComponentType<ToolViewProps>> = {
  megaphone: MegaphoneTool,
  pulse: PulseTool,
  redline: RedlineTool,
  slate: adaptExternalToolView(SlateWorkshopToolView),
};

export function ToolView({
  activeRouteId,
  onSetWorkspaceRequest,
  tool,
  workspaceRoot,
}: {
  activeRouteId?: string;
  onSetWorkspaceRequest?: (toolId: string) => void;
  tool: ToolDefinition;
  workspaceRoot?: string;
}) {
  const View = toolViewById[tool.id] ?? ToolPlaceholder;
  return (
    <View
      activeRouteId={activeRouteId}
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
