import { useEffect, useMemo, useState } from "react";
import { appearanceStorageKey, defaultAppearance, resolveAppearance, tokenVariables, tokensForAppearance, type AppearancePreference } from "./appearance";

function readAppearance(): AppearancePreference {
  if (typeof window === "undefined") return defaultAppearance;
  try { return resolveAppearance(JSON.parse(window.localStorage.getItem(appearanceStorageKey) ?? "null")); } catch { return defaultAppearance; }
}

export function useAppearance() {
  const [appearance, setAppearance] = useState(readAppearance);
  const tokens = useMemo(() => tokensForAppearance(appearance), [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(tokenVariables(tokens))) root.style.setProperty(name, value);
    root.dataset.workshopTheme = appearance.theme.kind === "preset" ? appearance.theme.presetId : "custom";
    window.localStorage.setItem(appearanceStorageKey, JSON.stringify(appearance));
  }, [appearance, tokens]);

  return { appearance, setAppearance, tokens, resetAppearance: () => setAppearance(defaultAppearance) };
}
