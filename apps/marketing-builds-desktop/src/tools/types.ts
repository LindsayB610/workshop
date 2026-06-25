import type { ToolDefinition } from "../tool-registry/types";

export type ToolViewProps = {
  tool: ToolDefinition;
  activeRouteId?: string;
  onSetWorkspaceRequest?: (toolId: string) => void;
};
