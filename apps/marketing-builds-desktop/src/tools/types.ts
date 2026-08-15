import type { ToolDefinition } from "../tool-registry/types";
import type { WorkspaceValidationResult } from "../tool-registry/workspaceState";
import type { WorkspaceRootBrowseResult } from "./workspaceRootBrowse";

export type ToolViewProps = {
  tool: ToolDefinition;
  activeRouteId?: string;
  onSetWorkspaceRequest?: (toolId: string, root?: string) => WorkspaceValidationResult | undefined;
  onClearWorkspaceRequest?: (toolId: string) => void;
  browseWorkspaceRoot?: () => WorkspaceRootBrowseResult | void | Promise<WorkspaceRootBrowseResult | void>;
  workspaceRoot?: string;
};
