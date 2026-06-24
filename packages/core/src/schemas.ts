import { z } from "zod";

export const sourceTypeSchema = z.enum([
  "notion",
  "transcript",
  "local",
  "web",
  "generated",
]);

export const sourceTierSchema = z.enum([
  "source_of_truth",
  "canonical",
  "foundational",
  "audit_target",
  "context",
]);

export const trustLevelSchema = z.enum([
  "trusted",
  "provisional",
  "foundational",
  "unverified",
]);

export const readinessSchema = z.enum(["strong", "partial", "missing"]);

export const prioritySchema = z.enum(["high", "medium", "low"]);

export const confidenceSchema = z.enum(["high", "medium", "low"]);

export const editReadinessSchema = z.enum([
  "ready",
  "manual_review",
  "open_question",
]);

export const auditModeSchema = z.enum([
  "message_alignment",
  "buyer_language",
  "proof_gap",
  "objection_coverage",
  "geo_readiness",
]);

export const redlineLabelSchema = z.enum([
  "Aligned",
  "Stale",
  "OffBrand",
  "Contradictory",
  "Redundant",
  "Thin",
  "Zombie",
  "Unclear",
]);

export const redlineActionSchema = z.enum([
  "KEEP",
  "UPDATE",
  "REWRITE",
  "DELETE",
  "MANUAL_REVIEW",
]);

export const redlineFindingKindSchema = z.enum([
  "retired_product_name",
  "unsupported_claim",
  "contradicts_canonical",
  "off_brand_tone",
  "outdated_feature",
  "outdated_pricing",
  "thin_content",
  "boilerplate_only",
  "redundant_with_other_page",
  "dead_external_reference",
  "factual_error",
  "missing_canonical_message",
  "other",
]);

export const redlinePromptSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  text: z.string().min(1).max(2000),
  weight: z.number().min(0).max(10).default(1),
  tags: z.array(z.string().min(1)).default([]),
});

export const redlineCanonicalMessagingBlockSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1).max(20000),
});

export const redlinePromptsFileSchema = z.object({
  version: z.literal("1"),
  prompts: z.array(redlinePromptSchema).min(1).max(100),
  canonical_messaging: z.array(redlineCanonicalMessagingBlockSchema).max(50),
  seeds: z.array(z.string().url()).optional(),
}).superRefine((file, ctx) => {
  const seenPromptIds = new Set<string>();

  file.prompts.forEach((prompt, index) => {
    if (seenPromptIds.has(prompt.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prompts", index, "id"],
        message: `Duplicate prompt id "${prompt.id}".`,
      });
    }
    seenPromptIds.add(prompt.id);
  });
});

export const redlinePageSummarySchema = z.object({
  current_focus: z.string().max(400),
  should_focus_on: z.string().max(400).nullable().optional(),
});

export const redlineFindingSchema = z.object({
  id: z.string().regex(/^f[0-9]+$/),
  kind: redlineFindingKindSchema,
  severity: z.enum(["high", "medium", "low"]),
  quoted_text: z.string().min(1).max(500),
  location_hint: z.string().max(200),
  issue: z.string().max(600),
  suggested_fix: z.string().max(800),
});

export const redlineRewriteEntrySchema = z.object({
  element: z.string().max(200),
  current_framing: z.string().max(500),
  new_framing: z.string().max(800),
});

export const redlineEditPlanSchema = z.object({
  summary: z.string().max(500),
  preserve: z.array(z.string().max(200)).optional(),
  remove: z.array(z.string().max(300)).optional(),
  rewrite: z.array(redlineRewriteEntrySchema).optional(),
  add: z.array(z.string().max(300)).optional(),
});

export const redlineJudgeResponseSchema = z.object({
  primary_label: redlineLabelSchema,
  secondary_labels: z.array(redlineLabelSchema).optional(),
  confidence: z.number(),
  affected_prompts: z.array(z.string()).optional(),
  suggested_action: redlineActionSchema,
  page_summary: redlinePageSummarySchema,
  findings: z.array(redlineFindingSchema).max(15),
  edit_plan: redlineEditPlanSchema.nullable().optional(),
  rationale: z.string().min(50).max(2500),
});

