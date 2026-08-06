import type { ToolManifest } from "./types";
import { workshopPluginDeclaration as pulsePluginDeclaration } from "@marketing-builds/pulse/workshop-plugin";
import { workshopPluginDeclaration } from "slate-core";

export const toolManifests: ToolManifest[] = [
  {
    ...workshopPluginDeclaration,
    defaultWorkspaceRoot: "",
    requiredLocalCapabilities: [...workshopPluginDeclaration.requiredLocalCapabilities],
    navigationMode: "plugin",
  },
  {
    ...pulsePluginDeclaration,
    defaultWorkspaceRoot: "",
    routes: pulsePluginDeclaration.routes.map((route) => ({ ...route })),
    requiredLocalCapabilities: [...pulsePluginDeclaration.requiredLocalCapabilities],
    dataRoots: [...pulsePluginDeclaration.dataRoots],
    importActions: [...pulsePluginDeclaration.importActions],
    exportActions: [...pulsePluginDeclaration.exportActions],
    navigationMode: "plugin",
    privateWorkspace: {
      kind: pulsePluginDeclaration.privateWorkspace.kind,
      requiredFields: [...pulsePluginDeclaration.privateWorkspace.requiredFields],
    },
  },
  {
    id: "redline",
    displayName: "Redline",
    description: "Audit client pages against trusted source packets and prepare reports.",
    docsPath: "/docs/tools/redline.md",
    defaultWorkspaceRoot: "clients/demo-redline",
    workspaceRequirement: "Needs a local client packet with sources, targets, reports, and proof notes.",
    uninstallSafetyCopy: "Disabling Redline hides the tool only. Local client packets stay untouched.",
    routes: [
      { id: "audit", label: "Audit", path: "/redline/audit", sectionId: "redline-audit" },
      { id: "review", label: "Review", path: "/redline/review", sectionId: "redline-review" },
      { id: "packet", label: "Packet", path: "/redline/packet", sectionId: "redline-packet" },
      { id: "onboarding", label: "Onboarding", path: "/redline/onboarding", sectionId: "redline-onboarding" },
    ],
    navigationMode: "host",
    requiredLocalCapabilities: [
      "local-workspace",
      "file-import",
      "connector-status",
      "run-history",
      "report-export",
    ],
    dataRoots: ["clients/{clientId}", "clients/{clientId}/sources", "clients/{clientId}/targets", "clients/{clientId}/reports"],
    importActions: ["Import source snapshot", "Select audit target"],
    exportActions: ["Export report bundle", "Export edit brief"],
    status: "planned",
    runtime: { kind: "bundled-core", entryPoint: "@redline/core" },
    privateWorkspace: { kind: "client-index", requiredFields: ["workspace.yaml", "client.yaml"] },
  },
  {
    id: "megaphone",
    displayName: "Megaphone",
    description: "Plan and shape campaign messages across channels from one source brief.",
    docsPath: "/docs/tools/megaphone.md",
    defaultWorkspaceRoot: "clients/demo-megaphone",
    workspaceRequirement: "Needs a local campaign corpus with source notes, examples, and package outputs.",
    uninstallSafetyCopy: "Disabling Megaphone hides the tool only. Local corpora and packages stay untouched.",
    routes: [
      { id: "sources", label: "Sources", path: "/megaphone/sources", sectionId: "megaphone-sources" },
      { id: "onboarding", label: "Onboarding", path: "/megaphone/onboarding", sectionId: "megaphone-onboarding" },
      { id: "strategy", label: "Strategy", path: "/megaphone/strategy", sectionId: "megaphone-strategy" },
      { id: "briefs", label: "Briefs", path: "/megaphone/briefs", sectionId: "megaphone-briefs" },
      { id: "drafts", label: "Drafts", path: "/megaphone/drafts", sectionId: "megaphone-drafts" },
      { id: "calendar", label: "Calendar", path: "/megaphone/calendar", sectionId: "megaphone-calendar" },
      { id: "measurement", label: "Measurement", path: "/megaphone/measurement", sectionId: "megaphone-measurement" },
    ],
    navigationMode: "host",
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
    status: "planned",
    runtime: { kind: "bridge-cli", entryPoint: "@megaphone/core/bridgeCli" },
    privateWorkspace: { kind: "client-index", requiredFields: ["workspace.yaml", "client.yaml"] },
  },
];

export function getToolManifest(toolId: string): ToolManifest | undefined {
  return toolManifests.find((manifest) => manifest.id === toolId);
}
