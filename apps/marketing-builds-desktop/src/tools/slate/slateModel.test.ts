import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  formatFreezerDate,
  buildUcTabs,
  isSafeSlateLink,
  parseFreezerStorage,
  parseOpportunityTracking,
  parseSlateConfig,
  parseUcMarkdown,
  readApprovedSlateSource,
  renderSlateInline,
  splitUcIntro,
  validateSlateSource,
} from "./slateModel";

const fixtureUrl = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const readFixture = (name: string) => readFileSync(fileURLToPath(fixtureUrl(name)), "utf8");

describe("Slate source contract", () => {
  it("accepts the version-two configuration shape", () => {
    expect(
      parseSlateConfig(
        JSON.stringify({
          version: 2,
          ucPath: "/private/uc.md",
          freezerPath: "/private/freezer-storage.md",
          opportunitiesPath: "/private/opportunities.md",
        }),
      ),
    ).toEqual({
      ok: true,
      config: {
        version: 2,
        ucPath: "/private/uc.md",
        freezerPath: "/private/freezer-storage.md",
        opportunitiesPath: "/private/opportunities.md",
      },
    });
  });

  it.each([
    ["missing config", ""],
    ["invalid JSON", "{"],
    ["unsupported version", JSON.stringify({ version: 1, ucPath: "/private/uc.md", freezerPath: "/private/freezer.md", opportunitiesPath: "/private/opportunities.md" })],
    ["missing opportunity source", JSON.stringify({ version: 2, ucPath: "/private/uc.md", freezerPath: "/private/freezer.md" })],
    ["relative path", JSON.stringify({ version: 2, ucPath: "uc.md", freezerPath: "/private/freezer.md", opportunitiesPath: "/private/opportunities.md" })],
    ["traversal path", JSON.stringify({ version: 2, ucPath: "/private/../other/uc.md", freezerPath: "/private/freezer.md", opportunitiesPath: "/private/opportunities.md" })],
    ["duplicate paths", JSON.stringify({ version: 2, ucPath: "/private/state.md", freezerPath: "/private/state.md", opportunitiesPath: "/private/opportunities.md" })],
    ["non-Markdown source", JSON.stringify({ version: 2, ucPath: "/private/uc.txt", freezerPath: "/private/freezer.md", opportunitiesPath: "/private/opportunities.md" })],
  ])("rejects %s", (_label, contents) => {
    expect(parseSlateConfig(contents)).toMatchObject({ ok: false });
  });

  it.each([
    ["missing source", { exists: false, isRegularFile: false, isSymlink: false, isUtf8: false }],
    ["directory", { exists: true, isRegularFile: false, isSymlink: false, isUtf8: true }],
    ["symlink", { exists: true, isRegularFile: true, isSymlink: true, isUtf8: true }],
    ["non-UTF-8 file", { exists: true, isRegularFile: true, isSymlink: false, isUtf8: false }],
  ])("rejects a %s", (_label, metadata) => {
    expect(validateSlateSource("/private/source.md", metadata)).toMatchObject({ ok: false });
  });

  it("accepts a readable regular file", () => {
    expect(
      validateSlateSource("/private/source.md", {
        exists: true,
        isRegularFile: true,
        isSymlink: false,
        isUtf8: true,
      }),
    ).toEqual({ ok: true });
  });

  it("does not invoke a reader for an unapproved path", () => {
    const read = vi.fn(() => "must not be returned");

    expect(() => readApprovedSlateSource("/private/other.md", ["/private/uc.md"], read)).toThrow(
      "Slate can read only its approved source files.",
    );
    expect(read).not.toHaveBeenCalled();
  });
});

