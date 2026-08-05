import { BellRing, CheckCircle2, Clock3, FileClock, RadioTower, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";
import type { ToolViewProps } from "../types";
import { completePulseOccurrence, isPulseProxyAvailable, loadPulseSnapshot } from "./pulseBridge";

const pulseRoutes = ["active", "schedule", "history", "runner"] as const;

type PulseRoute = (typeof pulseRoutes)[number];
type PulseOccurrence = {
  id: string;
  pulseId: string;
  dueAt: string;
  state: "scheduled" | "due" | "done";
  completedAt?: string;
  completionNote?: string;
};
type PulseSnapshot = {
  pulses: Array<{ id: string; title: string; instructions?: string }>;
  state: { occurrences: PulseOccurrence[]; events: Array<{ type: string; occurrenceId?: string; at: string }> };
  checkedAt: string;
  runnerHealth?: { status: string; checkedAt: string };
};

function isPulseRoute(routeId: string): routeId is PulseRoute {
  return pulseRoutes.some((route) => route === routeId);
}

export function PulseTool({ activeRouteId, tool }: ToolViewProps) {
  const activeRoute: PulseRoute = activeRouteId && isPulseRoute(activeRouteId) ? activeRouteId : "active";
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [snapshot, setSnapshot] = useState<PulseSnapshot | null>(null);
  const [status, setStatus] = useState("Connect your private Pulse runner to load live state.");
  const pulseById = new Map(snapshot?.pulses.map((pulse) => [pulse.id, pulse]) ?? []);

  async function loadSnapshot() {
    if (!apiUrl.trim() || !apiToken.trim()) {
      setStatus("Enter the private runner URL and API token.");
      return;
    }
    setStatus("Loading private runner state…");
    try {
      const response = await loadPulseSnapshot<PulseSnapshot>(apiUrl, apiToken);
      if (response.status < 200 || response.status >= 300) {
        throw new Error(response.status === 401 ? "The runner rejected that API token." : `Runner returned ${response.status}.`);
      }
      setSnapshot(response.body);
      setStatus("Live state loaded. Workshop does not save your runner token.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Workshop could not reach the private runner.");
    }
  }

  async function markDone(occurrenceId: string, completionNote?: string) {
    if (!apiUrl.trim() || !apiToken.trim()) return;
    setStatus("Recording completion…");
    try {
      const response = await completePulseOccurrence<PulseOccurrence>(apiUrl, apiToken, occurrenceId, completionNote);
      if (response.status < 200 || response.status >= 300) throw new Error(`Runner returned ${response.status}.`);
      await loadSnapshot();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Workshop could not mark this occurrence Done.");
    }
  }

  const occurrences = snapshot?.state.occurrences ?? [];
  const due = occurrences.filter((occurrence) => occurrence.state === "due");
  const scheduled = occurrences.filter((occurrence) => occurrence.state === "scheduled").sort(byDueAt);
  const done = occurrences.filter((occurrence) => occurrence.state === "done").sort(byCompletedAt);

  return (
    <div className="pulse-tool">
      <Panel className="workspace-summary workspace-summary-compact" id="pulse-summary">
        <div>
          <p className="eyebrow">Private runner</p>
          <h2>Pulse</h2>
          <p>{tool.description}</p>
        </div>
        <div className="workspace-summary-actions">
          <Badge tone="yellow">Android push via ntfy</Badge>
          <a className="mb-button mb-button-secondary" href={tool.docsPath} target="_blank" rel="noreferrer">
            <FileClock size={16} aria-hidden="true" />
            <span>Docs</span>
          </a>
        </div>
      </Panel>

      <Panel className="workspace-summary" id="pulse-runner-connection">
        <div className="section-heading-row">
          <div><p className="eyebrow">Connection</p><h2>Private runner</h2></div>
          <RadioTower size={22} aria-hidden="true" />
        </div>
        <div className="pulse-connection-fields">
          <label>Runner URL<input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="http://127.0.0.1:8787" /></label>
          <label>API token<input type="password" value={apiToken} onChange={(event) => setApiToken(event.target.value)} placeholder="Private bearer token" /></label>
          <Button variant="secondary" onClick={() => void loadSnapshot()}><RefreshCw size={16} aria-hidden="true" /><span>Load live state</span></Button>
        </div>
        <p className="workspace-index-status" role="status">{status}</p>
        {!isPulseProxyAvailable() ? <p className="workspace-index-status">Connect a runner from the packaged Workshop desktop app.</p> : null}
      </Panel>

      {activeRoute === "active" ? <OccurrencePanel icon={<BellRing size={22} aria-hidden="true" />} title="Due occurrences" empty="No active occurrences loaded." occurrences={due} pulseById={pulseById} completionNotes={completionNotes} onCompletionNoteChange={(occurrenceId, note) => setCompletionNotes((current) => ({ ...current, [occurrenceId]: note }))} onDone={markDone} /> : null}
      {activeRoute === "schedule" ? <OccurrencePanel icon={<Clock3 size={22} aria-hidden="true" />} title="Upcoming occurrences" empty="No upcoming occurrences loaded." occurrences={scheduled} pulseById={pulseById} /> : null}
      {activeRoute === "history" ? <OccurrencePanel icon={<CheckCircle2 size={22} aria-hidden="true" />} title="Completion history" empty="No completion history loaded." occurrences={done} pulseById={pulseById} /> : null}
      {activeRoute === "runner" ? <RunnerPanel snapshot={snapshot} /> : null}
    </div>
  );
}

function OccurrencePanel({ icon, title, empty, occurrences, pulseById, completionNotes, onCompletionNoteChange, onDone }: { icon: React.ReactNode; title: string; empty: string; occurrences: PulseOccurrence[]; pulseById: Map<string, { id: string; title: string; instructions?: string }>; completionNotes?: Record<string, string>; onCompletionNoteChange?: (id: string, note: string) => void; onDone?: (id: string, completionNote?: string) => Promise<void> }) {
  return <Panel className="workspace-summary" id={`pulse-${title.toLowerCase().replaceAll(" ", "-")}`}><div className="section-heading-row"><div><p className="eyebrow">Pulse</p><h2>{title}</h2></div>{icon}</div>{occurrences.length === 0 ? <div className="empty-tool"><BellRing size={22} aria-hidden="true" /><h3>{empty}</h3></div> : <ul className="compact-list">{occurrences.map((occurrence) => <li key={occurrence.id}><strong>{pulseById.get(occurrence.pulseId)?.title ?? occurrence.pulseId}</strong><span>{occurrence.state === "done" ? `Completed ${formatDate(occurrence.completedAt)}` : `Due ${formatDate(occurrence.dueAt)}`}{occurrence.completionNote ? ` · ${occurrence.completionNote}` : ""}</span>{onDone ? <div className="pulse-done-controls"><label>Completion note (optional)<input value={completionNotes?.[occurrence.id] ?? ""} onChange={(event) => onCompletionNoteChange?.(occurrence.id, event.target.value)} /></label><Button variant="secondary" onClick={() => void onDone(occurrence.id, completionNotes?.[occurrence.id])}>Done</Button></div> : null}</li>)}</ul>}</Panel>;
}

function RunnerPanel({ snapshot }: { snapshot: PulseSnapshot | null }) {
  return <Panel className="workspace-summary" id="pulse-runner"><div className="section-heading-row"><div><p className="eyebrow">Runner</p><h2>Runner status</h2></div><RadioTower size={22} aria-hidden="true" /></div><div className="metric-grid"><div><strong>Connection</strong><span>{snapshot ? "Live private runner" : "Not connected"}</span></div><div><strong>Last checked</strong><span>{snapshot ? formatDate(snapshot.checkedAt) : "—"}</span></div><div><strong>Runner health</strong><span>{snapshot?.runnerHealth?.status ?? "Unknown"}</span></div></div></Panel>;
}

function byDueAt(a: PulseOccurrence, b: PulseOccurrence) { return Date.parse(a.dueAt) - Date.parse(b.dueAt); }
function byCompletedAt(a: PulseOccurrence, b: PulseOccurrence) { return Date.parse(b.completedAt ?? b.dueAt) - Date.parse(a.completedAt ?? a.dueAt); }
function formatDate(value: string | undefined) { return value ? new Date(value).toLocaleString() : "—"; }
