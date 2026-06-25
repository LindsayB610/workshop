import { describe, expect, it } from "vitest";
import { extractPageFromHtml } from "../src/extract.js";
import { validateRedlineJudgeResponse } from "../src/judge.js";
import type { RedlineJudgeResponse, RedlinePromptsFile } from "../src/schemas.js";

const acmePrompts: RedlinePromptsFile = {
  version: "1",
  prompts: [
    {
      id: "sast-best",
      text: "What is the best SAST tool?",
      weight: 1,
      tags: ["sast", "code"],
    },
    {
      id: "container-security",
      text: "How do I scan my container images for vulnerabilities?",
      weight: 1,
      tags: ["container"],
    },
  ],
  canonical_messaging: [
    {
      title: "What Acme is NOT",
      body: "Acme is not a CSPM tool, not a SIEM, not a runtime detection product.",
    },
  ],
};

const navHtml = `<!DOCTYPE html><html><head><title>Hello</title>
<link rel="canonical" href="https://example.com/canon">
<meta name="description" content="A page about widgets.">
<meta property="article:modified_time" content="2026-01-02T03:04:05Z">
</head>
<body>
<nav>
  <a href="/products/sast">SAST</a>
  <a href="/products/container">Container</a>
  <a href="/products/iac">IaC</a>
  <a href="/products/apprisk">AppRisk</a>
  <a href="/products/aitrust">AI Trust</a>
</nav>
<main>
<h1>Widgets</h1>
<p>Widgets help you ship secure code. We sell widgets in many flavors.</p>
<p>Our widgets are best-in-class — try them today.</p>
</main>
<footer><a href="/legal">Legal</a></footer>
</body></html>`;

const containerHtml = `<!DOCTYPE html><html lang="en">
<head>
  <title>Acme Container — Cloud Container Security</title>
  <link rel="canonical" href="/products/container.html">
  <meta name="description" content="Container security with runtime threat detection (out-of-date page).">
  <meta property="article:modified_time" content="2024-09-12T00:00:00Z">
</head>
<body>
  <nav><a href="/">Home</a></nav>
  <main>
    <h1>Acme Container Security</h1>
    <p>Acme Container scans container images and Kubernetes workloads
    for vulnerabilities. It integrates with your registry and provides
    base-image recommendations.</p>
    <p>Continuous runtime threat detection across AWS, Azure, and GCP.</p>
    <p>Acme Container also surfaces compliance findings through the
    deprecated Acme Cloud Compliance integration.</p>
  </main>
  <footer><a href="/">Home</a></footer>
</body>
</html>`;

function redlineResponse(
  overrides: Partial<RedlineJudgeResponse> = {},
): RedlineJudgeResponse {
  return {
    primary_label: "Contradictory",
    secondary_labels: ["Stale"],
    confidence: 0.9,
    affected_prompts: ["container-security"],
    suggested_action: "REWRITE",
    page_summary: {
      current_focus:
        "Positions Acme Container as a runtime threat-detection product.",
      should_focus_on:
        "Acme Container handles image and Kubernetes vulnerability scanning.",
    },
    findings: [
      {
        id: "f1",
        kind: "contradicts_canonical",
        severity: "high",
        quoted_text: "Continuous runtime threat detection across AWS, Azure, and GCP.",
        location_hint: "Body, mid-section paragraph",
        issue: "Runtime threat detection is not an Acme capability.",
        suggested_fix: "Delete this sentence entirely.",
      },
    ],
    edit_plan: {
      summary: "Remove runtime CSPM claim.",
      remove: ["The runtime threat-detection sentence"],
    },
    rationale:
      "This page claims a capability that canonical messaging explicitly disowns. It should be rewritten so answer engines do not associate Acme with runtime CSPM.",
    ...overrides,
  };
}

