/**
 * Phase 1 test seam. Phase 2 and Phase 3 replace these throwing stubs with the
 * local-source bridge and presentation model; no Slate source is read here.
 */
export type SlateConfig = {
  version: 1;
  ucPath: string;
  freezerPath: string;
};

export type SlateConfigResult =
  | { ok: true; config: SlateConfig }
  | { ok: false; message: string };

export type SlateSourceMetadata = {
  exists: boolean;
  isRegularFile: boolean;
  isSymlink: boolean;
  isUtf8: boolean;
};

export type SlateSourceValidation =
  | { ok: true }
  | { ok: false; message: string };

export type SlateSection = {
  heading: string;
  level: number;
  dividerBefore?: boolean;
  paragraphs: SlateParagraph[];
  items: SlateListItem[];
};

export type SlateParagraph = {
  text: string;
  html: string;
};

export type SlateListItem = {
  text: string;
  html: string;
  ordered: boolean;
  children: SlateListItem[];
};

export type FreezerRow = {
  item: string;
  count: string;
  weight: string | null;
  dateStored: string | null;
  storage: string;
};

export type SlateRefreshEvent = {
  watchedDirectory: string;
  changedPath: string;
};

export type SlateScheduledReload = {
  sourcePath: string;
  dueAt: number;
};

export type SlateLoadedSource<T> = {
  content: T;
  updatedAt: number;
  error: string | null;
};

export function parseSlateConfig(_contents: string): SlateConfigResult {
  if (!_contents.trim()) {
    return { ok: false, message: "Slate configuration is missing." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(_contents);
  } catch {
    return { ok: false, message: "Slate configuration is not valid JSON." };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Slate configuration must be an object." };
  }

  const config = raw as Partial<SlateConfig>;
  if (config.version !== 1) {
    return { ok: false, message: "Slate configuration version must be 1." };
  }

  if (!isApprovedSlatePath(config.ucPath) || !isApprovedSlatePath(config.freezerPath)) {
    return { ok: false, message: "Slate source paths must be absolute Markdown-file paths without traversal." };
  }

  if (config.ucPath === config.freezerPath) {
    return { ok: false, message: "Slate requires two distinct source files." };
  }

  return {
    ok: true,
    config: { version: 1, ucPath: config.ucPath, freezerPath: config.freezerPath },
  };
}

export function validateSlateSource(
  _path: string,
  _metadata: SlateSourceMetadata,
): SlateSourceValidation {
  if (!isApprovedSlatePath(_path)) {
    return { ok: false, message: "Slate source paths must be absolute Markdown-file paths without traversal." };
  }
  if (!_metadata.exists) return { ok: false, message: "Slate source file is missing." };
  if (_metadata.isSymlink) return { ok: false, message: "Slate source files cannot be symlinks." };
  if (!_metadata.isRegularFile) return { ok: false, message: "Slate source path must be a regular file." };
  if (!_metadata.isUtf8) return { ok: false, message: "Slate source file must be UTF-8 text." };
  return { ok: true };
}

export function parseUcMarkdown(_markdown: string): SlateSection[] {
  const sections: SlateSection[] = [];
  let current: SlateSection | undefined;
  let dividerBefore = false;
  const listStack: Array<{ indent: number; item: SlateListItem }> = [];

  for (const line of _markdown.replace(/\r\n/g, "\n").split("\n")) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = { heading: inlineText(heading[2]), level: heading[1].length, ...(dividerBefore ? { dividerBefore: true } : {}), paragraphs: [], items: [] };
      sections.push(current);
      listStack.length = 0;
      dividerBefore = false;
      continue;
    }

    if (!current || !line.trim()) {
      if (!line.trim()) listStack.length = 0;
      continue;
    }

    if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      listStack.length = 0;
      dividerBefore = true;
      continue;
    }

    const list = /^(\s*)([-*+]|\d+\.)\s+(.+?)\s*$/.exec(line);
    if (list) {
      const indent = list[1].replace(/\t/g, "  ").length;
      const item: SlateListItem = {
        text: inlineText(list[3]),
        html: renderSlateInline(list[3]),
        ordered: /\d+\./.test(list[2]),
        children: [],
      };
      while (listStack.length && listStack[listStack.length - 1].indent >= indent) listStack.pop();
      const parent = listStack[listStack.length - 1]?.item;
      if (parent) parent.children.push(item);
      else current.items.push(item);
      listStack.push({ indent, item });
      continue;
    }

    listStack.length = 0;
    current.paragraphs.push({ text: inlineText(line.trim()), html: renderSlateInline(line.trim()) });
  }

  return sections;
}

