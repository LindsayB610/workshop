import { open } from "@tauri-apps/plugin-dialog";

export type MarkdownFileBrowseResult =
  | { ok: true; path: string }
  | { ok: false; canceled?: boolean; message?: string };

export type BrowseMarkdownFile = (
  currentPath?: string,
) => MarkdownFileBrowseResult | void | Promise<MarkdownFileBrowseResult | void>;

export type OpenMarkdownFilePicker = (options: {
  directory: false;
  multiple: false;
  title: string;
  filters: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
}) => Promise<string | string[] | null>;

const MARKDOWN_EXTENSIONS = ["md", "markdown"];

/** Stable name for Workshop's generic native Markdown-file chooser capability. */
export const BROWSE_MARKDOWN_FILE_CAPABILITY = "browse_markdown_file";

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

function isMarkdownPath(path: string): boolean {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return MARKDOWN_EXTENSIONS.includes(extension);
}

function validMarkdownPath(path: string): boolean {
  return isAbsolutePath(path) && isMarkdownPath(path);
}

/**
 * Opens Workshop's generic native Markdown picker. The picker returns only an
 * intentionally selected path: it does not read, validate, persist, watch, or
 * otherwise act on the file. The plugin decides what, if anything, to do next.
 */
export async function browseMarkdownFile(
  currentPath?: string,
  openMarkdownFilePicker: OpenMarkdownFilePicker = open,
): Promise<MarkdownFileBrowseResult> {
  try {
    const selection = await openMarkdownFilePicker({
      directory: false,
      multiple: false,
      title: "Choose Markdown file",
      filters: [{ name: "Markdown", extensions: MARKDOWN_EXTENSIONS }],
      ...(currentPath && validMarkdownPath(currentPath) ? { defaultPath: currentPath } : {}),
    });

    if (selection === null) {
      return { ok: false, canceled: true };
    }

    if (Array.isArray(selection) || !validMarkdownPath(selection)) {
      return { ok: false, message: "Workshop could not use the selected Markdown file." };
    }

    return { ok: true, path: selection };
  } catch {
    return { ok: false, message: "Workshop could not open the Markdown file picker. Please try again." };
  }
}
