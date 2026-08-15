export const appearanceStorageKey = "workshop.appearance.v1";
export const appearanceVersion = 2;

export type ThemeTokens = {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentStrong: string;
  accentWarm: string;
  focusRing: string;
  success: string;
  warning: string;
  danger: string;
  gradientStart: string;
  gradientMiddle: string;
  gradientEnd: string;
};

export type ThemePreset = { id: string; name: string; description: string; tokens: ThemeTokens };
export type CustomPalette = Pick<ThemeTokens, "canvas" | "surface" | "accent" | "accentWarm">;
export type AppearancePreference = {
  version: 2;
  theme: { kind: "preset"; presetId: string } | { kind: "custom"; palette: CustomPalette };
};

const darkTokens = (colors: CustomPalette): ThemeTokens => ({
  ...colors,
  surfaceRaised: mix(colors.surface, "#ffffff", 0.07),
  border: mix(colors.surface, "#ffffff", 0.34),
  text: "#ffffff",
  textMuted: "#b7b7bd",
  accentStrong: mix(colors.accent, "#ffffff", 0.12),
  focusRing: colors.accentWarm,
  success: "#56d68b",
  warning: "#ffd34d",
  danger: "#ff5a79",
  gradientStart: colors.accent,
  gradientMiddle: mix(colors.accent, colors.accentWarm, 0.5),
  gradientEnd: colors.accentWarm,
});

export const themePresets: ThemePreset[] = [
  { id: "workshop", name: "Workshop", description: "The original hot-pink workshop floor.", tokens: { ...darkTokens({ canvas: "#000000", surface: "#0f0f0f", accent: "#ff1b8d", accentWarm: "#ffdd00" }), gradientStart: "#ff0037", gradientMiddle: "#ff1b8d" } },
  { id: "lagoon", name: "Lagoon", description: "Deep water, electric blue, sea-glass heat.", tokens: darkTokens({ canvas: "#071116", surface: "#0d1d24", accent: "#2bb7e8", accentWarm: "#62e6bd" }) },
  { id: "evergreen", name: "Evergreen", description: "Ink-dark pine with a clean acid-green edge.", tokens: darkTokens({ canvas: "#08120d", surface: "#112219", accent: "#46cf85", accentWarm: "#d4ed5b" }) },
  { id: "aubergine", name: "Aubergine", description: "Plum-black surfaces with a vivid orchid signal.", tokens: darkTokens({ canvas: "#130916", surface: "#241129", accent: "#ca78f2", accentWarm: "#ff9d71" }) },
  { id: "ember", name: "Ember", description: "Charcoal, vermilion, and furnace-gold emphasis.", tokens: darkTokens({ canvas: "#160b08", surface: "#28130e", accent: "#ff6545", accentWarm: "#ffc44d" }) },
  { id: "indigo", name: "Indigo", description: "Night blue with ultraviolet and clean lime contrast.", tokens: darkTokens({ canvas: "#090d20", surface: "#121934", accent: "#7888ff", accentWarm: "#c9ef5d" }) },
  { id: "iron", name: "Iron", description: "Graphite, steel, and a controlled brass flare.", tokens: darkTokens({ canvas: "#090a0c", surface: "#171a1f", accent: "#a9b4c3", accentWarm: "#f0c978" }) },
  { id: "field", name: "Field", description: "Weathered green with dry-grass warmth.", tokens: darkTokens({ canvas: "#0a100d", surface: "#17221b", accent: "#9bcb72", accentWarm: "#d5b16b" }) },
  { id: "harbor", name: "Harbor", description: "Cold water, painted steel, and dock-light gold.", tokens: darkTokens({ canvas: "#071016", surface: "#12212a", accent: "#76bbd9", accentWarm: "#e0ba6a" }) },
  { id: "kiln", name: "Kiln", description: "Sooted clay, iron heat, and fired sandstone.", tokens: darkTokens({ canvas: "#120b08", surface: "#241510", accent: "#d69a70", accentWarm: "#e6c56d" }) },
];

export const defaultAppearance: AppearancePreference = { version: 2, theme: { kind: "preset", presetId: "workshop" } };

