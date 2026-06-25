import type { ComponentType } from "react";
import { getToolById } from "../tool-registry/tools";
import type { ToolDefinition } from "../tool-registry/types";
import { MegaphoneTool } from "./megaphone/MegaphoneTool";
import { PulseTool } from "./pulse/PulseTool";
import { RedlineTool } from "./redline/RedlineTool";
import { ToolPlaceholder } from "./ToolPlaceholder";
import type { ToolViewProps } from "./types";

const toolViewById: Record<string, ComponentType<ToolViewProps>> = {
  megaphone: MegaphoneTool,
  pulse: PulseTool,
  redline: RedlineTool,
};

export function ToolView({
  activeRouteId,
  onSetWorkspaceRequest,
  tool,
}: {
  activeRouteId?: string;
  onSetWorkspaceRequest?: (toolId: string) => void;
  tool: ToolDefinition;
}) {
  const View = toolViewById[tool.id] ?? ToolPlaceholder;
  return (
    <View
      activeRouteId={activeRouteId}
      onSetWorkspaceRequest={onSetWorkspaceRequest}
      tool={tool}
    />
  );
}

export function getToolViewById(toolId: string): ComponentType<ToolViewProps> | undefined {
  if (!getToolById(toolId)) {
    return undefined;
  }

  return toolViewById[toolId] ?? ToolPlaceholder;
}
