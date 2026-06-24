import {
  generateReportBundle,
  generateSinglePageReport,
  type ReportSystemBundle,
  type SourceReadinessItem,
  type SinglePageReport,
} from "./report.js";
import { prepareEditBriefFromJson } from "./editBrief.js";
import type { ExtractedPage } from "./extract.js";
import type { Finding } from "./schemas.js";

export type ParasailHomepagePilotInput = {
  page: ExtractedPage;
  findings: Finding[];
  sourceReadiness: SourceReadinessItem[];
};

export type ParasailHomepagePilotReport = SinglePageReport & {
  executiveSummary: ReportSystemBundle["executiveSummary"];
  findingsCsv: ReportSystemBundle["findingsCsv"];
  pageRedlines: ReportSystemBundle["pageRedlines"];
  sourceReadiness: ReportSystemBundle["sourceReadiness"];
  openQuestions: ReportSystemBundle["openQuestions"];
  proofGateSummary: ReportSystemBundle["proofGateSummary"];
  editBrief: string;
};

export function buildParasailHomepagePilotReport(
  input: ParasailHomepagePilotInput,
): ParasailHomepagePilotReport {
  const reportBundle = generateReportBundle({
    clientId: "parasail",
    runId: "homepage-pilot",
    generatedAt: "2026-06-20T00:00:00.000Z",
    title: "Parasail Homepage Pilot",
    pages: [input.page],
    findings: input.findings,
    sourceReadiness: input.sourceReadiness,
    publicClaims: [
      {
        id: "claim-fastest-cost-efficient",
        clientId: "parasail",
        claim: "The world's fastest, most cost-efficient AI inference network.",
        proofStatus: "weak_proof",
        sourceRefs: ["parasail-source-proof-library"],
        publicUseApproved: false,
        riskNotes: "Superlative speed/cost claim needs approved public proof.",
      },
      {
        id: "claim-30x-cheaper",
        clientId: "parasail",
        claim: "Up to 30x cheaper than legacy cloud.",
        proofStatus: "weak_proof",
        sourceRefs: ["parasail-source-proof-library"],
        publicUseApproved: false,
        riskNotes: "Numeric comparison needs approved methodology and caveats.",
      },
    ],
    recommendedNextStep:
      "Rewrite the first viewport around production OSS inference, dedicated performance, token-based economics, and direct engineering support before preparing edits.",
  });
  const findings = input.findings;
  const baseReport = generateSinglePageReport(input.page, findings);

  return {
    ...baseReport,
    ...reportBundle,
    editBrief: prepareEditBriefFromJson(reportBundle.agentEditPlanJson).markdown,
  };
}

