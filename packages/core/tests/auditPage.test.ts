import { describe, expect, it } from "vitest";
import { auditPageFromHtml } from "../src/auditPage.js";
import { extractPageFromHtml } from "../src/extract.js";
import { parseAndValidateJudgeJson } from "../src/judge.js";
import { buildJudgePrompt } from "../src/promptTemplates.js";
import { generateSinglePageReport } from "../src/report.js";
import type { Finding } from "../src/schemas.js";

const html = "<html><head><title>Demo Page</title></head><body><h1>Clear product message</h1><a href='/pricing'>Pricing</a></body></html>";
const finding: Finding = {
  id: "demo-finding-1", clientId: "demo-client", targetId: "homepage",
  url: "https://demo.example/", mode: "message_alignment", label: "Hero alignment",
  priority: "high", confidence: "high", quotedText: "Clear product message",
  issue: "The hero needs a specific audience.", suggestedFix: "Name the audience.",
  sourceRefs: ["demo-positioning"], proofNeeded: "Confirm approval.", editReadiness: "manual_review",
};

describe("page audit", () => {
  it("extracts a page and produces a readable report", () => {
    const page = extractPageFromHtml({ id: "homepage", url: finding.url, html });
    expect(page.title).toBe("Demo Page");
    expect(page.links[0]?.href).toBe("https://demo.example/pricing");
    expect(generateSinglePageReport(page, [finding]).markdown).toContain("Hero alignment");
  });

  it("validates judge output and rejects malformed findings", () => {
    const page = extractPageFromHtml({ id: "homepage", url: finding.url, html });
    expect(parseAndValidateJudgeJson(JSON.stringify({ findings: [finding] }), page).validFindings)
      .toHaveLength(1);
    expect(parseAndValidateJudgeJson(JSON.stringify({ findings: [{ id: "bad" }] }), page).invalidFindings)
      .toHaveLength(1);
  });

  it("builds a prompt that requires grounded JSON", () => {
    const page = extractPageFromHtml({ id: "homepage", url: finding.url, html });
    for (const mode of ["message_alignment", "proof_gap", "buyer_language", "objection_coverage"] as const) {
      const prompt = buildJudgePrompt(mode, page, finding.sourceRefs);
      expect(prompt).toContain("Required JSON");
      expect(prompt).toContain("demo-positioning");
    }
  });

  it("audits HTML through the public entry point", () => {
    const result = auditPageFromHtml({ id: "homepage", url: finding.url, html, judgeJson: JSON.stringify({ findings: [finding] }) });
    expect(result.judge.validFindings).toHaveLength(1);
  });
});
