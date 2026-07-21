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

export type ToolRuntime = {
  kind: "bundled-core" | "bridge-cli" | "external-runner";
  entryPoint: string;
};

export type ToolPrivateWorkspace = {
  kind: "client-index" | "runner-root";
  requiredFields: string[];
};

export type ToolManifest = {
  id: string;
  displayName: string;
  description: string;
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
  runtime: ToolRuntime;
  privateWorkspace: ToolPrivateWorkspace;
};

export type ToolDefinition = ToolManifest & {
  icon: LucideIcon;
  logoVariant: ToolLogoVariant;
  installMode: ToolInstallMode;
  defaultInstalled: boolean;
};

export type RecentWorkspace = {
  id: string;
  label: string;
  clientId: string;
  toolId: string;
  path: string;
  lastOpened: string;
};
