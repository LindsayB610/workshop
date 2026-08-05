import { BellRing, FileText, ListTodo, Megaphone as MegaphoneIcon } from "lucide-react";
import { getToolManifest } from "./toolManifest";
import type { RecentWorkspace, ToolDefinition } from "./types";

export const tools: ToolDefinition[] = [
  {
    ...getRequiredToolManifest("slate"),
    icon: ListTodo,
    logoVariant: "slate",
    installMode: "bundled",
    defaultInstalled: false,
  },
  {
    ...getRequiredToolManifest("redline"),
    icon: FileText,
    logoVariant: "redline",
    installMode: "bundled",
    defaultInstalled: false,
  },
  {
    ...getRequiredToolManifest("megaphone"),
    icon: MegaphoneIcon,
    logoVariant: "megaphone",
    installMode: "bundled",
    defaultInstalled: false,
  },
  {
    ...getRequiredToolManifest("pulse"),
    icon: BellRing,
    logoVariant: "pulse",
    installMode: "external",
    defaultInstalled: false,
  },
];

function getRequiredToolManifest(toolId: string) {
  const manifest = getToolManifest(toolId);
  if (!manifest) {
    throw new Error(`Missing Workshop tool manifest: ${toolId}`);
  }
  return manifest;
}

export const recentWorkspaces: RecentWorkspace[] = [
  {
    id: "demo-redline-launch-review",
    label: "Northstar Demo launch review",
    clientId: "demo-redline",
    toolId: "redline",
    path: "clients/demo-redline",
    lastOpened: "2026-06-20",
  },
  {
    id: "fixture-landing-page",
    label: "Fixture Client landing page",
    clientId: "fixture",
    toolId: "redline",
    path: "clients/fixture",
    lastOpened: "2026-06-20",
  },
];

export function getToolById(toolId: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === toolId);
}

export function dataRootsAreIsolated(toolList: ToolDefinition[]): boolean {
  const seen = new Map<string, string>();

  for (const tool of toolList) {
    for (const root of tool.dataRoots) {
      const owner = seen.get(root);
      if (owner && owner !== tool.id) {
        return false;
      }
      seen.set(root, tool.id);
    }
  }

  return true;
}
