import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { tokensForAppearance, themePresets } from "./appearance";
import { WorkshopMark } from "./WorkshopMark";

describe("WorkshopMark", () => {
  it("renders the fixed tabletop-and-W product mark without initials or a container", () => {
    const markup = renderToStaticMarkup(<WorkshopMark />);

    expect(markup).toContain('aria-label="Workshop mark"');
    expect(markup).toContain("workshop-mark-table");
    expect(markup).toContain("workshop-mark-w");
    expect(markup).toContain("workshop-mark-inlay");
    expect(markup).not.toContain("LB");
    expect(markup).not.toContain("rect");
  });

  it("receives semantic theme colors rather than hard-coding a Slate or Pulse palette", () => {
    const lagoon = tokensForAppearance({ version: 2, theme: { kind: "preset", presetId: "lagoon" } });
    const markup = renderToStaticMarkup(<WorkshopMark tokens={lagoon} />);

    expect(markup).toContain("--workshop-mark-w:#2bb7e8");
    expect(markup).toContain("--workshop-mark-inlay:#62e6bd");
    expect(markup).toContain(`--workshop-mark-table:${lagoon.text}`);
    expect(themePresets).toContainEqual(expect.objectContaining({ id: "lagoon" }));
  });
});