describe("Slate UC model", () => {
  it("preserves heading levels, task order, nesting, emphasis, and safe links", () => {
    expect(parseUcMarkdown(readFixture("uc.md"))).toEqual([
      {
        heading: "Current priorities",
        level: 1,
        paragraphs: [{ text: "Keep this list practical and current.", html: "Keep this list practical and current." }],
        items: [],
      },
      {
        heading: "Client work",
        level: 2,
        paragraphs: [],
        items: [],
      },
      {
        heading: "Launch week",
        level: 3,
        paragraphs: [],
        items: [
          {
            text: "Today",
            html: "<strong>Today</strong>",
            ordered: false,
            children: [
              { text: "Send the draft", html: "Send the draft", ordered: true, children: [] },
              { text: "Review feedback", html: "Review feedback", ordered: true, children: [] },
            ],
          },
          {
            text: "Confirm the meeting brief",
            html: 'Confirm the meeting <a href="https://example.com/brief" rel="noreferrer">brief</a>',
            ordered: false,
            children: [],
          },
        ],
      },
      {
        heading: "Home",
        level: 2,
        paragraphs: [],
        items: [{ text: "Refill pantry staples", html: "Refill pantry staples", ordered: false, children: [] }],
      },
      {
        heading: "Later priorities",
        level: 1,
        paragraphs: [{ text: "Leave this section intact when it has no tasks.", html: "Leave this section intact when it has no tasks." }],
        items: [],
      },
    ]);
  });

  it("renders safe inline semantics and escapes unsafe input", () => {
    expect(renderSlateInline("**Today**")).toBe("<strong>Today</strong>");
    expect(renderSlateInline("Read [the brief](https://example.com/brief).")).toBe(
      'Read <a href="https://example.com/brief" rel="noreferrer">the brief</a>.',
    );
    expect(renderSlateInline("<em>untrusted</em>")).toBe("&lt;em&gt;untrusted&lt;/em&gt;");
    expect(renderSlateInline("[bad](javascript:alert(1))")).toBe("bad");
  });

  it("renders each of multiple inline links independently", () => {
    expect(renderSlateInline("Compare [one](https://example.com/one) and [two](mailto:two@example.com)."))
      .toBe('Compare <a href="https://example.com/one" rel="noreferrer">one</a> and <a href="mailto:two@example.com" rel="noreferrer">two</a>.');
  });

  it("preserves formatted supporting paragraphs", () => {
    expect(parseUcMarkdown("# Focus\nRead [the brief](https://example.com/brief) *carefully*.")[0].paragraphs).toEqual([
      {
        text: "Read the brief carefully.",
        html: 'Read <a href="https://example.com/brief" rel="noreferrer">the brief</a> <em>carefully</em>.',
      },
    ]);
  });

  it("retains Markdown thematic breaks as dividers before the next UC section", () => {
    const sections = parseUcMarkdown("# Focus\n---\n- First task");

    expect(sections[0].paragraphs).toEqual([]);
    expect(sections[0].items.map((item) => item.text)).toEqual(["First task"]);

    const divided = parseUcMarkdown("# Focus\n---\n# Next");
    expect(divided[1].dividerBefore).toBe(true);
  });

  it("groups UC sections under their top-level source headings", () => {
    const tabs = buildUcTabs(parseUcMarkdown("# Current\n## Now\n- Do this\n# Later\n## Queue"));
    expect(tabs.map((tab) => [tab.label, tab.sections.length])).toEqual([["Current", 2], ["Later", 2]]);
  });

  it("keeps a UC document title above the section tabs without promoting its metadata", () => {
    const sections = parseUcMarkdown("# UC — Current Operating State\n---\n# 💼 Brunner Creative\n## Masterpoint");
    const { intro, tabSections } = splitUcIntro(sections);

    expect(intro?.heading).toBe("UC — Current Operating State");
    expect(intro?.paragraphs).toEqual([]);
    expect(buildUcTabs(tabSections).map((tab) => tab.label)).toEqual(["Brunner Creative"]);
  });

  it("allows only safe link protocols", () => {
    expect(isSafeSlateLink("https://example.com/brief")).toBe(true);
    expect(isSafeSlateLink("mailto:hello@example.com")).toBe(true);
    expect(isSafeSlateLink("javascript:alert(1)")).toBe(false);
    expect(isSafeSlateLink("data:text/html,unsafe")).toBe(false);
  });
});

describe("Slate opportunities model", () => {
  it("parses the configured opportunity table without changing source order", () => {
    expect(parseOpportunityTracking("## Opportunity Table\n| Status | Name | Org / Context | Last Contact | Notes | Next Action |\n| --- | --- | --- | --- | --- | --- |\n| 🟡 | Acme | Intro | Apr 14 | Follow up | Email |"))
      .toEqual([{ status: "🟡", name: "Acme", context: "Intro", lastContact: "Apr 14", notes: "Follow up", nextAction: "Email" }]);
  });

  it("rejects a malformed opportunity table", () => {
    expect(() => parseOpportunityTracking("## Opportunity Table\n| Status | Name |\n| --- | --- |")).toThrow("Opportunity Table must include");
  });
});

describe("Slate freezer model", () => {
  it("preserves the storage table rows and blank values", () => {
    expect(parseFreezerStorage(readFixture("freezer-storage.md"))).toEqual([
      {
        item: "chicken thighs",
        count: "2 packs",
        weight: null,
        dateStored: "2026-07-17",
        storage: "outside",
      },
      {
        item: "vegetable stock",
        count: "1 container",
        weight: "32 oz",
        dateStored: null,
        storage: "inside",
      },
    ]);
  });

  it("formats valid dates and leaves unknown date text intact", () => {
    expect(formatFreezerDate("2026-07-17")).toBe("Jul 17, 2026");
    expect(formatFreezerDate("2026-02-31")).toBe("2026-02-31");
    expect(formatFreezerDate("when remembered")).toBe("when remembered");
    expect(formatFreezerDate(null)).toBe("—");
  });

  it("rejects an incomplete storage table", () => {
    expect(() => parseFreezerStorage(readFixture("malformed-freezer-storage.md"))).toThrow(
      "Storage Table must include Item, Count, Weight, Date Stored, and Storage columns.",
    );
  });

  it("rejects a table with an incomplete separator row", () => {
    expect(() => parseFreezerStorage("## Storage Table\n| Item | Count | Weight | Date Stored | Storage |\n| --- | --- |\n| chicken thighs | 2 packs |  | 2026-07-17 | outside |")).toThrow(
      "Storage Table must include Item, Count, Weight, Date Stored, and Storage columns.",
    );
  });
});