export const sourcePrivacySchema = z.enum([
  "public_safe",
  "internal_only",
  "private_sensitive",
]);

export const sourceFreshnessSchema = z.enum([
  "current",
  "possibly_stale",
  "stale",
  "unknown",
]);

export const sourceConfidenceSchema = z.enum(["high", "medium", "low"]);

export const reviewStatusSchema = z.enum([
  "draft",
  "approved",
  "needs_review",
  "rejected",
]);

export const proofStatusSchema = z.enum([
  "approved_proof",
  "private_proof",
  "weak_proof",
  "missing_proof",
]);

export const claimCategorySchema = z.enum([
  "metric",
  "customer_proof",
  "availability_promise",
  "support_sla_promise",
  "geography_infrastructure",
  "pricing_comparison",
  "broad_positioning",
]);

export const approvalStatusSchema = z.enum([
  "approved",
  "needs_client_approval",
  "needs_internal_proof",
  "blocked",
  "not_required",
]);

export const clientConfigSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  canonicalModules: z.array(z.string().min(1)).min(1),
  requiredCanonicalModules: z.array(z.string().min(1)).min(1),
});

export const sourceSnapshotSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  type: sourceTypeSchema,
  tier: sourceTierSchema,
  trustLevel: trustLevelSchema,
  title: z.string().min(1),
  path: z.string().min(1).optional(),
  url: z.string().url().optional(),
  sourceId: z.string().min(1).optional(),
  fetchedAt: z.string().datetime().optional(),
  lastEditedAt: z.string().datetime().optional(),
  checksum: z.string().min(1).optional(),
}).refine((snapshot) => Boolean(snapshot.path ?? snapshot.url ?? snapshot.sourceId), {
  message: "Source snapshot must include path, url, or sourceId.",
});

export const canonicalRegistryEntrySchema = z.object({
  moduleId: z.string().min(1),
  clientId: z.string().min(1),
  path: z.string().min(1),
  readiness: readinessSchema,
  provenance: z.array(z.string().min(1)).min(1),
});

export const sourceManifestSchema = z.object({
  clientId: z.string().min(1),
  generatedAt: z.string().datetime(),
  sources: z.array(sourceSnapshotSchema),
  canonicalRegistry: z.array(canonicalRegistryEntrySchema),
});

export const auditTargetSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  type: z.enum(["live_url", "saved_fixture", "pasted_draft", "local_file"]),
  title: z.string().min(1),
  url: z.string().url().optional(),
  path: z.string().min(1).optional(),
  capturedAt: z.string().datetime().optional(),
}).refine((target) => Boolean(target.path ?? target.url), {
  message: "Audit target must include path or url.",
});

export const findingSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  targetId: z.string().min(1),
  url: z.string().url(),
  mode: auditModeSchema,
  label: z.string().min(1),
  priority: prioritySchema,
  confidence: confidenceSchema,
  quotedText: z.string().min(1),
  issue: z.string().min(1),
  suggestedFix: z.string().min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
  proofNeeded: z.string().min(1),
  editReadiness: editReadinessSchema,
  claimCategory: claimCategorySchema.optional(),
  approvalStatus: approvalStatusSchema.optional(),
  proofRequired: z.boolean().optional(),
  proofOwner: z.string().min(1).optional(),
  canAgentEdit: z.boolean().optional(),
  agentInstruction: z.string().min(1).optional(),
});

export const reportBundleSchema = z.object({
  clientId: z.string().min(1),
  runId: z.string().min(1),
  targetIds: z.array(z.string().min(1)).min(1),
  generatedAt: z.string().datetime(),
  reports: z.object({
    executiveSummary: z.string().min(1),
    pageRedlines: z.string().min(1),
    agentEditPlan: z.string().min(1),
    sourceReadiness: z.string().min(1),
    openQuestions: z.string().min(1).optional(),
    findingsCsv: z.string().min(1).optional(),
    proofGateSummary: z.string().min(1).optional(),
  }),
});

