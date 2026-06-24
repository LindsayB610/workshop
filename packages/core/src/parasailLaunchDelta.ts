import { prepareEditBriefFromJson } from "./editBrief.js";
import type { ExtractedPage } from "./extract.js";
import {
  generateReportBundle,
  generateSinglePageReport,
  type ReportSystemBundle,
  type SourceReadinessItem,
  type SinglePageReport,
} from "./report.js";
import type { Finding } from "./schemas.js";

export type LaunchDeltaClassification =
  | "resolved_from_prior_baseline"
  | "still_open"
  | "new_issue_introduced_by_launch"
  | "claim_proof_approval_needed";

export type LaunchDeltaItem = {
  id: string;
  classification: LaunchDeltaClassification;
  priorFindingId?: string;
  label: string;
  targetText?: string;
  note: string;
};

export type ParasailLaunchDeltaInput = {
  page: ExtractedPage;
  findings: Finding[];
  sourceReadiness: SourceReadinessItem[];
  deltaItems: LaunchDeltaItem[];
};

export type ParasailLaunchDeltaReport = SinglePageReport & {
  executiveSummary: ReportSystemBundle["executiveSummary"];
  findingsCsv: ReportSystemBundle["findingsCsv"];
  pageRedlines: ReportSystemBundle["pageRedlines"];
  sourceReadiness: ReportSystemBundle["sourceReadiness"];
  openQuestions: ReportSystemBundle["openQuestions"];
  proofGateSummary: ReportSystemBundle["proofGateSummary"];
  editBrief: string;
  launchDelta: string;
};

