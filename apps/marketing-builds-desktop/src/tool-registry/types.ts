import type { LucideIcon } from "lucide-react";

export type ToolCapability =
  | "local-workspace"
  | "file-import"
  | "connector-status"
  | "run-history"
  | "report-export";

export type ToolRoute = {
  id: string;
  label: string;
  path: string;
  sectionId?: string;
};

export type ToolLogoVariant = "redline" | "megaphone" | "pulse";

export type ToolInstallMode = "bundled" | "external";

export type ToolDefinition = {
  id: string;
  displayName: string;
  description: string;
  icon: LucideIcon;
  logoVariant: ToolLogoVariant;
  installMode: ToolInstallMode;
  defaultInstalled: boolean;
  docsPath: string;
  defaultWorkspaceRoot: string;
  workspaceRequirement: string;
  uninstallSafetyCopy: string;
  routes: ToolRoute[];
  requiredLocalCapabilities: ToolCapability[];
  dataRoots: string[];
  importActions: string[];
  exportActions: string[];
  status: "ready" | "planned";
};

export type RecentWorkspace = {
  id: string;
  label: string;
  clientId: string;
  toolId: string;
  path: string;
  lastOpened: string;
};