export const agentEditPlanSchema = z.object({
  target: z.object({
    id: z.string().min(1),
    url: z.string().url(),
    title: z.string(),
  }),
  findings: z.array(findingSchema),
});

export const reportAgentEditPlanSchema = z.object({
  clientId: z.string().min(1),
  runId: z.string().min(1),
  generatedAt: z.string().datetime(),
  targets: z.array(
    z.object({
      id: z.string().min(1),
      url: z.string().url(),
      title: z.string(),
    }),
  ).min(1),
  findings: z.array(findingSchema),
  openQuestions: z.array(
    z.object({
      findingId: z.string().min(1),
      targetId: z.string().min(1),
      proofNeeded: z.string().min(1),
      editReadiness: editReadinessSchema,
      claimCategory: claimCategorySchema.optional(),
      approvalStatus: approvalStatusSchema.optional(),
      proofRequired: z.boolean().optional(),
      proofOwner: z.string().min(1).optional(),
      canAgentEdit: z.boolean().optional(),
      agentInstruction: z.string().min(1).optional(),
    }),
  ).default([]),
  publicClaimFlags: z.array(
    z.object({
      claimId: z.string().min(1),
      claim: z.string().min(1),
      claimCategory: claimCategorySchema.optional(),
      proofStatus: proofStatusSchema,
      publicUseApproved: z.boolean(),
      approvalStatus: approvalStatusSchema.optional(),
      proofRequired: z.boolean().optional(),
      proofOwner: z.string().min(1).optional(),
      canAgentEdit: z.boolean().optional(),
      riskNotes: z.string().optional(),
    }),
  ).default([]),
  proofGateSummary: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      claimCategory: claimCategorySchema.optional(),
      approvalStatus: approvalStatusSchema,
      proofOwner: z.string().min(1),
      canAgentEdit: z.boolean(),
      instruction: z.string().min(1),
      sourceRefs: z.array(z.string().min(1)).min(1),
    }),
  ).default([]),
});

export const editBriefInstructionKindSchema = z.enum([
  "rewrite_instruction",
  "manual_review",
]);

export const editBriefInstructionSchema = z.object({
  findingId: z.string().min(1),
  targetId: z.string().min(1),
  targetUrl: z.string().url(),
  label: z.string().min(1),
  kind: editBriefInstructionKindSchema,
  locatorText: z.string().min(1),
  instruction: z.string().min(1),
  rationale: z.string().min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
  proofNeeded: z.string().min(1),
  riskReason: z.string().min(1).optional(),
  claimCategory: claimCategorySchema.optional(),
  approvalStatus: approvalStatusSchema.optional(),
  proofRequired: z.boolean().optional(),
  proofOwner: z.string().min(1).optional(),
  canAgentEdit: z.boolean().optional(),
  agentInstruction: z.string().min(1).optional(),
});

export const editBriefSchema = z.object({
  clientId: z.string().min(1),
  runId: z.string().min(1),
  generatedAt: z.string().datetime(),
  targets: reportAgentEditPlanSchema.shape.targets,
  rewriteInstructions: z.array(editBriefInstructionSchema),
  manualReview: z.array(editBriefInstructionSchema),
  publicClaimFlags: reportAgentEditPlanSchema.shape.publicClaimFlags,
  proofGateSummary: reportAgentEditPlanSchema.shape.proofGateSummary,
});

export const sourceIntakeItemSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  type: sourceTypeSchema,
  tier: sourceTierSchema,
  trustLevel: trustLevelSchema,
  freshness: sourceFreshnessSchema,
  privacy: sourcePrivacySchema,
  reviewStatus: reviewStatusSchema,
  owner: z.string().min(1),
  approver: z.string().min(1).optional(),
  confidence: sourceConfidenceSchema,
  checksum: z.string().min(1).optional(),
});

