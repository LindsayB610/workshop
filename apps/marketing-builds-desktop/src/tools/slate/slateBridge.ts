import { invoke } from "@tauri-apps/api/core";

export type SlateSourceSnapshot = {
  contents: string;
  updatedAt: number;
};

export type SlateSourceBundle = {
  uc: SlateSourceSnapshot;
  freezer: SlateSourceSnapshot;
  opportunities: SlateSourceSnapshot;
};

export type SlateSourceName = "uc" | "freezer" | "opportunities";

export const isSlateLocalPreview = import.meta.env.DEV && import.meta.env.VITE_SLATE_PREVIEW === "true";

export async function readSlateSource(slateRoot: string, source: SlateSourceName): Promise<SlateSourceSnapshot> {
  if (isSlateLocalPreview) {
    const response = await fetch(`/__slate-preview/${source}`);
    if (!response.ok) throw new Error("Slate preview could not read its configured local source.");
    return response.json() as Promise<SlateSourceSnapshot>;
  }
  return invoke<SlateSourceSnapshot>("slate_read_source", { slateRoot, source });
}

export async function startSlateWatch(slateRoot: string): Promise<void> {
  if (isSlateLocalPreview) return;
  await invoke("slate_start_watch", { slateRoot });
}
