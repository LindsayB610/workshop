import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SlatePreview } from "./SlatePreview";

describe("SlatePreview", () => {
  it("opens Slate directly without a return to the Workshop catalog", () => {
    const markup = renderToStaticMarkup(<SlatePreview />);

    expect(markup).toContain("Workshop / slate");
    expect(markup).toContain('aria-label="Slate private folder"');
    expect(markup).not.toContain("Tools</span>");
  });
});
