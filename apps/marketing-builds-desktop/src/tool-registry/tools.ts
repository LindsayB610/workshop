import { FileText, Megaphone as MegaphoneIcon } from "lucide-react";
import type { RecentWorkspace, ToolDefinition } from "./types";

export const tools: ToolDefinition[] = [
  {
    id: "redline",
    displayName: "Redline",
    description: "Audit client pages against trusted source packets and prepare reports.",
    icon: FileText,
    logoVariant: "redline",
    installMode: "bundled",
    defaultInstalled: true,
    docsPath: "/docs/tools/redline.md",
    defaultWorkspaceRoot: "clients/demo-redline",
    workspaceRequirement: "Needs a local client packet with sources, targets, reports, and proof notes.",
    uninstallSafetyCopy: "Disabling Redline hides the tool only. Local client packets stay untouched.",
    routes: [
      { id: "audit", label: "Audit", path: "/redline/audit", sectionId: "redline-audit" },
      { id: "review", label: "Review", path: "/redline/review", sectionId: "redline-review" },
      { id: "packet", label: "Packet", path: "/redline/packet", sectionId: "redline-packet" },
      {
        id: "onboarding",
        label: "Onboarding",
        path: "/redline/onboarding",
        sectionId: "redline-onboarding",
      },
    ],
    requiredLocalCapabilities: [
      "local-workspace",
      "file-import",
      "connector-status",
      "run-history",
      "report-export",
    ],
    dataRoots: [
      "clients/{clientId}",
      "clients/{clientId}/sources",
      "clients/{clientId}/targets",
      "clients/{clientId}/reports",
    ],
    importActions: ["Import source snapshot", "Select audit target"],
    exportActions: ["Export report bundle", "Export edit brief"],
    status: "ready",
  },
  {
    id: "megaphone",
    displayName: "Megaphone",
    description: "Plan and shape campaign messages across channels from one source brief.",
    icon: MegaphoneIcon,
    logoVariant: "megaphone",
    installMode: "bundled",
    defaultInstalled: true,
    docsPath: "/docs/tools/megaphone.md",
    defaultWorkspaceRoot: "clients/demo-megaphone",
    workspaceRequirement: "Needs a local campaign corpus with source notes, examples, and package outputs.",
    uninstallSafetyCopy: "Disabling Megaphone hides the tool only. Local corpora and packages stay untouched.",
    routes: [
      {
        id: "sources",
        label: "Sources",
        path: "/megaphone/sources",
        sectionId: "megaphone-sources",
      },
      {
        id: "onboarding",
        label: "Onboarding",
        path: "/megaphone/onboarding",
        sectionId: "megaphone-onboarding",
      },
      {
        id: "strategy",
        label: "Strategy",
        path: "/megaphone/strategy",
        sectionId: "megaphone-strategy",
      },
      {
        id: "briefs",
        label: "Briefs",
        path: "/megaphone/briefs",
        sectionId: "megaphone-briefs",
      },
      {
        id: "drafts",
        label: "Drafts",
        path: "/megaphone/drafts",
        sectionId: "megaphone-drafts",
      },
      {
        id: "calendar",
        label: "Calendar",
        path: "/megaphone/calendar",
        sectionId: "megaphone-calendar",
      },
      {
        id: "measurement",
        label: "Measurement",
        path: "/megaphone/measurement",
        sectionId: "megaphone-measurement",
      },
    ],
    requiredLocalCapabilities: [
      "local-workspace",
      "file-import",
      "connector-status",
      "run-history",
      "report-export",
    ],
    dataRoots: ["tools/megaphone"],
    importActions: [],
    exportActions: ["Export post package"],
    status: "ready",
  },
];

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
