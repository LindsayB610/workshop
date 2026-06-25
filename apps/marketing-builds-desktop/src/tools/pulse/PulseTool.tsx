import { BellRing, CheckCircle2, Clock3, FileClock, FolderOpen, RadioTower } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";
import type { ToolViewProps } from "../types";

const pulseRoutes = ["active", "schedule", "history", "runner"] as const;

type PulseRoute = (typeof pulseRoutes)[number];

function isPulseRoute(routeId: string): routeId is PulseRoute {
  return pulseRoutes.some((route) => route === routeId);
}

export function PulseTool({ activeRouteId, onSetWorkspaceRequest, tool }: ToolViewProps) {
  const activeRoute: PulseRoute =
    activeRouteId && isPulseRoute(activeRouteId) ? activeRouteId : "active";

  return (
    <div className="pulse-tool">
      <Panel className="workspace-summary workspace-summary-compact" id="pulse-summary">
        <div>
          <p className="eyebrow">Self-hosted runner</p>
          <h2>Pulse</h2>
          <p>{tool.description}</p>
        </div>
        <div className="workspace-summary-actions">
          <Badge tone="yellow">Private runner required</Badge>
          <a className="mb-button mb-button-secondary" href={tool.docsPath} target="_blank" rel="noreferrer">
            <FileClock size={16} aria-hidden="true" />
            <span>Docs</span>
          </a>
        </div>
      </Panel>

      {activeRoute === "active" ? <ActivePulsePanel /> : null}
      {activeRoute === "schedule" ? <PulseSchedulePanel /> : null}
      {activeRoute === "history" ? <PulseHistoryPanel /> : null}
      {activeRoute === "runner" ? (
        <PulseRunnerPanel onSetWorkspaceRequest={() => onSetWorkspaceRequest?.(tool.id)} />
      ) : null}
    </div>
  );
}

function ActivePulsePanel() {
  return (
    <Panel className="workspace-summary" id="pulse-active">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Active</p>
          <h2>Due occurrences</h2>
        </div>
        <BellRing size={22} aria-hidden="true" />
      </div>
      <div className="empty-tool">
        <BellRing size={22} aria-hidden="true" />
        <h3>No active occurrences loaded</h3>
        <p>Connect a private Pulse runner workspace to review due items from local state.</p>
      </div>
    </Panel>
  );
}

function PulseSchedulePanel() {
  return (
    <Panel className="workspace-summary" id="pulse-schedule">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Schedule</p>
          <h2>Upcoming occurrences</h2>
        </div>
        <Clock3 size={22} aria-hidden="true" />
      </div>
      <ul className="compact-list">
        <li>
          <strong>Private config</strong>
          <span>Pulse definitions stay in the self-hosted runner config, not Workshop.</span>
        </li>
        <li>
          <strong>Recurring schedules</strong>
          <span>Workshop displays schedule state after a local Pulse data root is selected.</span>
        </li>
      </ul>
    </Panel>
  );
}

function PulseHistoryPanel() {
  return (
    <Panel className="workspace-summary" id="pulse-history">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">History</p>
          <h2>Completion history</h2>
        </div>
        <CheckCircle2 size={22} aria-hidden="true" />
      </div>
      <p>Completion history belongs to the private Pulse state file. Workshop does not copy it into shared tool data.</p>
    </Panel>
  );
}

function PulseRunnerPanel({ onSetWorkspaceRequest }: { onSetWorkspaceRequest: () => void }) {
  return (
    <Panel className="workspace-summary" id="pulse-runner">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Runner</p>
          <h2>Runner status</h2>
        </div>
        <RadioTower size={22} aria-hidden="true" />
      </div>
      <div className="metric-grid">
        <div>
          <strong>Private runner</strong>
          <span>Not connected in Workshop preview</span>
        </div>
        <div>
          <strong>Local config path</strong>
          <span>Select a private Pulse workspace root from the tool menu.</span>
        </div>
        <div>
          <strong>Data boundary</strong>
          <span>Workshop hosts the view; Pulse remains the source of truth.</span>
        </div>
      </div>
      <Button variant="secondary" onClick={onSetWorkspaceRequest}>
        <FolderOpen size={16} aria-hidden="true" />
        <span>Select local config path</span>
      </Button>
    </Panel>
  );
}