export function renderSlateInline(_markdown: string): string {
  let result = "";
  let lastIndex = 0;
  let opening = _markdown.indexOf("[", lastIndex);
  while (opening !== -1) {
    const labelEnd = _markdown.indexOf("](", opening + 1);
    if (labelEnd === -1) break;
    const destination = markdownLinkDestination(_markdown, labelEnd + 2);
    if (!destination) {
      opening = _markdown.indexOf("[", opening + 1);
      continue;
    }
    result += renderSlateFormatting(_markdown.slice(lastIndex, opening));
    const label = renderSlateFormatting(_markdown.slice(opening + 1, labelEnd));
    result += isSafeSlateLink(destination.href)
      ? `<a href="${escapeHtml(destination.href)}" rel="noreferrer">${label}</a>`
      : label;
    lastIndex = destination.end;
    opening = _markdown.indexOf("[", lastIndex);
  }
  return result + renderSlateFormatting(_markdown.slice(lastIndex));
}

export function parseFreezerStorage(_markdown: string): FreezerRow[] {
  const lines = _markdown.replace(/\r\n/g, "\n").split("\n");
  const tableHeading = lines.findIndex((line) => /^#{1,6}\s+Storage Table\s*$/i.test(line));
  if (tableHeading === -1) throw new Error(freezerTableError());

  const headerIndex = lines.findIndex((line, index) => index > tableHeading && line.trim().startsWith("|"));
  if (headerIndex === -1 || !sameFreezerColumns(tableCells(lines[headerIndex]))) throw new Error(freezerTableError());
  const separator = lines[headerIndex + 1];
  const separatorCells = separator ? tableCells(separator) : [];
  if (separatorCells.length !== 5 || !separatorCells.every((cell) => /^:?-{3,}:?$/.test(cell))) throw new Error(freezerTableError());

  const rows: FreezerRow[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim()) break;
    if (!line.trim().startsWith("|")) break;
    const cells = tableCells(line);
    if (cells.length !== 5) throw new Error(freezerTableError());
    rows.push({
      item: cells[0],
      count: cells[1],
      weight: cells[2] || null,
      dateStored: cells[3] || null,
      storage: cells[4],
    });
  }
  return rows;
}

export function formatFreezerDate(_value: string | null): string {
  if (!_value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(_value);
  if (!match) return _value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) return _value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export function isSafeSlateLink(_href: string): boolean {
  try {
    const protocol = new URL(_href).protocol;
    return protocol === "https:" || protocol === "http:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

export function shouldReloadSlateSource(
  _event: SlateRefreshEvent,
  _approvedPaths: string[],
): boolean {
  return (
    _approvedPaths.includes(_event.changedPath) &&
    parentDirectory(_event.changedPath) === _event.watchedDirectory
  );
}

export function scheduleSlateReload(
  _event: SlateRefreshEvent,
  _approvedPaths: string[],
  _now: number,
): SlateScheduledReload | null {
  if (!shouldReloadSlateSource(_event, _approvedPaths)) return null;
  return { sourcePath: _event.changedPath, dueAt: _now + 100 };
}

export function retainSlateSourceOnReloadFailure<T>(
  _previous: SlateLoadedSource<T>,
  _error: string,
): SlateLoadedSource<T> {
  return { ..._previous, error: _error };
}

export function readApprovedSlateSource(
  _path: string,
  _approvedPaths: string[],
  _read: (path: string) => string,
): string {
  if (!_approvedPaths.includes(_path)) {
    throw new Error("Slate can read only its two approved source files.");
  }
  return _read(_path);
}

function isApprovedSlatePath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    /^\/(?!.*(?:^|\/)\.\.(?:\/|$)).+\.md$/.test(path)
  );
}

function parentDirectory(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator <= 0 ? "/" : path.slice(0, separator);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function renderSlateFormatting(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
}

function inlineText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^\s)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function markdownLinkDestination(value: string, start: number): { href: string; end: number } | null {
  let depth = 1;
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "(") depth += 1;
    if (value[index] === ")") depth -= 1;
    if (depth === 0) return { href: value.slice(start, index), end: index + 1 };
  }
  return null;
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function sameFreezerColumns(columns: string[]): boolean {
  return ["Item", "Count", "Weight", "Date Stored", "Storage"].every((column, index) => columns[index] === column) && columns.length === 5;
}

function freezerTableError(): string {
  return "Storage Table must include Item, Count, Weight, Date Stored, and Storage columns.";
}

export function defaultSlateTab(): "uc" | "freezer" {
  return "uc";
}
