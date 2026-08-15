import { open } from "@tauri-apps/plugin-dialog";

export type WorkspaceRootBrowseResult =
  | { ok: true; root: string }
  | { ok: false; canceled?: boolean; message?: string };

export type OpenDirectoryPicker = (options: {
  directory: true;
  multiple: false;
  title: string;
}) => Promise<string | string[] | null>;

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

/**
 * Opens Workshop's generic native directory picker. Choosing a directory does
 * not validate, remember, or activate it; the plugin must later call its
 * existing requestWorkspaceRoot callback after an explicit Connect action.
 */
export async function browseWorkspaceRoot(
  openDirectoryPicker: OpenDirectoryPicker = open,
): Promise<WorkspaceRootBrowseResult | undefined> {
  try {
    const selection = await openDirectoryPicker({
      directory: true,
      multiple: false,
      title: "Choose private folder",
    });

    if (selection === null) {
      return { ok: false, canceled: true };
    }

    if (Array.isArray(selection) || !isAbsolutePath(selection)) {
      return { ok: false, message: "Workshop could not use the selected folder." };
    }

    return { ok: true, root: selection };
  } catch {
    return { ok: false, message: "Workshop could not open the folder picker. Please try again." };
  }
}