export function createParasailLaunchDeltaFindings(): Finding[] {
  const targetId = "launched-production-homepage-2026-06-22";
  const url = "https://www.parasail.io/";

  return [
    {
      id: "parasail-launch-f1",
      clientId: "parasail",
      targetId,
      url,
      mode: "proof_gap",
      label: "750B daily-token claim needs approved public proof",
      priority: "high",
      confidence: "high",
      quotedText: "750B",
      issue:
        "The launched hero uses a large usage metric as first-viewport proof. It is valuable, but Redline should not amplify or reframe it without approved public-use evidence and a current measurement basis.",
      suggestedFix:
        "Keep the metric visible only if Parasail can approve the measurement window, scope, and public-use caveats; otherwise soften to a non-numeric production-scale proof point.",
      sourceRefs: ["parasail-source-proof-library", "parasail-source-positioning"],
      proofNeeded:
        "Approved public-use source for tokens served daily, including date range and what traffic is counted.",
      editReadiness: "manual_review",
      claimCategory: "metric",
      approvalStatus: "needs_client_approval",
      proofRequired: true,
      proofOwner: "Parasail client proof owner",
      canAgentEdit: false,
      agentInstruction:
        "Needs client proof approval. Do not repeat, strengthen, or reframe the 750B metric until approved.",
    },
    {
      id: "parasail-launch-f2",
      clientId: "parasail",
      targetId,
      url,
      mode: "proof_gap",
      label: "30x cheaper claim still needs comparison basis",
      priority: "high",
      confidence: "high",
      quotedText: "30×",
      issue:
        "The prior 30x cost proof gap persists in the launched hero. The claim is now more prominent as a stat card, so it needs an approved comparison basis before edits strengthen it.",
      suggestedFix:
        "Route the claim to client approval for methodology, caveats, and public-use permission before using it in suggested copy or agent edits.",
      sourceRefs: [
        "parasail-source-proof-library",
        "parasail-source-homepage-baseline-audit",
      ],
      proofNeeded:
        "Approved methodology and public-use permission for the 30x legacy-cloud comparison.",
      editReadiness: "open_question",
      claimCategory: "pricing_comparison",
      approvalStatus: "needs_client_approval",
      proofRequired: true,
      proofOwner: "Parasail client proof owner",
      canAgentEdit: false,
      agentInstruction:
        "Needs client proof approval. Do not repeat, strengthen, or reframe the 30x comparison until approved.",
    },
    {
      id: "parasail-launch-f3",
      clientId: "parasail",
      targetId,
      url,
      mode: "proof_gap",
      label: "Day-0 frontier-model access needs availability caveats",
      priority: "high",
      confidence: "high",
      quotedText: "Day-0 access to frontier open models",
      issue:
        "Day-0 access is a strong buyer promise, but it can become stale or overbroad quickly as model releases change.",
      suggestedFix:
        "Keep the claim gated until Parasail documents which model families it covers, how availability is maintained, and when the claim should be refreshed.",
      sourceRefs: ["parasail-source-proof-library", "parasail-source-positioning"],
      proofNeeded:
        "Current model-availability source and refresh owner for Day-0 frontier open-model access.",
      editReadiness: "manual_review",
      claimCategory: "availability_promise",
      approvalStatus: "needs_internal_proof",
      proofRequired: true,
      proofOwner: "Parasail product owner",
      canAgentEdit: false,
      agentInstruction:
        "Needs current model-availability proof. Rewrite structure only; do not amplify the promise.",
    },
    {
      id: "parasail-launch-f4",
      clientId: "parasail",
      targetId,
      url,
      mode: "proof_gap",
      label: "Infrastructure footprint claim needs current ops source",
      priority: "medium",
      confidence: "high",
      quotedText: "26 data centers across 15 regions",
      issue:
        "The infrastructure footprint is a concrete trust signal, but it is operationally time-sensitive and should be tied to a maintained source.",
      suggestedFix:
        "Approve or caveat the footprint claim from a maintained ops/product source before using it as supporting proof in recommendations.",
      sourceRefs: ["parasail-source-proof-library", "parasail-source-positioning"],
      proofNeeded:
        "Maintained source for data-center count, region count, and current-generation chip-class coverage.",
      editReadiness: "manual_review",
      claimCategory: "geography_infrastructure",
      approvalStatus: "needs_internal_proof",
      proofRequired: true,
      proofOwner: "Parasail infrastructure owner",
      canAgentEdit: false,
      agentInstruction:
        "Needs maintained infrastructure proof. Rewrite structure only; do not restate counts.",
    },
    {
      id: "parasail-launch-f5",
      clientId: "parasail",
      targetId,
      url,
      mode: "objection_coverage",
      label: "Same-day launch promise needs approval guardrails",
      priority: "medium",
      confidence: "high",
      quotedText: "Optimized endpoints are typically live the same day",
      issue:
        "The FAQ directly handles speed-to-launch objections, but the promise can create delivery expectations that vary by workload, legal path, model, and region.",
      suggestedFix:
        "Keep the FAQ language, but add internal approval criteria for when same-day endpoint claims are safe to repeat in edits.",
      sourceRefs: ["parasail-source-objections", "parasail-source-proof-library"],
      proofNeeded:
        "Client-approved caveats for same-day optimized endpoint claims and any legal / ZDR assumptions.",
      editReadiness: "manual_review",
      claimCategory: "support_sla_promise",
      approvalStatus: "needs_client_approval",
      proofRequired: true,
      proofOwner: "Parasail GTM owner",
      canAgentEdit: false,
      agentInstruction:
        "Needs client proof approval. Do not broaden same-day launch promises.",
    },
    {
      id: "parasail-launch-f6",
      clientId: "parasail",
      targetId,
      url,
      mode: "message_alignment",
      label: "Human engineering support remains too late in the journey",
      priority: "medium",
      confidence: "high",
      quotedText: "dedicated solutions engineer and our performance team",
      issue:
        "The launched FAQ has much stronger support language than the old page, but it appears late. For buyers comparing self-hosting and closed vendors, direct engineering support is a strategic differentiator.",
      suggestedFix:
        "Consider pulling the shared Slack / solutions engineer proof higher on the page near the production-scale or self-hosting sections.",
      sourceRefs: [
        "parasail-source-buyer-language",
        "parasail-source-objections",
        "parasail-source-homepage-baseline-audit",
      ],
      proofNeeded:
        "Confirm which support promises are public-safe: Slack, solutions engineer ownership, performance team access, and response-time language.",
      editReadiness: "ready",
      claimCategory: "support_sla_promise",
      approvalStatus: "needs_client_approval",
      proofRequired: true,
      proofOwner: "Parasail GTM owner",
      canAgentEdit: true,
      agentInstruction:
        "Rewrite structure only. Do not add new response-time, Slack, or staffing promises.",
    },
  ];
}

