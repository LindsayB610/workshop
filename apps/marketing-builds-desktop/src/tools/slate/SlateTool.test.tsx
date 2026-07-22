import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createSlateRefreshHandler, mergeSlateSourceResults, shouldHandleSlateSourceChange, SlateContent, withSlateSourceError } from "./SlateTool";
import type { SlateSourceBundle } from "./slateBridge";

const bundle: SlateSourceBundle = {
  uc: {
    contents: "# Today\nContext with [one](https://example.com/one) and [two](https://example.com/two).\n- First\n  1. Numbered child\n- Second",
    updatedAt: 1_784_612_800_000,
  },
  freezer: { contents: "# Storage Table", updatedAt: 1_784_612_800_000 },
};

describe("Slate tool presentation", () => {
  it("renders loaded UC content with semantic nested ordered lists and formatted context", () => {
    const markup = renderToStaticMarkup(<SlateContent activeTab="uc" bundle={bundle} error={null} loading={false} onRefresh={() => undefined} />);

    expect(markup).toContain("Current ledger");
    expect(markup).toContain('<ul class="slate-list">');
    expect(markup).toContain('<ol class="slate-list">');
    expect(markup).toContain('href="https://example.com/one"');
    expect(markup).toContain('href="https://example.com/two"');
  });

  it("renders the selected freezer tab and a retained-read failure state", () => {
    const markup = renderToStaticMarkup(<SlateContent activeTab="freezer" bundle={bundle} error="Could not read Slate source" loading={false} onRefresh={() => undefined} />);

    expect(markup).toContain("Chest Freezer Inventory");
    expect(markup).toContain("Could not read Slate source");
    expect(markup).not.toContain("Current ledger");
  });

  it("renders the freezer storage source as a semantic table", () => {
    const markup = renderToStaticMarkup(<SlateContent activeTab="freezer" bundle={{ ...bundle, freezer: { contents: "# Freezer Storage\n\n## Storage Table\n\n| Item | Count | Weight | Date Stored | Storage |\n| --- | --- | --- | --- | --- |\n| chicken thighs | 2 packs |  | 2026-07-17 | outside |", updatedAt: 1 } }} error={null} loading={false} onRefresh={() => undefined} />);

    expect(markup).toContain("<table");
    expect(markup).toContain("chicken thighs");
    expect(markup).toContain("Jul 17, 2026");
    expect(markup).toContain("—");
  });

  it("renders distinct empty and malformed freezer states", () => {
    const emptyMarkup = renderToStaticMarkup(<SlateContent activeTab="freezer" bundle={{ ...bundle, freezer: { contents: "## Storage Table\n| Item | Count | Weight | Date Stored | Storage |\n| --- | --- | --- | --- | --- |", updatedAt: 1 } }} error={null} loading={false} onRefresh={() => undefined} />);
    const malformedMarkup = renderToStaticMarkup(<SlateContent activeTab="freezer" bundle={{ ...bundle, freezer: { contents: "## Storage Table\n| Item | Count |\n| --- | --- |", updatedAt: 1 } }} error={null} loading={false} onRefresh={() => undefined} />);

    expect(emptyMarkup).toContain("The Storage Table is present but has no inventory rows.");
    expect(malformedMarkup).toContain("Storage Table must include Item, Count, Weight, Date Stored, and Storage columns.");
  });

  it("debounces watcher events and reloads only the changed source", () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    const refresh = createSlateRefreshHandler(reload);

    refresh.onSourceChanged("uc");
    refresh.onSourceChanged("freezer");
    vi.advanceTimersByTime(299);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reload).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledWith("freezer");

    refresh.onSourceChanged("uc");
    refresh.dispose();
    vi.advanceTimersByTime(300);
    expect(reload).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("retains a freezer error when UC successfully refreshes", () => {
    expect(withSlateSourceError({ freezer: "Freezer source is unavailable" }, "uc", null)).toEqual({
      freezer: "Freezer source is unavailable",
    });
  });

  it("keeps the UC view available when the freezer initial read fails", () => {
    const next = mergeSlateSourceResults(null, ["uc", "freezer"], [
      { status: "fulfilled", value: bundle.uc },
      { status: "rejected", reason: new Error("Freezer source is unavailable") },
    ]);

    expect(next.uc).toEqual(bundle.uc);
    expect(next.freezer).toEqual({ contents: "", updatedAt: 0 });
  });

  it("does not let an older UC request overwrite a newer refresh", () => {
    const next = mergeSlateSourceResults(bundle, ["uc", "freezer"], [
      { status: "fulfilled", value: { contents: "# Stale UC", updatedAt: 1 } },
      { status: "fulfilled", value: { contents: "# Freezer", updatedAt: 1 } },
    ], ["freezer"]);

    expect(next.uc).toEqual(bundle.uc);
    expect(next.freezer.contents).toBe("# Freezer");
  });

  it("renders an explicit empty state for an empty UC section", () => {
    const markup = renderToStaticMarkup(<SlateContent activeTab="uc" bundle={{ ...bundle, uc: { contents: "# Empty section", updatedAt: 1 } }} error={null} loading={false} onRefresh={() => undefined} />);

    expect(markup).toContain("No tasks or supporting context in this section.");
  });

  it("initializes UC when its refresh completes before the initial bundle", () => {
    const next = mergeSlateSourceResults(null, ["uc"], [{ status: "fulfilled", value: bundle.uc }]);

    expect(next.uc).toEqual(bundle.uc);
    expect(next.freezer).toEqual({ contents: "", updatedAt: 0 });
  });

  it("accepts watcher events only from the selected Slate root", () => {
    expect(shouldHandleSlateSourceChange("/private/slate-a", { root: "/private/slate-a", source: "uc" })).toBe(true);
    expect(shouldHandleSlateSourceChange("/private/slate-a/", { root: "/private/slate-a", source: "uc" })).toBe(true);
    expect(shouldHandleSlateSourceChange("/private/slate-a", { root: "/private/slate-b", source: "uc" })).toBe(false);
  });
});
