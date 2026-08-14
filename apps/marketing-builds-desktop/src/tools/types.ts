import type { ToolDefinition } from "../tool-registry/types";
import type { WorkspaceValidationResult } from "../tool-registry/workspaceState";

export type ToolViewProps = {
  tool: ToolDefinition;
  activeRouteId?: string;
  onSetWorkspaceRequest?: (toolId: string, root?: string) => WorkspaceValidationResult | undefined;
  onClearWorkspaceRequest?: (toolId: string) => void;
  workspaceRoot?: string;
};