export function createParasailLaunchDeltaItems(): LaunchDeltaItem[] {
  return [
    {
      id: "delta-hero-positioning",
      classification: "resolved_from_prior_baseline",
      priorFindingId: "parasail-homepage-f1",
      label: "Hero now names AI-native startups and inference cloud",
      targetText: "The Inference Cloud for AI-native startups",
      note:
        "The old generic hero issue should not be carried forward as-is; the launch now names the category and buyer more clearly.",
    },
    {
      id: "delta-product-bridge",
      classification: "resolved_from_prior_baseline",
      priorFindingId: "parasail-homepage-f4",
      label: "Dedicated/serverless bridge became spend-commitment billing",
      targetText: "Commit to spend, not GPUs",
      note:
        "The old Dedicated Serverless card issue is no longer the right finding. The launched page reframes the bridge around flexible drawdown billing.",
    },
    {
      id: "delta-faq-objections",
      classification: "resolved_from_prior_baseline",
      priorFindingId: "parasail-homepage-f5",
      label: "Generic use-case copy was replaced by sharper FAQ objection handling",
      targetText: "We're paying a closed-model vendor directly. Can we switch?",
      note:
        "The launched page handles buyer objections more directly than the old broad use-case block.",
    },
    {
      id: "delta-cost-proof",
      classification: "still_open",
      priorFindingId: "parasail-homepage-f3",
      label: "30x cost claim remains proof-gated",
      targetText: "30×",
      note:
        "The prior proof gap persists and is more prominent in the launched hero stat card.",
    },
    {
      id: "delta-support-placement",
      classification: "still_open",
      priorFindingId: "parasail-homepage-f6",
      label: "Engineering support is stronger but still late",
      targetText: "dedicated solutions engineer and our performance team",
      note:
        "The FAQ has stronger direct-support language, but the differentiator may still need to appear earlier.",
    },
    {
      id: "delta-usage-metric",
      classification: "new_issue_introduced_by_launch",
      label: "750B token metric adds a new approval dependency",
      targetText: "750B",
      note:
        "The new first-viewport usage metric is useful proof but needs a maintained approval source.",
    },
    {
      id: "delta-public-claims",
      classification: "claim_proof_approval_needed",
      label: "Launch metrics and customer quotes need proof review before agent edits",
      targetText: "Elicit is using LLMs to screen more than 100,000 scientific papers each day",
      note:
        "Customer quotes and operational metrics should be treated as page facts plus approval gates, not canonical proof.",
    },
  ];
}

function deltaItemsByClassification(items: LaunchDeltaItem[]) {
  const groups: Record<LaunchDeltaClassification, LaunchDeltaItem[]> = {
    resolved_from_prior_baseline: [],
    still_open: [],
    new_issue_introduced_by_launch: [],
    claim_proof_approval_needed: [],
  };

  for (const item of items) {
    groups[item.classification].push(item);
  }

  return groups;
}

