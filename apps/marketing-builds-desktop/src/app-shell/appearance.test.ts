import { describe, expect, it } from "vitest";
import { contrast, defaultAppearance, paletteAccessibilityIssue, parseCustomPalette, resolveAppearance, themeGradient, themePresets, tokenVariables, tokensForAppearance } from "./appearance";

describe("Workshop appearance model", () => {
  it("ships exactly ten complete, accessible dark presets", () => {
    expect(themePresets).toHaveLength(10);
    for (const preset of themePresets) {
      expect(Object.keys(preset.tokens)).toHaveLength(16);
      expect(contrast(preset.tokens.text, preset.tokens.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(paletteAccessibilityIssue(preset.tokens)).toBeNull();
    }
  });
  it("migrates version-one personalized appearances without losing the chosen palette", () => {
    expect(resolveAppearance({ version: 1, initials: "LB", theme: { kind: "preset", presetId: "lagoon" } })).toEqual({ version: 2, theme: { kind: "preset", presetId: "lagoon" } });
    expect(resolveAppearance({ version: 1, initials: "QZ", theme: { kind: "custom", palette: { canvas: "#071116", surface: "#0D1D24", accent: "#2BB7E8", accentWarm: "#62E6BD" } } })).toMatchObject({ version: 2, theme: { kind: "custom" } });
  });
  it("parses valid custom palettes and rejects malformed, duplicate, and unreadable values", () => {
    expect(parseCustomPalette("#070707, #171717, #FF1B8D, #FFDD00")).toMatchObject({ ok: true });
    expect(parseCustomPalette("#070707 #171717 #FF1B8D")).toMatchObject({ ok: false });
    expect(parseCustomPalette("#000 #171717 #FF1B8D #FFDD00")).toMatchObject({ ok: false });
    expect(parseCustomPalette("#FFFFFF #171717 #FF1B8D #FFDD00")).toMatchObject({ ok: false });
  });
  it("recovers safely from corrupt, future, or invalid persisted state", () => {
    expect(resolveAppearance(undefined)).toEqual(defaultAppearance);
    expect(resolveAppearance({ version: 99, theme: { kind: "preset", presetId: "workshop" } })).toEqual(defaultAppearance);
    expect(resolveAppearance({ version: 1, initials: "LB", theme: { kind: "preset", presetId: "nope" } })).toEqual(defaultAppearance);
  });
  it("derives stable host variables for plugins without exposing preference storage", () => {
    const variables = tokenVariables(tokensForAppearance(defaultAppearance));
    expect(variables["--workshop-canvas"]).toBe("#000000");
    expect(variables["--workshop-focus-ring"]).toBe("#ffdd00");
    expect(variables["--workshop-gradient-middle"]).toBe("#ff1b8d");
  });

  it("keeps the Workshop mark red through hot pink into yellow", () => {
    const tokens = tokensForAppearance(defaultAppearance);
    expect(tokens.gradientStart).toBe("#ff0037");
    expect(tokens.gradientMiddle).toBe("#ff1b8d");
    expect(themeGradient(tokens)).toBe("linear-gradient(135deg, #ff0037 0%, #ff1b8d 50%, #ffdd00 100%)");
  });
});