export const canonicalDraftSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
  reviewStatus: reviewStatusSchema,
});

export const generatedPromptSchema = redlinePromptSchema.extend({
  clientId: z.string().min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
  rationale: z.string().min(1),
});

export const claimInventoryItemSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  claim: z.string().min(1),
  claimCategory: claimCategorySchema.optional(),
  proofStatus: proofStatusSchema,
  sourceRefs: z.array(z.string().min(1)),
  publicUseApproved: z.boolean(),
  approvalStatus: approvalStatusSchema.optional(),
  proofRequired: z.boolean().optional(),
  proofOwner: z.string().min(1).optional(),
  canAgentEdit: z.boolean().optional(),
  riskNotes: z.string().optional(),
});

export const onboardingAuditTargetSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().optional(),
  path: z.string().min(1).optional(),
  priority: prioritySchema,
}).refine((target) => Boolean(target.url ?? target.path), {
  message: "Onboarding audit target must include url or path.",
});

export const clientOnboardingSessionSchema = z.object({
  clientId: z.string().min(1),
  clientName: z.string().min(1),
  sourceIntake: z.array(sourceIntakeItemSchema),
  canonicalDrafts: z.array(canonicalDraftSchema),
  prompts: z.array(generatedPromptSchema),
  claims: z.array(claimInventoryItemSchema),
  auditTargets: z.array(onboardingAuditTargetSchema).default([]),
});

export const onboardingReadinessLevelSchema = z.enum([
  "ready_to_audit",
  "auditable_with_caveats",
  "blocked",
]);

export const onboardingReadinessReportSchema = z.object({
  clientId: z.string().min(1),
  level: onboardingReadinessLevelSchema,
  blockingIssues: z.array(z.string()),
  caveats: z.array(z.string()),
  recommendedFirstAuditTarget: onboardingAuditTargetSchema.optional(),
  promptsYaml: redlinePromptsFileSchema.optional(),
});

export type ClientConfig = z.infer<typeof clientConfigSchema>;
export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export type CanonicalRegistryEntry = z.infer<typeof canonicalRegistryEntrySchema>;
export type SourceManifest = z.infer<typeof sourceManifestSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
export type AuditMode = z.infer<typeof auditModeSchema>;
export type AuditTarget = z.infer<typeof auditTargetSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type ReportBundle = z.infer<typeof reportBundleSchema>;
export type AgentEditPlan = z.infer<typeof agentEditPlanSchema>;
export type ReportAgentEditPlan = z.infer<typeof reportAgentEditPlanSchema>;
export type EditBriefInstructionKind = z.infer<typeof editBriefInstructionKindSchema>;
export type EditBriefInstruction = z.infer<typeof editBriefInstructionSchema>;
export type EditBrief = z.infer<typeof editBriefSchema>;
export type RedlineLabel = z.infer<typeof redlineLabelSchema>;
export type RedlineAction = z.infer<typeof redlineActionSchema>;
export type RedlinePrompt = z.infer<typeof redlinePromptSchema>;
export type RedlinePromptsFile = z.infer<typeof redlinePromptsFileSchema>;
export type RedlineJudgeResponse = z.infer<typeof redlineJudgeResponseSchema>;
export type SourceIntakeItem = z.infer<typeof sourceIntakeItemSchema>;
export type CanonicalDraft = z.infer<typeof canonicalDraftSchema>;
export type GeneratedPrompt = z.infer<typeof generatedPromptSchema>;
export type ClaimInventoryItem = z.infer<typeof claimInventoryItemSchema>;
export type OnboardingAuditTarget = z.infer<typeof onboardingAuditTargetSchema>;
export type ClientOnboardingSession = z.infer<typeof clientOnboardingSessionSchema>;
export type OnboardingReadinessReport = z.infer<typeof onboardingReadinessReportSchema>;