export function createParasailHomepagePilotFindings(): Finding[] {
  return [
    {
      id: "parasail-homepage-f1",
      clientId: "parasail",
      targetId: "current-production-homepage",
      url: "https://parasail.io/",
      mode: "message_alignment",
      label: "Hero is too generic for the new ICP",
      priority: "high",
      confidence: "high",
      quotedText: "No limits. No contracts. Priced right.",
      issue:
        "The hero is clear but broad; it does not immediately name production OSS inference, AI-native teams, dedicated performance, token economics, or engineering support.",
      suggestedFix:
        "Test a hero around production OSS inference without the MLOps burden, supported by dedicated performance, token-based economics, and direct engineering help.",
      sourceRefs: [
        "parasail-source-positioning",
        "parasail-source-icp",
        "parasail-source-homepage-baseline-audit",
      ],
      proofNeeded: "Confirm the final hero claim with Parasail before launch.",
      editReadiness: "ready",
    },
    {
      id: "parasail-homepage-f2",
      clientId: "parasail",
      targetId: "current-production-homepage",
      url: "https://parasail.io/",
      mode: "proof_gap",
      label: "Fastest and cheapest claims need approved proof",
      priority: "high",
      confidence: "high",
      quotedText:
        "The world's fastest, most cost-efficient AI inference network.",
      issue:
        "This creates a commodity speed/cost frame and makes a superlative claim that needs approved public proof close to the copy.",
      suggestedFix:
        "Either attach approved proof near the claim or reframe toward private OSS model endpoints, dedicated performance, token-based billing, and workload tuning.",
      sourceRefs: [
        "parasail-source-proof-library",
        "parasail-source-positioning",
        "parasail-source-homepage-baseline-audit",
      ],
      proofNeeded:
        "Approved benchmark or customer proof for fastest / most cost-efficient.",
      editReadiness: "open_question",
    },
    {
      id: "parasail-homepage-f3",
      clientId: "parasail",
      targetId: "current-production-homepage",
      url: "https://parasail.io/",
      mode: "proof_gap",
      label: "30x cheaper claim needs public-use approval",
      priority: "high",
      confidence: "high",
      quotedText: "up to 30x cheaper than legacy cloud",
      issue:
        "The numeric cost claim is valuable, but the proof library is only partial and this should not become stronger public copy without approved substantiation.",
      suggestedFix:
        "Keep the claim in manual review until the approved comparison basis, caveats, and public-use permission are documented.",
      sourceRefs: [
        "parasail-source-proof-library",
        "parasail-source-homepage-baseline-audit",
      ],
      proofNeeded:
        "Approved methodology and public-use permission for the 30x comparison.",
      editReadiness: "manual_review",
    },
    {
      id: "parasail-homepage-f4",
      clientId: "parasail",
      targetId: "current-production-homepage",
      url: "https://parasail.io/",
      mode: "message_alignment",
      label: "Dedicated Serverless is underused as the strategic bridge",
      priority: "high",
      confidence: "high",
      quotedText:
        "Get guaranteed throughput and consistent latency while keeping serverless simplicity.",
      issue:
        "This is close to the strongest differentiator, but it appears as product-card copy rather than the page's central bridge between public endpoints and idle reserved GPUs.",
      suggestedFix:
        "Promote dedicated serverless into a section framed as dedicated performance with serverless economics and token-based billing.",
      sourceRefs: [
        "parasail-source-positioning",
        "parasail-source-buyer-language",
        "parasail-source-homepage-baseline-audit",
      ],
      proofNeeded:
        "Confirm dedicated serverless language and any throughput / latency guarantees.",
      editReadiness: "ready",
    },
    {
      id: "parasail-homepage-f5",
      clientId: "parasail",
      targetId: "current-production-homepage",
      url: "https://parasail.io/",
      mode: "buyer_language",
      label: "Use-case section leans broad instead of buyer-pain specific",
      priority: "medium",
      confidence: "high",
      quotedText: "One platform for every way AI sees, speaks, and thinks",
      issue:
        "The phrase is polished but generic; it does not name concrete production pains such as latency-sensitive voice agents, retries, model switching, or cost-sensitive free tiers.",
      suggestedFix:
        "Rewrite use-case subcopy around production triggers: latency is the product, retries compound cost, quality misses cause churn, and batch retries waste days.",
      sourceRefs: [
        "parasail-source-buyer-language",
        "parasail-source-objections",
        "parasail-source-homepage-baseline-audit",
      ],
      proofNeeded:
        "Confirm which workload examples are public-safe and highest priority.",
      editReadiness: "manual_review",
    },
    {
      id: "parasail-homepage-f6",
      clientId: "parasail",
      targetId: "current-production-homepage",
      url: "https://parasail.io/",
      mode: "objection_coverage",
      label: "Engineering support is present but buried",
      priority: "medium",
      confidence: "high",
      quotedText:
        "Our team can help you tune deployments, compare model options, and scale your inference workload.",
      issue:
        "Customer evidence shows Slack, SE access, direct engineering help, and workload tuning are important, but the page treats support as a late helper note instead of a core differentiator.",
      suggestedFix:
        "Add a proof band or section around working directly with inference engineers for test endpoints, model selection, workload tuning, and latency / cost targets.",
      sourceRefs: [
        "parasail-source-proof-library",
        "parasail-source-buyer-language",
        "parasail-source-homepage-baseline-audit",
      ],
      proofNeeded:
        "Confirm which support promises can be made publicly: Slack, SE access, setup timing, and tuning scope.",
      editReadiness: "manual_review",
    },
  ];
}