function buildLaunchDeltaMarkdown(input: ParasailLaunchDeltaInput): string {
  const groups = deltaItemsByClassification(input.deltaItems);
  const section = (title: string, items: LaunchDeltaItem[]) => [
    `## ${title}`,
    "",
    items.length
      ? items
          .map((item) =>
            [
              `- ${item.id}: ${item.label}`,
              item.priorFindingId ? `  - Prior finding: ${item.priorFindingId}` : undefined,
              item.targetText ? `  - Target text: "${item.targetText}"` : undefined,
              `  - Note: ${item.note}`,
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n")
      : "None.",
    "",
  ].join("\n");

  return [
    "# Parasail Launch Delta Audit",
    "",
    "Run: parasail-launch-delta-2026-06-22",
    "Target: launched-production-homepage-2026-06-22",
    "",
    "This report compares the launched homepage against the June 20 baseline and the trusted Parasail packet. The launched page is an audit target only; approved claims still require canonical source support.",
    "",
    section("Resolved From Prior Baseline", groups.resolved_from_prior_baseline),
    section("Still Open", groups.still_open),
    section("New Issues Introduced By Launch", groups.new_issue_introduced_by_launch),
    section("Claim / Proof Approval Needed", groups.claim_proof_approval_needed),
  ].join("\n");
}

export function buildParasailLaunchDeltaReport(
  input: ParasailLaunchDeltaInput,
): ParasailLaunchDeltaReport {
  const reportBundle = generateReportBundle({
    clientId: "parasail",
    runId: "parasail-launch-delta-2026-06-22",
    generatedAt: "2026-06-23T00:07:26.000Z",
    title: "Parasail Launch Delta Audit",
    pages: [input.page],
    findings: input.findings,
    sourceReadiness: input.sourceReadiness,
    publicClaims: [
      {
        id: "claim-750b-tokens-daily",
        clientId: "parasail",
        claim: "750B tokens served daily.",
        claimCategory: "metric",
        proofStatus: "weak_proof",
        sourceRefs: ["parasail-source-proof-library"],
        publicUseApproved: false,
        approvalStatus: "needs_client_approval",
        proofRequired: true,
        proofOwner: "Parasail client proof owner",
        canAgentEdit: false,
        riskNotes:
          "First-viewport usage metric needs approved public-use source and measurement window.",
      },
      {
        id: "claim-30x-cheaper",
        clientId: "parasail",
        claim: "30x cheaper than legacy clouds.",
        claimCategory: "pricing_comparison",
        proofStatus: "weak_proof",
        sourceRefs: ["parasail-source-proof-library"],
        publicUseApproved: false,
        approvalStatus: "needs_client_approval",
        proofRequired: true,
        proofOwner: "Parasail client proof owner",
        canAgentEdit: false,
        riskNotes: "Numeric comparison needs approved methodology and caveats.",
      },
      {
        id: "claim-day-0-frontier-models",
        clientId: "parasail",
        claim: "Day-0 access to frontier open models.",
        claimCategory: "availability_promise",
        proofStatus: "weak_proof",
        sourceRefs: ["parasail-source-proof-library"],
        publicUseApproved: false,
        approvalStatus: "needs_internal_proof",
        proofRequired: true,
        proofOwner: "Parasail product owner",
        canAgentEdit: false,
        riskNotes:
          "Model availability claim is time-sensitive and needs a maintained source.",
      },
      {
        id: "claim-26-data-centers-15-regions",
        clientId: "parasail",
        claim: "26 data centers across 15 regions.",
        claimCategory: "geography_infrastructure",
        proofStatus: "weak_proof",
        sourceRefs: ["parasail-source-proof-library"],
        publicUseApproved: false,
        approvalStatus: "needs_internal_proof",
        proofRequired: true,
        proofOwner: "Parasail infrastructure owner",
        canAgentEdit: false,
        riskNotes:
          "Infrastructure footprint should be confirmed from a maintained ops/product source.",
      },
      {
        id: "claim-same-day-endpoints",
        clientId: "parasail",
        claim: "Optimized endpoints are typically live the same day.",
        claimCategory: "support_sla_promise",
        proofStatus: "weak_proof",
        sourceRefs: ["parasail-source-objections", "parasail-source-proof-library"],
        publicUseApproved: false,
        approvalStatus: "needs_client_approval",
        proofRequired: true,
        proofOwner: "Parasail GTM owner",
        canAgentEdit: false,
        riskNotes:
          "Delivery promise needs workload, legal, region, and model caveats before reuse.",
      },
      {
        id: "claim-customer-quotes",
        clientId: "parasail",
        claim: "Customer quotes from Elicit, Rasa, and Oumi.",
        claimCategory: "customer_proof",
        proofStatus: "weak_proof",
        sourceRefs: ["parasail-source-proof-library"],
        publicUseApproved: false,
        approvalStatus: "needs_client_approval",
        proofRequired: true,
        proofOwner: "Parasail client proof owner",
        canAgentEdit: false,
        riskNotes:
          "Quote text appears on the target page but still needs public-use approval trail before agents adapt it.",
      },
    ],
    recommendedNextStep:
      "Treat the launched page as improved positioning with unresolved proof gates: approve public metrics and customer-proof usage before preparing agent edits.",
  });
  const baseReport = generateSinglePageReport(input.page, input.findings);

  return {
    ...baseReport,
    ...reportBundle,
    editBrief: prepareEditBriefFromJson(reportBundle.agentEditPlanJson).markdown,
    launchDelta: buildLaunchDeltaMarkdown(input),
  };
}
