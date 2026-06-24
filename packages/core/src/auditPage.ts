import { extractPageFromHtml, type ExtractedPage } from "./extract.js";
import {
  parseAndValidateJudgeJson,
  validateJudgeFindings,
  type ValidateJudgeFindingsResult,
} from "./judge.js";
import { generateSinglePageReport, type SinglePageReport } from "./report.js";

export type AuditPageFromHtmlInput = {
  id: string;
  url: string;
  html: string;
  judgeJson: string;
};

export type AuditPageResult = {
  page: ExtractedPage;
  judge: ValidateJudgeFindingsResult & { repaired: boolean; parseError?: string };
  report: SinglePageReport;
};

export function auditPageFromHtml(input: AuditPageFromHtmlInput): AuditPageResult {
  const page = extractPageFromHtml(input);
  const judge = parseAndValidateJudgeJson(input.judgeJson, page);
  const report = generateSinglePageReport(page, judge.validFindings);

  return {
    page,
    judge,
    report,
  };
}

export function auditExtractedPage(
  page: ExtractedPage,
  rawFindings: unknown,
): AuditPageResult {
  const judge = { repaired: false, ...validateJudgeFindings(rawFindings, page) };
  const report = generateSinglePageReport(page, judge.validFindings);

  return {
    page,
    judge,
    report,
  };
}
