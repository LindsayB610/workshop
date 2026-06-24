import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { auditPageFromHtml } from "../src/auditPage.js";
import { extractPageFromHtml } from "../src/extract.js";
import {
  parseAndValidateJudgeJson,
  parseJudgeJson,
  validateJudgeFindings,
} from "../src/judge.js";
import { buildJudgePrompt, judgePromptTemplates } from "../src/promptTemplates.js";
import { generateSinglePageReport } from "../src/report.js";
import { agentEditPlanSchema, type AuditMode, type Finding } from "../src/schemas.js";

const htmlFixture = `
<!doctype html>
<html>
  <head>
    <title>Parasail Test Page</title>
    <meta name="description" content="Production OSS inference without the MLOps burden.">
  </head>
  <body>
    <h1>Production OSS inference without the MLOps burden.</h1>
    <h2>Dedicated performance. Token-based economics.</h2>
    <p>Public endpoints are easy until retries, latency, and rate limits hit a core workflow.</p>
    <a href="/pricing">Pricing</a>
    <script>window.noise = true;</script>
  </body>
</html>`;

const fixturesDir = fileURLToPath(new URL("./fixtures/", import.meta.url));

function validFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "finding-1",
    clientId: "parasail",
    targetId: "homepage",
    url: "https://parasail.example/",
    mode: "message_alignment",
    label: "Hero alignment",
    priority: "high",
    confidence: "high",
    quotedText: "Production OSS inference without the MLOps burden.",
    issue: "The page has a strong phrase that should anchor the hero.",
    suggestedFix: "Use the production OSS inference phrase as the primary hero frame.",
    sourceRefs: ["parasail-source-positioning"],
    proofNeeded: "Confirm this phrase is approved for launch.",
    editReadiness: "manual_review",
    ...overrides,
  };
}

describe("single-page audit", () => {
  it("extracts title, meta description, headings, body text, and links from HTML", () => {
    const page = extractPageFromHtml({
      id: "homepage",
      url: "https://parasail.example/",
      html: htmlFixture,
    });

    expect(page.title).toBe("Parasail Test Page");
    expect(page.metaDescription).toBe(
      "Production OSS inference without the MLOps burden.",
    );
    expect(page.headings).toEqual([
      "Production OSS inference without the MLOps burden.",
      "Dedicated performance. Token-based economics.",
    ]);
    expect(page.bodyText).toContain("Public endpoints are easy until retries");
    expect(page.bodyText).not.toContain("window.noise");
    expect(page.links).toEqual([
      {
        text: "Pricing",
        href: "https://parasail.example/pricing",
        isInternal: true,
      },
    ]);
  });

  it("preserves exact quotes from the extracted page", () => {
    const page = extractPageFromHtml({
      id: "homepage",
      url: "https://parasail.example/",
      html: htmlFixture,
    });

    const result = validateJudgeFindings([validFinding()], page);

    expect(result.validFindings).toHaveLength(1);
    expect(result.invalidFindings).toHaveLength(0);
  });

  it("drops hallucinated quotes as invalid findings", () => {
    const page = extractPageFromHtml({
      id: "homepage",
      url: "https://parasail.example/",
      html: htmlFixture,
    });

    const result = validateJudgeFindings(
      [validFinding({ quotedText: "The world's fastest AI inference network" })],
      page,
    );

    expect(result.validFindings).toHaveLength(0);
    expect(result.invalidFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ issue: "quoted_text_not_found" }),
      ]),
    );
  });

  it("fails findings without source references", () => {
    const page = extractPageFromHtml({
      id: "homepage",
      url: "https://parasail.example/",
      html: htmlFixture,
    });

    const result = validateJudgeFindings(
      [{ ...validFinding(), sourceRefs: [] }],
      page,
    );

    expect(result.validFindings).toHaveLength(0);
    expect(result.invalidFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ issue: "missing_source_reference" }),
      ]),
    );
  });

  it("rejects high-risk proof claims without exact target text or source refs", () => {
    const page = extractPageFromHtml({
      id: "homepage",
      url: "https://parasail.example/",
      html: htmlFixture,
    });

    const result = validateJudgeFindings(
      [
        validFinding({
          claimCategory: "metric",
          approvalStatus: "needs_client_approval",
          proofRequired: true,
          proofOwner: "Client proof owner",
          canAgentEdit: false,
          quotedText: "750B tokens served daily",
        }),
        { ...validFinding({ claimCategory: "pricing_comparison" }), sourceRefs: [] },
      ],
      page,
    );

    expect(result.validFindings).toHaveLength(0);
    expect(result.invalidFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ issue: "quoted_text_not_found" }),
        expect.objectContaining({ issue: "missing_source_reference" }),
      ]),
    );
  });

  it("repairs fenced fake LLM JSON and validates findings", () => {
    const page = extractPageFromHtml({
      id: "homepage",
      url: "https://parasail.example/",
      html: htmlFixture,
    });
    const raw = `Here is JSON:\n\n\`\`\`json\n${JSON.stringify({
      findings: [validFinding()],
    })}\n\`\`\``;

    const result = parseAndValidateJudgeJson(raw, page);

    expect(result.repaired).toBe(true);
    expect(result.parseError).toBeUndefined();
    expect(result.validFindings).toHaveLength(1);
  });

  it("reports malformed JSON parse failures", () => {
    const result = parseJudgeJson("not json at all");

    expect(result.ok).toBe(false);
  });

  it("generates stable Markdown and agent edit JSON for a single page", () => {
    const page = extractPageFromHtml({
      id: "homepage",
      url: "https://parasail.example/",
      html: htmlFixture,
    });
    const report = generateSinglePageReport(page, [validFinding()]);
    const goldenReport = readFileSync(
      `${fixturesDir}/single-page-report.golden.md`,
      "utf8",
    );

    expect(report.markdown).toBe(goldenReport);
    const agentEditPlan = JSON.parse(report.agentEditPlanJson);

    expect(agentEditPlanSchema.safeParse(agentEditPlan).success).toBe(true);
    expect(agentEditPlan).toEqual(
      expect.objectContaining({
        target: expect.objectContaining({ id: "homepage" }),
        findings: [validFinding()],
      }),
    );
  });

  it("audits HTML with fake judge JSON end to end", () => {
    const result = auditPageFromHtml({
      id: "homepage",
      url: "https://parasail.example/",
      html: htmlFixture,
      judgeJson: JSON.stringify({ findings: [validFinding()] }),
    });

    expect(result.page.title).toBe("Parasail Test Page");
    expect(result.judge.validFindings).toHaveLength(1);
    expect(result.report.markdown).toContain("Hero alignment");
  });

  it("has judge prompt templates for every Phase 2 audit mode", () => {
    const modes: AuditMode[] = [
      "message_alignment",
      "buyer_language",
      "proof_gap",
      "objection_coverage",
      "geo_readiness",
    ];
    const page = extractPageFromHtml({
      id: "homepage",
      url: "https://parasail.example/",
      html: htmlFixture,
    });

    expect(Object.keys(judgePromptTemplates).sort()).toEqual([...modes].sort());

    for (const mode of modes) {
      const prompt = buildJudgePrompt(mode, page, ["parasail-source-positioning"]);

      expect(prompt).toContain("Required JSON");
      expect(prompt).toContain("quotedText");
      expect(prompt).toContain("parasail-source-positioning");
    }
  });
});
