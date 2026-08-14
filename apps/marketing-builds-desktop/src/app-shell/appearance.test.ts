import { describe, expect, it } from "vitest";
import { contrast, defaultAppearance, normalizeInitials, paletteAccessibilityIssue, parseCustomPalette, resolveAppearance, themePresets, tokenVariables, tokensForAppearance } from "./appearance";

describe("Workshop appearance model", () => {
  it("ships exactly ten complete, accessible dark presets", () => {
    expect(themePresets).toHaveLength(10);
    for (const preset of themePresets) {
      expect(Object.keys(preset.tokens)).toHaveLength(15);
      expect(contrast(preset.tokens.text, preset.tokens.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(paletteAccessibilityIssue(preset.tokens)).toBeNull();
    }
  });
  it("normalizes exactly two visible initials without accepting noise", () => {
    expect(normalizeInitials(" l.b ")).toBe("LB");
    expect(normalizeInitials("éa")).toBe("ÉA");
    expect(normalizeInitials("Lindsay")).toBeNull();
    expect(normalizeInitials("😀B")).toBeNull();
    expect(normalizeInitials(" ")).toBeNull();
  });
  it("parses valid custom palettes and rejects malformed, duplicate, and unreadable values", () => {
    expect(parseCustomPalette("#070707, #171717, #FF1B8D, #FFDD00")).toMatchObject({ ok: true });
    expect(parseCustomPalette("#070707 #171717 #FF1B8D")).toMatchObject({ ok: false });
    expect(parseCustomPalette("#000 #171717 #FF1B8D #FFDD00")).toMatchObject({ ok: false });
    expect(parseCustomPalette("#FFFFFF #171717 #FF1B8D #FFDD00")).toMatchObject({ ok: false });
  });
  it("recovers safely from corrupt, future, or invalid persisted state", () => {
    expect(resolveAppearance(undefined)).toEqual(defaultAppearance);
    expect(resolveAppearance({ version: 99, initials: "LB", theme: { kind: "preset", presetId: "workshop" } })).toEqual(defaultAppearance);
    expect(resolveAppearance({ version: 1, initials: "LB", theme: { kind: "preset", presetId: "nope" } })).toEqual(defaultAppearance);
  });
  it("derives stable host variables for plugins without exposing preference storage", () => {
    const variables = tokenVariables(tokensForAppearance(defaultAppearance));
    expect(variables["--workshop-canvas"]).toBe("#000000");
    expect(variables["--workshop-focus-ring"]).toBe("#ffdd00");
  });
});
