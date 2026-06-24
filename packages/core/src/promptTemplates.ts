import type { ExtractedPage } from "./extract.js";
import type { AuditMode } from "./schemas.js";

export type JudgePromptTemplate = {
  mode: AuditMode;
  title: string;
  instructions: string[];
};

export const judgePromptTemplates: Record<AuditMode, JudgePromptTemplate> = {
  message_alignment: {
    mode: "message_alignment",
    title: "Message alignment audit",
    instructions: [
      "Find places where page copy drifts away from the client's approved positioning.",
      "Prefer concrete mismatches over generic writing advice.",
      "Cite the canonical source that supports each finding.",
    ],
  },
  buyer_language: {
    mode: "buyer_language",
    title: "Buyer language audit",
    instructions: [
      "Find internal mechanism language that should be translated into buyer pain.",
      "Prefer phrases that appear in the client's buyer-language module.",
      "Do not invent buyer quotes.",
    ],
  },
  proof_gap: {
    mode: "proof_gap",
    title: "Proof gap audit",
    instructions: [
      "Find claims that need nearby proof, approved examples, metrics, or testimonials.",
      "Mark weak or unapproved proof as manual_review or open_question.",
      "Do not convert unapproved proof into public claims.",
    ],
  },
  objection_coverage: {
    mode: "objection_coverage",
    title: "Objection coverage audit",
    instructions: [
      "Find missing or weak answers to likely buyer objections.",
      "Tie objections to the client's objections module.",
      "Prefer specific buyer concerns over abstract risk language.",
    ],
  },
  geo_readiness: {
    mode: "geo_readiness",
    title: "GEO readiness audit",
    instructions: [
      "Find entity, definition, comparison, and sourceability gaps for AI-search extraction.",
      "Prefer explicit entities and concepts from the client packet.",
      "Do not recommend broad SEO filler.",
    ],
  },
};

export function buildJudgePrompt(
  mode: AuditMode,
  page: ExtractedPage,
  sourceRefs: string[],
): string {
  const template = judgePromptTemplates[mode];

  return [
    `# ${template.title}`,
    "",
    "## Instructions",
    ...template.instructions.map((instruction) => `- ${instruction}`),
    "",
    "## Required JSON",
    "Return an object with a `findings` array. Each finding must include: id, clientId, targetId, url, mode, label, priority, confidence, quotedText, issue, suggestedFix, sourceRefs, proofNeeded, editReadiness.",
    "",
    "## Target Page",
    `- ID: ${page.id}`,
    `- URL: ${page.url}`,
    `- Title: ${page.title}`,
    "",
    "## Available Sources",
    ...sourceRefs.map((sourceRef) => `- ${sourceRef}`),
  ].join("\n");
}
