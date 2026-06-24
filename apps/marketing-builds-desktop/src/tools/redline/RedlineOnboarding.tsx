import {
  ClipboardCheck,
  FileArchive,
  FileInput,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";
import { exportOnboardingPacket, type PacketExportResult } from "./onboardingActions";
import {
  buildOnboardingPacketForSession,
  buildDemoOnboardingSession,
  defaultOnboardingDraftInput,
  summarizeOnboarding,
} from "./onboardingModel";

const readinessTone = {
  ready_to_audit: "pink",
  auditable_with_caveats: "yellow",
  blocked: "red",
} as const;

const freshnessTone = {
  current: "pink",
  possibly_stale: "yellow",
  stale: "red",
  unknown: "muted",
} as const;

const reviewTone = {
  approved: "pink",
  needs_review: "yellow",
  draft: "muted",
  rejected: "red",
} as const;

export function RedlineOnboarding() {
  const [exportResult, setExportResult] = useState<PacketExportResult | null>(null);
  const [draftInput, setDraftInput] = useState(defaultOnboardingDraftInput);
  const session = useMemo(
    () => buildDemoOnboardingSession(draftInput),
    [draftInput],
  );
  const packet = useMemo(
    () => buildOnboardingPacketForSession(session),
    [session],
  );
  const readiness = packet.readiness;
  const summary = summarizeOnboarding(session, packet);
  const clientFolder = `clients/${session.clientId}`;

  async function exportPacket() {
    setExportResult(await exportOnboardingPacket(packet, { overwrite: false }));
  }

  return (
    <section className="redline-onboarding" aria-label="Redline onboarding workflow">
      <Panel className="onboarding-overview">
        <div className="panel-heading">
          <Sparkles size={18} aria-hidden="true" />
          <h3>Onboarding</h3>
        </div>
        <div className="onboarding-hero-row">
          <div>
            <p className="eyebrow">guided packet setup</p>
            <h2>{session.clientName}</h2>
            <p className="action-note">
              Build a source-backed client packet before Redline audits anything.
            </p>
          </div>
          <Badge tone={readinessTone[readiness.level]}>{readiness.level}</Badge>
        </div>
        <div className="status-metrics compact onboarding-metrics">
          <span>
            <strong>{summary.sourceCount}</strong>
            sources
          </span>
          <span>
            <strong>{summary.approvedCanonicalCount}</strong>
            approved modules
          </span>
          <span>
            <strong>{summary.staleSourceCount}</strong>
            stale flags
          </span>
          <span>
            <strong>{summary.exportFileCount}</strong>
            packet files
          </span>
        </div>
      </Panel>

      <section className="onboarding-grid">
        <Panel className="onboarding-panel">
          <div className="panel-heading">
            <ClipboardCheck size={18} aria-hidden="true" />
            <h3>Client Setup</h3>
          </div>
          <div className="onboarding-field-grid">
            <label>
              <span>Client name</span>
              <input
                value={draftInput.clientName}
                onChange={(event) =>
                  setDraftInput((current) => ({
                    ...current,
                    clientName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Client folder</span>
              <input
                value={draftInput.clientId}
                onChange={(event) =>
                  setDraftInput((current) => ({
                    ...current,
                    clientId: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Primary audience</span>
              <input
                value={draftInput.audience}
                onChange={(event) =>
                  setDraftInput((current) => ({
                    ...current,
                    audience: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Exclusions</span>
              <input
                value={draftInput.exclusions}
                onChange={(event) =>
                  setDraftInput((current) => ({
                    ...current,
                    exclusions: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </Panel>

        <Panel className="onboarding-panel">
          <div className="panel-heading">
            <FileInput size={18} aria-hidden="true" />
            <h3>Source Intake</h3>
          </div>
          <div className="onboarding-source-list">
            {session.sourceIntake.map((source) => (
              <article key={source.id} className="onboarding-source-row">
                <div>
                  <strong>{source.title}</strong>
                  <small>
                    {source.type} / {source.tier} / {source.privacy}
                  </small>
                </div>
                <Badge tone={reviewTone[source.reviewStatus]}>{source.reviewStatus}</Badge>
              </article>
            ))}
          </div>
        </Panel>

        <Panel className="onboarding-panel">
          <div className="panel-heading">
            <ShieldAlert size={18} aria-hidden="true" />
            <h3>Trust Review</h3>
          </div>
          <div className="onboarding-source-list">
            {session.sourceIntake.map((source) => (
              <article key={source.id} className="onboarding-trust-row">
                <div>
                  <strong>{source.title}</strong>
                  <small>
                    owner: {source.owner} / confidence: {source.confidence}
                  </small>
                </div>
                <Badge tone={freshnessTone[source.freshness]}>{source.freshness}</Badge>
              </article>
            ))}
          </div>
          <div className="onboarding-caveats" aria-label="Onboarding caveats">
            {readiness.caveats.map((caveat) => (
              <p key={caveat}>{caveat}</p>
            ))}
          </div>
        </Panel>

        <Panel className="onboarding-panel">
          <div className="panel-heading">
            <ClipboardCheck size={18} aria-hidden="true" />
            <h3>Canonical Drafts</h3>
          </div>
          <div className="onboarding-source-list">
            {session.canonicalDrafts.map((draft) => (
              <article key={draft.id} className="onboarding-canonical-row">
                <div>
                  <strong>{draft.title}</strong>
                  <small>{draft.sourceRefs.join(", ")}</small>
                </div>
                <Badge tone={reviewTone[draft.reviewStatus]}>{draft.reviewStatus}</Badge>
              </article>
            ))}
          </div>
        </Panel>

        <Panel className="onboarding-panel onboarding-export-panel">
          <div className="panel-heading">
            <FileArchive size={18} aria-hidden="true" />
            <h3>Packet Export</h3>
          </div>
          <div className="summary-actions onboarding-export-actions">
            <p className="action-note">
              Export writes the packet under {packet.clientFolder} with canonical modules,
              prompts, source manifest, and onboarding brief. Existing files are not
              overwritten.
            </p>
            <Button onClick={() => void exportPacket()} variant="primary">
              <FileArchive size={16} aria-hidden="true" />
              Export Packet
            </Button>
          </div>
          <div className="onboarding-export-list">
            {packet.files.map((file) => (
              <article key={file.path} className="onboarding-export-row">
                <strong>{file.path}</strong>
                <Badge>{file.format}</Badge>
              </article>
            ))}
          </div>
          {exportResult ? (
            <p className="action-note">
              {exportResult.status === "exported"
                ? `Exported ${exportResult.fileCount} packet files for ${exportResult.clientId}.`
                : exportResult.status === "copied"
                  ? `Copied ${exportResult.fileCount} packet files for ${exportResult.clientId}.`
                  : exportResult.message}
            </p>
          ) : null}
        </Panel>

        <Panel className="onboarding-panel onboarding-brief-panel">
          <div className="panel-heading">
            <FileArchive size={18} aria-hidden="true" />
            <h3>Onboarding Brief</h3>
          </div>
          <pre>{packet.brief}</pre>
        </Panel>
      </section>
    </section>
  );
}
