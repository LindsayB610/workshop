import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getToolById } from "../../tool-registry/tools";
import { MegaphoneTool } from "./MegaphoneTool";
import {
  buildMegaphoneArtifacts,
  bridgeMegaphoneWorkspace,
  getMegaphoneWorkspace,
} from "./megaphoneData";

const megaphoneTool = getToolById("megaphone");
const testDir = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(testDir, "../../styles/app.css"), "utf8");

describe("MegaphoneTool", () => {
  it("renders the Northstar Demo Co. Megaphone workspace from fixture data", () => {
    if (!megaphoneTool) {
      throw new Error("Megaphone tool is not registered.");
    }

    const markup = renderToStaticMarkup(<MegaphoneTool tool={megaphoneTool} />);

    expect(markup).toContain("Northstar Demo Co.");
    expect(markup).toContain("Brightbeam Analytics");
    expect(markup).toContain("Avery Stone");
    expect(markup).toContain("Brand client");
    expect(markup).toContain("Client Mode");
    expect(markup).toContain("company LinkedIn page");
    expect(markup).toContain("clients/demo-megaphone");
    expect(markup).toContain("id=\"megaphone-sources\"");
    expect(markup).not.toContain("Active Post Package");
    expect(markup).not.toContain("New Client Onboarding");
    expect(markup).not.toContain("Post package stages");
    expect(markup).not.toContain("Generated Artifacts");
    expect(markup).not.toContain("Local AI Drafting");
  });

  it("keeps secondary Megaphone screens out of the default sources screen", () => {
    if (!megaphoneTool) {
      throw new Error("Megaphone tool is not registered.");
    }

    const markup = renderToStaticMarkup(<MegaphoneTool tool={megaphoneTool} />);

    expect(markup).toContain("Load Client Folder");
    expect(markup).toContain("Create Brief");
    expect(markup).toContain("Export Package");
    expect(markup).toContain("Create a post brief before exporting a package.");
    expect(markup).not.toContain("Calendar");
    expect(markup).not.toContain("Measurement");
    expect(markup).not.toContain("Relevant commenters");
    expect(markup).not.toContain("empty-tool");
  });

  it("keeps guided client onboarding behind the Onboarding screen", () => {
    if (!megaphoneTool) {
      throw new Error("Megaphone tool is not registered.");
    }

    const markup = renderToStaticMarkup(<MegaphoneTool tool={megaphoneTool} />);

    expect(markup).not.toContain("New Client Onboarding");
    expect(markup).not.toContain("Client onboarding steps");
    expect(markup).not.toContain("Account mode");
    expect(markup).not.toContain("Client profile");
    expect(markup).not.toContain("Source intake");
    expect(markup).not.toContain("Canonical packet");
    expect(markup).not.toContain("Claims and voice");
    expect(markup).not.toContain("Export Client Packet");
    expect(markup).not.toContain("Guided setup exports reviewable onboarding files");
    expect(markup).not.toContain("Client packet generation is modeled in core");
    expect(markup).not.toContain("Guided setup now creates a packet plan");
  });

  it("renders only the selected Megaphone function screen", () => {
    if (!megaphoneTool) {
      throw new Error("Megaphone tool is not registered.");
    }

    const briefsMarkup = renderToStaticMarkup(
      <MegaphoneTool activeRouteId="briefs" tool={megaphoneTool} />,
    );

    expect(briefsMarkup).toContain("Active Post Package");
    expect(briefsMarkup).not.toContain("Client Mode");
    expect(briefsMarkup).not.toContain("Generated Artifacts");

    const draftsMarkup = renderToStaticMarkup(
      <MegaphoneTool activeRouteId="drafts" tool={megaphoneTool} />,
    );

    expect(draftsMarkup).toContain("Generated Artifacts");
    expect(draftsMarkup).toContain("Local AI Drafting");
    expect(draftsMarkup).toContain("gpt-5-mini");
    expect(draftsMarkup).toContain("missing_credentials");
    expect(draftsMarkup).toContain("Test Connection");
    expect(draftsMarkup).toContain("Generate AI Drafts");
    expect(draftsMarkup).toContain("AI model");
    expect(draftsMarkup).toContain("gpt-5");
    expect(draftsMarkup).toContain("gpt-4.1-mini");
    expect(draftsMarkup).toContain("OpenAI API key");
    expect(draftsMarkup).toContain("Save Key");
    expect(draftsMarkup).toContain("Clear Key");
    expect(draftsMarkup).toContain("Contextual AI chat");
    expect(draftsMarkup).toContain("Documents and notes");
    expect(draftsMarkup).toContain("Chat With Context");
    expect(draftsMarkup).toContain("megaphone/.env.local.example");
    expect(draftsMarkup).toContain("deterministic fallback is active");
    expect(draftsMarkup).not.toContain("Active Post Package");
    expect(draftsMarkup).not.toContain("Client Mode");
  });

  it("keeps onboarding data client-specific", () => {
    const demoMegaphone = getMegaphoneWorkspace("demo-megaphone");
    const brightbeam = getMegaphoneWorkspace("brightbeam");
    const demoInfluencer = getMegaphoneWorkspace("demo-influencer");
    const demoMegaphoneOutputs = demoMegaphone.onboarding.steps.flatMap(
      (step) => step.expectedOutputs,
    );

    expect(demoMegaphone.onboarding.generatedPacketPath).toBe("clients/demo-megaphone");
    expect(demoMegaphoneOutputs).toEqual(
      expect.arrayContaining([
        "client.yaml",
        "source-manifest.json",
        "onboarding/readiness-report.md",
        "onboarding/first-brief-queue.json",
      ]),
    );
    expect(brightbeam.onboarding.generatedPacketPath).toBe("clients/brightbeam");
    expect(JSON.stringify(brightbeam.onboarding).toLowerCase()).not.toContain("demo-megaphone");
    expect(demoInfluencer.onboarding.generatedPacketPath).toBe("clients/demo-influencer");
    expect(JSON.stringify(demoInfluencer.onboarding).toLowerCase()).toContain(
      "workshop-export-transcript",
    );
    expect(demoInfluencer.onboarding.exportFiles?.length).toBe(3);
    expect(JSON.stringify(demoInfluencer.onboarding.exportFiles)).toContain("client-mode.md");
    expect(JSON.stringify(demoInfluencer).toLowerCase()).not.toContain("brightbeam");
    expect(JSON.stringify(demoInfluencer).toLowerCase()).not.toContain("demo-megaphone");
  });

  it("bridges loaded client packet summaries into the visible workspace", () => {
    const demoMegaphone = getMegaphoneWorkspace("demo-megaphone");
    const bridged = bridgeMegaphoneWorkspace(
      demoMegaphone,
      {
        clientId: "demo-megaphone",
        clientName: "Northstar Demo Co. From Disk",
        clientType: "brand",
        path: "clients/demo-megaphone",
        readiness: "source_review_needed",
        sourceCount: 42,
        researchFiles: 9,
        artifactPaths: [
          "clients/demo-megaphone/post-packages/from-disk/brief.md",
          "clients/demo-megaphone/post-packages/from-disk/measurement-tags.json",
        ],
        calendarItems: [
          {
            id: "demo-megaphone-package-1",
            date: "Unscheduled",
            topic: "from disk",
            postType: "evaluation_guide",
            pillar: "artifact_pillar",
            draftReadiness: "manual_review",
          },
        ],
        measurementSignals: [
          {
            label: "Post packages",
            value: "1",
            caveat: "Loaded from local Megaphone post-package artifacts.",
          },
        ],
        warnings: ["Client packet readiness is source_review_needed."],
      },
      null,
    );

    expect(bridged.bridgeStatus).toBe("loaded");
    expect(bridged.clientName).toBe("Northstar Demo Co. From Disk");
    expect(bridged.clientType).toBe("brand");
    expect(bridged.readiness).toBe("source_review_needed");
    expect(bridged.sourceCount).toBe(42);
    expect(bridged.researchFiles).toBe(9);
    expect(bridged.pipeline.find((stage) => stage.id === "brief")?.status).toBe("ready");
    expect(bridged.calendarItems[0]?.pillar).toBe("artifact_pillar");
    expect(bridged.measurementSignals[0]?.value).toBe("1");
    expect(bridged.warnings).toContain("Client packet readiness is source_review_needed.");
  });

  it("shows honest empty states when loaded packets have no post artifacts", () => {
    const brightbeam = getMegaphoneWorkspace("brightbeam");
    const bridged = bridgeMegaphoneWorkspace(
      brightbeam,
      {
        clientId: "brightbeam",
        clientName: "Brightbeam Analytics",
        clientType: "brand",
        path: "clients/brightbeam",
        readiness: "ready_to_brief",
        sourceCount: 3,
        researchFiles: 2,
        artifactPaths: [],
        calendarItems: [],
        measurementSignals: [],
        warnings: [],
      },
      null,
    );

    expect(bridged.bridgeStatus).toBe("loaded");
    expect(bridged.calendarItems).toEqual([]);
    expect(bridged.measurementSignals).toEqual([
      {
        label: "Package artifacts",
        value: "0",
        caveat: "Create or load a post package before reading performance guidance.",
      },
    ]);
    expect(bridged.pipeline.find((stage) => stage.id === "measurement")?.status).toBe(
      "blocked",
    );
  });

  it("derives calendar and measurement views from created package files", () => {
    const demoMegaphone = getMegaphoneWorkspace("demo-megaphone");
    const bridged = bridgeMegaphoneWorkspace(
      demoMegaphone,
      {
        clientId: "demo-megaphone",
        clientName: "Northstar Demo Co.",
        clientType: "brand",
        path: "clients/demo-megaphone",
        readiness: "ready_to_brief",
        sourceCount: 31,
        researchFiles: 14,
        artifactPaths: [],
        calendarItems: [],
        measurementSignals: [],
        warnings: [],
      },
      {
        status: "created",
        packageRoot: "clients/demo-megaphone/post-packages/core-created",
        files: [
          {
            path: "clients/demo-megaphone/post-packages/core-created/brief.json",
            contents:
              '{"topic":"core-created package","postType":"visual_explainer","contentPillar":"operational_control"}\n',
          },
          {
            path: "clients/demo-megaphone/post-packages/core-created/example-guidance.md",
            contents: "# Example-Guided Drafting Notes\n\n- Example influence IDs: lirepo-1\n",
          },
        ],
      },
    );

    expect(bridged.calendarItems[0]).toMatchObject({
      topic: "core-created package",
      postType: "visual_explainer",
      pillar: "operational_control",
    });
    expect(bridged.measurementSignals).toEqual(
      expect.arrayContaining([
        {
          label: "Content pillar",
          value: "operational_control",
          caveat: "Derived from package brief JSON.",
        },
      ]),
    );
    expect(buildMegaphoneArtifacts(bridged.calendarItems.length ? [
      {
        path: "clients/demo-megaphone/post-packages/core-created/example-guidance.md",
        contents: "# Example-Guided Drafting Notes\n",
      },
    ] : [])[0]?.label).toBe("Example Guidance");
  });

  it("keeps Megaphone usable at narrow widths", () => {
    expect(styles).toContain("@media (max-width: 880px)");
    expect(styles).toContain(".megaphone-signal-list");
    expect(styles).toContain(".workbench-route-nav");
    expect(styles).toContain(".connector-status-strip");
    expect(styles).toContain(".megaphone-post-type-grid");
    expect(styles).toContain(".megaphone-toggle-row");
    expect(styles).toContain(".summary-details.compact");
    expect(styles).toContain(".compact-heading");
    expect(styles).toContain(".local-ai-credential-row");
    expect(styles).toContain("@media (max-width: 620px)");
  });

  it("keeps second-client workspace data isolated from Northstar Demo Co.", () => {
    const brightbeam = getMegaphoneWorkspace("brightbeam");
    const serialized = JSON.stringify(brightbeam).toLowerCase();

    expect(brightbeam.clientName).toBe("Brightbeam Analytics");
    expect(brightbeam.packetPath).toBe("clients/brightbeam");
    expect(brightbeam.activePostType).toBe("evaluation_guide");
    expect(brightbeam.exampleCorpusStatus).toBe("not_imported");
    expect(serialized).not.toContain("demo-megaphone");
    expect(serialized).not.toContain("gpu");
    expect(serialized).not.toContain("inference");
    expect(serialized).not.toContain("endpoint");
  });

  it("surfaces the demo influencer proof without fixture leakage", () => {
    const demoInfluencer = getMegaphoneWorkspace("demo-influencer");
    const serialized = JSON.stringify(demoInfluencer).toLowerCase();

    expect(demoInfluencer.clientName).toBe("Avery Stone");
    expect(demoInfluencer.clientType).toBe("influencer");
    expect(demoInfluencer.packetPath).toBe("clients/demo-influencer");
    expect(demoInfluencer.exampleCorpusStatus).toBe("not_imported");
    expect(demoInfluencer.activeBriefTopic).toBe(
      "what to inspect before hiring workflow narrative consulting help",
    );
    expect(demoInfluencer.measurementSignals).toEqual(
      expect.arrayContaining([
        {
          label: "Review status",
          value: "Phase proof approved",
          caveat: "Consultant review notes are captured in the client onboarding folder.",
        },
      ]),
    );
    expect(serialized).not.toContain("gpu");
    expect(serialized).not.toContain("inference");
    expect(serialized).not.toContain("endpoint");
  });
});
