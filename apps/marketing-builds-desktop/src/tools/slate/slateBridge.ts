import { invoke } from "@tauri-apps/api/core";

export type SlateSourceSnapshot = {
  contents: string;
  updatedAt: number;
};

export type SlateSourceBundle = {
  uc: SlateSourceSnapshot;
  freezer: SlateSourceSnapshot;
};

export type SlateSourceName = "uc" | "freezer";

export async function readSlateSource(slateRoot: string, source: SlateSourceName): Promise<SlateSourceSnapshot> {
  return invoke<SlateSourceSnapshot>("slate_read_source", { slateRoot, source });
}

export async function startSlateWatch(slateRoot: string): Promise<void> {
  await invoke("slate_start_watch", { slateRoot });
}
