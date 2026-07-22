import { describe, expect, it } from "vitest";
import { getToolById } from "../../tool-registry/tools";
import { getToolViewById } from "../toolViews";
import { defaultSlateTab } from "./slateModel";

describe("Slate registration contract", () => {
  it("registers Slate as a ready local-only bundled tool", () => {
    expect(getToolById("slate")).toMatchObject({
      id: "slate",
      displayName: "Slate",
      status: "ready",
      installMode: "bundled",
      defaultInstalled: true,
      routes: [
        { id: "uc", label: "UC", path: "/slate/uc" },
        { id: "freezer", label: "Freezer", path: "/slate/freezer" },
      ],
    });
  });

  it("exposes a Slate view and opens to UC", () => {
    expect(getToolViewById("slate")).toBeDefined();
    expect(defaultSlateTab()).toBe("uc");
  });
});
