import * as cheerio from "cheerio";

export type ExtractedLink = {
  text: string;
  href: string;
  isInternal: boolean;
};

export type ExtractedPage = {
  id: string;
  url: string;
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  lastModified: string;
  publishedDate: string;
  headings: string[];
  bodyText: string;
  wordCount: number;
  isEmptyShell: boolean;
  links: ExtractedLink[];
};

export type ExtractPageInput = {
  id: string;
  url: string;
  html: string;
  thinThreshold?: number;
};

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function extractPageFromHtml(input: ExtractPageInput): ExtractedPage {
  const $ = cheerio.load(input.html);
  const baseUrl = new URL(input.url);
  const baseHref = $("base[href]").first().attr("href");
  const resolvedBaseUrl = baseHref ? new URL(baseHref, baseUrl) : baseUrl;
  const thinThreshold = input.thinThreshold ?? 50;
  const $bodyForText = $("body").clone();

  $bodyForText.children("header, footer").remove();
  $bodyForText
    .find("nav, footer, aside, script, style, noscript, svg, template, [aria-hidden=true]")
    .remove();

  const primaryRegion = $bodyForText.find("main").first().length
    ? $bodyForText.find("main").first()
    : $bodyForText.find("article").first().length
      ? $bodyForText.find("article").first()
      : $bodyForText;
  const bodyText = normalizeText(primaryRegion.text());
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  const title = normalizeText($("title").first().text() || $("h1").first().text());
  const metaDescription = normalizeText(
    $('meta[name="description"]').attr("content") ?? "",
  );
  const canonicalUrl = normalizeText(
    $("link[rel='canonical']").first().attr("href") ?? "",
  );
  const lastModified = normalizeText(
    $('meta[property="article:modified_time"]').attr("content") ??
      $('meta[name="last-modified"]').attr("content") ??
      "",
  );
  const publishedDate = normalizeText(
    $('meta[property="article:published_time"]').attr("content") ??
      $("time[datetime]").first().attr("datetime") ??
      "",
  );
  const headings = $("h1, h2, h3, h4, h5, h6")
    .toArray()
    .map((heading) => normalizeText($(heading).text()))
    .filter(Boolean);
  const candidateLinks = $("a[href]")
    .toArray()
    .flatMap((link) => {
      const href = $(link).attr("href") ?? "";
      if (
        !href ||
        href.startsWith("mailto:") ||
        href.startsWith("javascript:") ||
        href.startsWith("tel:")
      ) {
        return [];
      }

      const resolved = new URL(href, resolvedBaseUrl);
      resolved.hash = "";

      return [{
        text: normalizeText($(link).text()),
        href: resolved.toString(),
        isInternal: resolved.host === baseUrl.host,
      }];
    });
  const links = candidateLinks.filter(
    (link, index, allLinks) =>
      allLinks.findIndex((candidate) => candidate.href === link.href) === index,
  );

  return {
    id: input.id,
    url: input.url,
    title,
    metaDescription,
    canonicalUrl,
    lastModified,
    publishedDate,
    headings,
    bodyText,
    wordCount,
    isEmptyShell: wordCount < thinThreshold,
    links,
  };
}

export function pageIncludesExactQuote(page: ExtractedPage, quotedText: string): boolean {
  return [
    page.title,
    page.metaDescription,
    ...page.headings,
    page.bodyText,
  ].some((field) => field.includes(quotedText));
}
