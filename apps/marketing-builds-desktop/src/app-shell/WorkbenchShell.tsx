import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { ToolCapability, ToolDefinition } from "../tool-registry/types";
import { SettingsPanel } from "./SettingsPanel";
import { ToolLogo } from "./ToolLogo";
import {
  dispatchWorkbenchRouteSelected,
  WORKBENCH_ROUTE_SELECTED_EVENT,
  type WorkbenchRouteSelectedDetail,
} from "./workbenchRouteEvents";

const capabilityLabels: Record<ToolCapability, string> = {
  "local-workspace": "Local workspace",
  "file-import": "File import",
  "connector-status": "Connector status",
  "run-history": "Run history",
  "report-export": "Report export",
};

const readyCapabilities = new Set<ToolCapability>(["local-workspace", "run-history"]);

type WorkbenchShellChildren =
  | ReactNode
  | ((state: { activeRouteId: string }) => ReactNode);

export function WorkbenchShell({
  activeTool,
  onBackToTools,
  children,
}: {
  activeTool: ToolDefinition;
  onBackToTools: () => void;
  children: WorkbenchShellChildren;
}) {
  const [activeRouteId, setActiveRouteId] = useState(activeTool.routes[0]?.id ?? "");

  useEffect(() => {
    setActiveRouteId(activeTool.routes[0]?.id ?? "");
  }, [activeTool.id, activeTool.routes]);

  useEffect(() => {
    function handleWorkbenchRouteSelected(event: Event) {
      const detail = (event as CustomEvent<WorkbenchRouteSelectedDetail>).detail;
      if (detail.toolId !== activeTool.id) {
        return;
      }

      const route = activeTool.routes.find((candidate) => candidate.id === detail.routeId);
      if (!route) {
        return;
      }

      setActiveRouteId(route.id);
    }

    window.addEventListener(WORKBENCH_ROUTE_SELECTED_EVENT, handleWorkbenchRouteSelected);
    return () => {
      window.removeEventListener(WORKBENCH_ROUTE_SELECTED_EVENT, handleWorkbenchRouteSelected);
    };
  }, [activeTool.id, activeTool.routes]);

  function selectRoute(routeId: string) {
    const route = activeTool.routes.find((candidate) => candidate.id === routeId);
    if (!route) {
      return;
    }

    dispatchWorkbenchRouteSelected(activeTool.id, route);
  }

  return (
    <div className="workbench-shell">
      <main className="shell-main">
        <header className="shell-header">
          <button type="button" className="back-to-tools" onClick={onBackToTools}>
            <ArrowLeft size={17} aria-hidden="true" />
            <span>Tools</span>
          </button>
          <div className="workspace-title">
            <ToolLogo tool={activeTool} />
            <div>
              <p className="eyebrow">Workshop / {activeTool.id}</p>
              <h1>{activeTool.displayName}</h1>
            </div>
          </div>
        </header>
        <nav className="workbench-route-nav" aria-label={`${activeTool.displayName} functions`}>
          {activeTool.routes.map((route) => {
            return (
              <button
                key={route.id}
                aria-current={route.id === activeRouteId ? "page" : undefined}
                data-route-path={route.path}
                onClick={() => selectRoute(route.id)}
                type="button"
              >
                {route.label}
              </button>
            );
          })}
        </nav>
        <section className="connector-status-strip" aria-label="Shared connector status">
          {activeTool.requiredLocalCapabilities.map((capability) => {
            const ready = readyCapabilities.has(capability);

            return (
              <span
                key={capability}
                className={ready ? "capability-status-ready" : "capability-status-pending"}
              >
                <strong>{capabilityLabels[capability]}</strong>
                <small>{ready ? "Ready" : "Pending workflow"}</small>
              </span>
            );
          })}
        </section>
        <div className="workspace-body">
          {typeof children === "function" ? children({ activeRouteId }) : children}
        </div>
        <SettingsPanel />
      </main>
    </div>
  );
}