export function parseCustomPalette(value: string): { ok: true; palette: CustomPalette } | { ok: false; message: string } {
  const colors = value.trim().split(/[\s,]+/).filter(Boolean).map((color) => color.toUpperCase());
  if (colors.length !== 4) return { ok: false, message: "Paste exactly four hex colors: canvas, surface, primary, warm accent." };
  if (colors.some((color) => !/^#[0-9A-F]{6}$/.test(color))) return { ok: false, message: "Use six-digit hex values such as #0F0F0F." };
  if (new Set(colors).size !== colors.length) return { ok: false, message: "Each custom color must be distinct." };
  const [canvas, surface, accent, accentWarm] = colors;
  const palette = { canvas, surface, accent, accentWarm };
  const validation = validatePalette(palette);
  return validation.ok ? { ok: true, palette } : validation;
}

export function validatePalette(palette: CustomPalette): { ok: true } | { ok: false; message: string } {
  const tokens = darkTokens(palette);
  const issue = paletteAccessibilityIssue(tokens);
  return issue ? { ok: false, message: issue } : { ok: true };
}

export function paletteAccessibilityIssue(tokens: ThemeTokens): string | null {
  const surfaces = [tokens.canvas, tokens.surface, tokens.surfaceRaised];
  if (surfaces.some((surface) => contrast(tokens.text, surface) < 4.5)) return "Canvas and surface must keep white text readable (4.5:1 minimum).";
  if (surfaces.some((surface) => contrast(tokens.textMuted, surface) < 4.5)) return "Canvas and surface must keep muted text readable (4.5:1 minimum).";
  if ([tokens.accent, tokens.accentStrong, tokens.accentWarm, tokens.success, tokens.warning, tokens.danger].some((color) => contrast("#000000", color) < 4.5)) return "Action and status colors must keep dark text readable (4.5:1 minimum).";
  if ([tokens.accent, tokens.accentStrong, tokens.accentWarm, tokens.focusRing, tokens.success, tokens.warning, tokens.danger].some((color) => contrast(color, tokens.surface) < 3)) return "Action, status, and focus colors must remain distinct from the surface (3:1 minimum).";
  if (contrast(tokens.border, tokens.surface) < 3) return "Surface borders must remain visible (3:1 minimum).";
  return null;
}

export function resolveAppearance(stored: unknown): AppearancePreference {
  if (!stored || typeof stored !== "object") return defaultAppearance;
  const candidate = stored as { version?: unknown; theme?: unknown };
  // Version 1 also stored user initials. Preserve its theme while deliberately
  // retiring that runtime-only personal mark in favor of the Workshop logo.
  if (candidate.version !== 1 && candidate.version !== appearanceVersion) return defaultAppearance;
  if (!candidate.theme) return defaultAppearance;
  const theme = candidate.theme as AppearancePreference["theme"];
  if (theme.kind === "preset" && themePresets.some((preset) => preset.id === theme.presetId)) return { version: 2, theme: { kind: "preset", presetId: theme.presetId } };
  if (theme.kind === "custom" && validatePalette(theme.palette).ok) return { version: 2, theme: { kind: "custom", palette: theme.palette } };
  return defaultAppearance;
}

export function tokensForAppearance(preference: AppearancePreference): ThemeTokens {
  const theme = preference.theme;
  if (theme.kind === "custom") return darkTokens(theme.palette);
  return themePresets.find((preset) => preset.id === theme.presetId)?.tokens ?? themePresets[0].tokens;
}

export function tokenVariables(tokens: ThemeTokens): Record<string, string> {
  return Object.fromEntries(Object.entries(tokens).map(([name, color]) => [`--workshop-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, color]));
}

export function themeGradient(tokens: Pick<ThemeTokens, "gradientStart" | "gradientMiddle" | "gradientEnd">): string {
  return `linear-gradient(135deg, ${tokens.gradientStart} 0%, ${tokens.gradientMiddle} 50%, ${tokens.gradientEnd} 100%)`;
}

function mix(first: string, second: string, amount: number) {
  const a = hexToRgb(first); const b = hexToRgb(second);
  return `#${[a.r, a.g, a.b].map((channel, index) => Math.round(channel + ([b.r, b.g, b.b][index] - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
}
function hexToRgb(hex: string) { return { r: Number.parseInt(hex.slice(1, 3), 16), g: Number.parseInt(hex.slice(3, 5), 16), b: Number.parseInt(hex.slice(5, 7), 16) }; }
function luminance(hex: string) { return Object.values(hexToRgb(hex)).map((channel) => { const unit = channel / 255; return unit <= .03928 ? unit / 12.92 : ((unit + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [0.2126, .7152, .0722][index], 0); }
export function contrast(first: string, second: string) { const [a, b] = [luminance(first), luminance(second)].sort((x, y) => y - x); return (a + .05) / (b + .05); }
