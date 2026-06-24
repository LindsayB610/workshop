import { type ExtractedPage, pageIncludesExactQuote } from "./extract.js";
import {
  findingSchema,
  redlineJudgeResponseSchema,
  type Finding,
  type RedlineJudgeResponse,
  type RedlinePromptsFile,
} from "./schemas.js";

export type JudgeParseResult =
  | { ok: true; repaired: boolean; data: unknown }
  | { ok: false; repaired: boolean; error: string };

export type FindingValidationIssue =
  | "malformed_finding"
  | "quoted_text_not_found"
  | "missing_source_reference";

export type ValidatedFinding =
  | { valid: true; finding: Finding }
  | {
      valid: false;
      issue: FindingValidationIssue;
      message: string;
      rawFinding: unknown;
    };

export type ValidateJudgeFindingsResult = {
  validFindings: Finding[];
  invalidFindings: ValidatedFinding[];
};

export type RedlineJudgeValidationResult =
  | { valid: true; response: RedlineJudgeResponse }
  | { valid: false; issue: string; message: string };

function stripCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonCandidate(raw: string): string {
  const stripped = stripCodeFence(raw);
  const arrayStart = stripped.indexOf("[");
  const objectStart = stripped.indexOf("{");
  const starts = [arrayStart, objectStart].filter((index) => index >= 0);

  if (starts.length === 0) {
    return stripped;
  }

  const start = Math.min(...starts);
  const end = stripped.lastIndexOf(stripped[start] === "[" ? "]" : "}");

  if (end <= start) {
    return stripped;
  }

  return stripped.slice(start, end + 1);
}

export function parseJudgeJson(raw: string): JudgeParseResult {
  try {
    return { ok: true, repaired: false, data: JSON.parse(raw) };
  } catch {
    const repairedCandidate = extractJsonCandidate(raw);
    try {
      return {
        ok: true,
        repaired: true,
        data: JSON.parse(repairedCandidate),
      };
    } catch (error) {
      return {
        ok: false,
        repaired: repairedCandidate !== raw,
        error: error instanceof Error ? error.message : "Unknown JSON parse error",
      };
    }
  }
}

export function coerceJudgeFindings(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object" && "findings" in data) {
    const findings = (data as { findings?: unknown }).findings;
    return Array.isArray(findings) ? findings : [];
  }

  return data ? [data] : [];
}

export function validateFindingAgainstPage(
  rawFinding: unknown,
  page: ExtractedPage,
): ValidatedFinding {
  const parsed = findingSchema.safeParse(rawFinding);

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    const hasMissingSourceRefs = Boolean(flattened.fieldErrors.sourceRefs?.length);

    return {
      valid: false,
      issue: hasMissingSourceRefs ? "missing_source_reference" : "malformed_finding",
      message: parsed.error.message,
      rawFinding,
    };
  }

  if (!pageIncludesExactQuote(page, parsed.data.quotedText)) {
    return {
      valid: false,
      issue: "quoted_text_not_found",
      message: `quotedText was not found in target page: ${parsed.data.quotedText}`,
      rawFinding,
    };
  }

  return { valid: true, finding: parsed.data };
}

export function validateJudgeFindings(
  rawFindings: unknown,
  page: ExtractedPage,
): ValidateJudgeFindingsResult {
  const checked = coerceJudgeFindings(rawFindings).map((finding) =>
    validateFindingAgainstPage(finding, page),
  );

  return {
    validFindings: checked
      .filter((finding): finding is { valid: true; finding: Finding } => finding.valid)
      .map((finding) => finding.finding),
    invalidFindings: checked.filter(
      (finding): finding is Extract<ValidatedFinding, { valid: false }> =>
        !finding.valid,
    ),
  };
}

export function parseAndValidateJudgeJson(
  raw: string,
  page: ExtractedPage,
): ValidateJudgeFindingsResult & { repaired: boolean; parseError?: string } {
  const parsed = parseJudgeJson(raw);

  if (!parsed.ok) {
    return {
      repaired: parsed.repaired,
      parseError: parsed.error,
      validFindings: [],
      invalidFindings: [],
    };
  }

  return {
    repaired: parsed.repaired,
    ...validateJudgeFindings(parsed.data, page),
  };
}

export function validateRedlineJudgeResponse(
  rawResponse: unknown,
  page: ExtractedPage,
  promptsFile: RedlinePromptsFile,
): RedlineJudgeValidationResult {
  const parsed = redlineJudgeResponseSchema.safeParse(rawResponse);

  if (!parsed.success) {
    return {
      valid: false,
      issue: "schema_invalid",
      message: parsed.error.message,
    };
  }

  const response = parsed.data;

  if (response.confidence > 10 && response.confidence <= 100) {
    response.confidence = response.confidence / 100;
  }
  response.confidence = Math.max(0, Math.min(1, response.confidence));

  if (
    response.primary_label === "Aligned" &&
    (response.findings.length > 0 ||
      response.edit_plan ||
      response.suggested_action !== "KEEP" ||
      response.page_summary.should_focus_on)
  ) {
    return {
      valid: false,
      issue: "aligned_invariant",
      message:
        "Aligned pages must have no findings, no edit_plan, no should_focus_on, and KEEP action.",
    };
  }

  if (
    (response.suggested_action === "UPDATE" ||
      response.suggested_action === "REWRITE") &&
    (!response.edit_plan || response.findings.length === 0)
  ) {
    return {
      valid: false,
      issue: "edit_action_requires_plan",
      message: "UPDATE and REWRITE require at least one finding and an edit_plan.",
    };
  }

  if (
    response.suggested_action === "DELETE" &&
    (response.findings.length === 0 || response.edit_plan)
  ) {
    return {
      valid: false,
      issue: "delete_invariant",
      message: "DELETE requires at least one finding and no edit_plan.",
    };
  }

  if (response.suggested_action === "MANUAL_REVIEW" && response.confidence >= 0.6) {
    return {
      valid: false,
      issue: "manual_review_confidence_invariant",
      message: "MANUAL_REVIEW requires confidence below 0.6.",
    };
  }

  const missingQuote = response.findings.find(
    (finding) => !pageIncludesExactQuote(page, finding.quoted_text),
  );
  if (missingQuote) {
    return {
      valid: false,
      issue: "quoted_text_not_found",
      message: `quoted_text was not found in target page: ${missingQuote.quoted_text}`,
    };
  }

  const knownPromptIds = new Set(promptsFile.prompts.map((prompt) => prompt.id));
  const unknownPromptId = (response.affected_prompts ?? []).find(
    (promptId) => !knownPromptIds.has(promptId),
  );
  if (unknownPromptId) {
    return {
      valid: false,
      issue: "unknown_affected_prompt",
      message: `affected_prompts contains unknown prompt id "${unknownPromptId}".`,
    };
  }

  return { valid: true, response };
}