describe("Redline contract parity", () => {
  it("excludes nav and footer text from body while extracting full-DOM links", () => {
    const page = extractPageFromHtml({
      id: "widgets",
      url: "https://example.com/",
      html: navHtml,
      thinThreshold: 5,
    });

    expect(page.bodyText).toContain("Widgets help you ship secure code.");
    expect(page.bodyText).not.toContain("SAST");
    expect(page.bodyText).not.toContain("Legal");
    expect(page.links.map((link) => link.href)).toEqual([
      "https://example.com/products/sast",
      "https://example.com/products/container",
      "https://example.com/products/iac",
      "https://example.com/products/apprisk",
      "https://example.com/products/aitrust",
      "https://example.com/legal",
    ]);
  });

  it("extracts Redline-style page metadata and thin-shell state", () => {
    const page = extractPageFromHtml({
      id: "widgets",
      url: "https://example.com/",
      html: navHtml,
      thinThreshold: 5,
    });

    expect(page.title).toBe("Hello");
    expect(page.metaDescription).toBe("A page about widgets.");
    expect(page.canonicalUrl).toBe("https://example.com/canon");
    expect(page.lastModified).toBe("2026-01-02T03:04:05Z");
    expect(page.isEmptyShell).toBe(false);

    const shell = extractPageFromHtml({
      id: "shell",
      url: "https://example.com/app",
      html: "<html><body><div id=\"root\"></div></body></html>",
    });

    expect(shell.isEmptyShell).toBe(true);
  });

  it("accepts Redline judge responses that satisfy all invariants", () => {
    const page = extractPageFromHtml({
      id: "container",
      url: "https://example.com/products/container.html",
      html: containerHtml,
    });

    const result = validateRedlineJudgeResponse(redlineResponse(), page, acmePrompts);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.response.affected_prompts).toEqual(["container-security"]);
    }
  });

  it("rejects structural Redline invariant violations", () => {
    const page = extractPageFromHtml({
      id: "container",
      url: "https://example.com/products/container.html",
      html: containerHtml,
    });

    const result = validateRedlineJudgeResponse(
      redlineResponse({
        primary_label: "Aligned",
        suggested_action: "KEEP",
        edit_plan: null,
      }),
      page,
      acmePrompts,
    );

    expect(result).toEqual(
      expect.objectContaining({ valid: false, issue: "aligned_invariant" }),
    );
  });

  it("rejects affected prompt IDs that do not exist in the prompt config", () => {
    const page = extractPageFromHtml({
      id: "container",
      url: "https://example.com/products/container.html",
      html: containerHtml,
    });

    const result = validateRedlineJudgeResponse(
      redlineResponse({ affected_prompts: ["container-security", "unknown"] }),
      page,
      acmePrompts,
    );

    expect(result).toEqual(
      expect.objectContaining({ valid: false, issue: "unknown_affected_prompt" }),
    );
  });

  it("rejects Redline findings when any quoted_text is not on the page", () => {
    const page = extractPageFromHtml({
      id: "container",
      url: "https://example.com/products/container.html",
      html: containerHtml,
    });

    const result = validateRedlineJudgeResponse(
      redlineResponse({
        findings: [
          ...redlineResponse().findings,
          {
            id: "f2",
            kind: "unsupported_claim",
            severity: "medium",
            quoted_text: "This claim does not exist on the page.",
            location_hint: "Body",
            issue: "This should force repair instead of being dropped.",
            suggested_fix: "Retry with an exact quote.",
          },
        ],
      }),
      page,
      acmePrompts,
    );

    expect(result).toEqual(
      expect.objectContaining({ valid: false, issue: "quoted_text_not_found" }),
    );
  });

  it("rejects MANUAL_REVIEW confidence at or above 0.6", () => {
    const page = extractPageFromHtml({
      id: "container",
      url: "https://example.com/products/container.html",
      html: containerHtml,
    });

    const result = validateRedlineJudgeResponse(
      redlineResponse({
        primary_label: "Unclear",
        confidence: 0.92,
        suggested_action: "MANUAL_REVIEW",
        edit_plan: null,
      }),
      page,
      acmePrompts,
    );

    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        issue: "manual_review_confidence_invariant",
      }),
    );
  });
});
