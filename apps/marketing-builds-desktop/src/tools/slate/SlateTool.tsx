import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { AlertCircle, Archive, Clock3, RefreshCw, Rows3 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";
import type { ToolViewProps } from "../types";
import { readSlateSource, startSlateWatch, type SlateSourceBundle, type SlateSourceName, type SlateSourceSnapshot } from "./slateBridge";
import { formatFreezerDate, parseFreezerStorage, parseUcMarkdown, type FreezerRow, type SlateListItem, type SlateSection } from "./slateModel";

export function SlateTool({ activeRouteId, onSetWorkspaceRequest, tool, workspaceRoot }: ToolViewProps) {
  const [bundle, setBundle] = useState<SlateSourceBundle | null>(null);
  const [errors, setErrors] = useState<Partial<Record<SlateSourceName, string>>>({});
  const [loadingSources, setLoadingSources] = useState<SlateSourceName[]>([]);
  const [watchError, setWatchError] = useState<string | null>(null);
  const requestVersions = useRef<Record<SlateSourceName, number>>({ uc: 0, freezer: 0 });
  const activeTab = activeRouteId === "freezer" ? "freezer" : "uc";
  const hasPrivateRoot = Boolean(workspaceRoot?.startsWith("/"));

  const load = useCallback(async () => {
    if (!workspaceRoot?.startsWith("/")) return;
    setLoadingSources(["uc", "freezer"]);
    const sourceNames: SlateSourceName[] = ["uc", "freezer"];
    const requestIds = sourceNames.map((source) => ++requestVersions.current[source]);
    const results = await Promise.allSettled(sourceNames.map((source) => readSlateSource(workspaceRoot, source)));
    const currentSources = sourceNames.filter((source, index) => requestVersions.current[source] === requestIds[index]);
    setBundle((previous) => mergeSlateSourceResults(previous, sourceNames, results, currentSources));
    setErrors((previous) => sourceNames.reduce((next, source, index) => {
      if (requestVersions.current[source] !== requestIds[index]) return next;
      const result = results[index];
      return withSlateSourceError(next, source, result.status === "fulfilled" ? null : slateReadError(result.reason));
    }, previous));
    setLoadingSources((previous) => previous.filter((source) => {
      const index = sourceNames.indexOf(source);
      return index !== -1 && requestVersions.current[source] !== requestIds[index];
    }));
  }, [workspaceRoot]);

  const reloadSource = useCallback(async (source: SlateSourceName) => {
    if (!workspaceRoot?.startsWith("/")) return;
    const requestId = ++requestVersions.current[source];
    setLoadingSources((previous) => addSlateLoadingSource(previous, source));
    try {
      const next = await readSlateSource(workspaceRoot, source);
      if (requestVersions.current[source] === requestId) {
        setBundle((previous) => mergeSlateSourceResults(previous, [source], [{ status: "fulfilled", value: next }]));
        setErrors((previous) => withSlateSourceError(previous, source, null));
      }
    } catch (cause) {
      if (requestVersions.current[source] === requestId) {
        setErrors((previous) => withSlateSourceError(previous, source, slateReadError(cause)));
      }
    } finally {
      if (requestVersions.current[source] === requestId) {
        setLoadingSources((previous) => previous.filter((item) => item !== source));
      }
    }
  }, [workspaceRoot]);

  useEffect(() => {
    if (!hasPrivateRoot || !workspaceRoot) return;
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    const refresh = createSlateRefreshHandler(reloadSource);
    setWatchError(null);

    void (async () => {
      try {
        const stop = await listen<SlateSourceChange>("slate://source-changed", (event) => {
          if (shouldHandleSlateSourceChange(workspaceRoot, event.payload)) refresh.onSourceChanged(event.payload.source);
        });
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
        void startSlateWatch(workspaceRoot).catch((cause: unknown) => {
          if (!disposed) setWatchError(cause instanceof Error ? cause.message : "Slate could not watch its local sources.");
        });
      } catch (cause) {
        if (!disposed) setWatchError(cause instanceof Error ? cause.message : "Slate could not subscribe to local source changes.");
      }
      void load();
    })();

    return () => {
      disposed = true;
      refresh.dispose();
      unlisten?.();
    };
  }, [hasPrivateRoot, load, reloadSource, workspaceRoot]);

  if (!hasPrivateRoot) {
    return (
      <Panel className="slate-setup" id="slate-setup">
        <Rows3 size={24} aria-hidden="true" />
        <p className="eyebrow">Local setup</p>
        <h2>Connect Slate’s private folder</h2>
        <p>Select the folder containing <code>slate.config.json</code>. Slate reads only its two configured Markdown sources.</p>
        <Button variant="secondary" onClick={() => onSetWorkspaceRequest?.(tool.id)}>
          Select Slate folder
        </Button>
      </Panel>
    );
  }

  return <SlateContent activeTab={activeTab} bundle={bundle} error={watchError ?? errors[activeTab] ?? null} loading={loadingSources.includes(activeTab)} onRefresh={() => void load()} />;
}

type SlateSourceChange = { root: string; source: SlateSourceName };

export function shouldHandleSlateSourceChange(selectedRoot: string, change: SlateSourceChange): boolean {
  return normalizeSlateRoot(change.root) === normalizeSlateRoot(selectedRoot);
}

function normalizeSlateRoot(root: string): string {
  return root.length > 1 ? root.replace(/\/+$/, "") : root;
}

export function withSlateSourceError(
  previous: Partial<Record<SlateSourceName, string>>,
  source: SlateSourceName,
  error: string | null,
): Partial<Record<SlateSourceName, string>> {
  const next = { ...previous };
  if (error) next[source] = error;
  else delete next[source];
  return next;
}

export function mergeSlateSourceResults(
  previous: SlateSourceBundle | null,
  sourceNames: SlateSourceName[],
  results: PromiseSettledResult<SlateSourceSnapshot>[],
  acceptedSources: SlateSourceName[] = sourceNames,
): SlateSourceBundle {
  const fallback: SlateSourceSnapshot = { contents: "", updatedAt: 0 };
  const next: SlateSourceBundle = {
    uc: previous?.uc ?? fallback,
    freezer: previous?.freezer ?? fallback,
  };
  for (const [index, source] of sourceNames.entries()) {
    const result = results[index];
    if (acceptedSources.includes(source) && result.status === "fulfilled") next[source] = result.value;
  }
  return next;
}

function addSlateLoadingSource(previous: SlateSourceName[], source: SlateSourceName): SlateSourceName[] {
  return previous.includes(source) ? previous : [...previous, source];
}

function slateReadError(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Slate could not read its local source.";
}

export function createSlateRefreshHandler(reloadSource: (source: SlateSourceName) => void | Promise<void>) {
  let debounce: ReturnType<typeof setTimeout> | undefined;
  return {
    onSourceChanged(source: SlateSourceName) {
      clearTimeout(debounce);
      debounce = setTimeout(() => void reloadSource(source), 300);
    },
    dispose() {
      clearTimeout(debounce);
    },
  };
}

export function SlateContent({
  activeTab,
  bundle,
  error,
  loading,
  onRefresh,
}: {
  activeTab: "uc" | "freezer";
  bundle: SlateSourceBundle | null;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const sections = bundle ? parseUcMarkdown(bundle.uc.contents) : [];
  return (
    <div className="slate-tool">
      <Panel className="slate-summary" id="slate-summary">
        <div>
          <p className="eyebrow">Local operating view</p>
          <h2>{activeTab === "uc" ? "UC" : "Chest Freezer Inventory"}</h2>
          <p>{activeTab === "uc" ? "Your current task ledger, shaped for scanning." : "Your local inventory, shaped for quick reference."}</p>
        </div>
        <div className="slate-summary-actions">
          <Badge tone={error ? "red" : "pink"}>{error ? "Needs attention" : "Local only"}</Badge>
          <Button aria-label="Refresh Slate sources" variant="secondary" onClick={onRefresh}>
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </Panel>

      {loading ? <p className="slate-status" role="status">Refreshing local sources…</p> : null}
      {error ? <p className="slate-status slate-status-error" role="alert"><AlertCircle size={16} aria-hidden="true" /> {error}</p> : null}
      {activeTab === "uc" ? <UcPanel sections={sections} updatedAt={bundle?.uc.updatedAt} /> : <FreezerPanel contents={bundle?.freezer.contents} updatedAt={bundle?.freezer.updatedAt} />}
    </div>
  );
}

function UcPanel({ sections, updatedAt }: { sections: SlateSection[]; updatedAt?: number }) {
  return (
    <Panel className="slate-uc" id="slate-uc">
      <div className="slate-panel-heading"><div><p className="eyebrow">Current ledger</p><h2>UC</h2></div><LastUpdated updatedAt={updatedAt} /></div>
      {sections.length ? <div className="slate-sections">{sections.map((section, index) => <UcSection key={`${section.level}-${section.heading}-${index}`} section={section} />)}</div> : <div className="empty-tool"><Rows3 size={22} aria-hidden="true" /><h3>UC is loading</h3><p>Slate will display the configured local task ledger here.</p></div>}
    </Panel>
  );
}

function UcSection({ section }: { section: SlateSection }) {
  const Heading = (`h${Math.min(section.level + 1, 4)}`) as "h2" | "h3" | "h4";
  const isEmpty = !section.paragraphs.length && !section.items.length;
  return <section className={`slate-section slate-section-level-${section.level}`}><Heading>{section.heading}</Heading>{section.paragraphs.map((paragraph, index) => <p key={index} className="slate-context" dangerouslySetInnerHTML={{ __html: paragraph.html }} />)}{section.items.length ? <SlateList items={section.items} /> : null}{isEmpty ? <p className="slate-context">No tasks or supporting context in this section.</p> : null}</section>;
}

function SlateList({ items }: { items: SlateListItem[] }) {
  const groups: SlateListItem[][] = [];
  for (const item of items) {
    const previous = groups.at(-1);
    if (previous && previous[0].ordered === item.ordered) previous.push(item);
    else groups.push([item]);
  }

  return <>{groups.map((group, groupIndex) => {
    const List = group[0].ordered ? "ol" : "ul";
    return <List className="slate-list" key={`${group[0].ordered}-${groupIndex}`}>{group.map((item, index) => <li key={`${item.text}-${index}`}><span dangerouslySetInnerHTML={{ __html: item.html }} />{item.children.length ? <SlateList items={item.children} /> : null}</li>)}</List>;
  })}</>;
}

function FreezerPanel({ contents, updatedAt }: { contents?: string; updatedAt?: number }) {
  if (!contents?.trim()) {
    return <Panel className="slate-freezer" id="slate-freezer"><Archive size={24} aria-hidden="true" /><h2>Chest Freezer Inventory</h2><p className="slate-context">Awaiting the configured local freezer source.</p><LastUpdated updatedAt={updatedAt} /></Panel>;
  }

  try {
    const rows = parseFreezerStorage(contents);
    return <FreezerTable rows={rows} updatedAt={updatedAt} />;
  } catch (cause) {
    return <Panel className="slate-freezer" id="slate-freezer"><Archive size={24} aria-hidden="true" /><h2>Chest Freezer Inventory</h2><p className="slate-status slate-status-error" role="alert"><AlertCircle size={16} aria-hidden="true" /> {cause instanceof Error ? cause.message : "Slate could not parse the freezer storage table."}</p><LastUpdated updatedAt={updatedAt} /></Panel>;
  }
}

function FreezerTable({ rows, updatedAt }: { rows: FreezerRow[]; updatedAt?: number }) {
  return <Panel className="slate-freezer" id="slate-freezer">
    <div className="slate-panel-heading"><div><p className="eyebrow">Local inventory</p><h2>Chest Freezer Inventory</h2></div><LastUpdated updatedAt={updatedAt} /></div>
    {rows.length ? <div className="slate-table-scroll"><table className="slate-storage-table"><thead><tr><th scope="col">Item</th><th scope="col">Count</th><th scope="col">Weight</th><th scope="col">Date Stored</th><th scope="col">Storage</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.item}-${index}`}><th scope="row">{row.item}</th><td>{row.count || "—"}</td><td>{row.weight ?? "—"}</td><td>{formatFreezerDate(row.dateStored)}</td><td><span className="slate-storage-label">{row.storage || "—"}</span></td></tr>)}</tbody></table></div> : <p className="slate-context">The Storage Table is present but has no inventory rows.</p>}
  </Panel>;
}

function LastUpdated({ updatedAt }: { updatedAt?: number }) {
  return <span className="slate-updated"><Clock3 size={15} aria-hidden="true" />{updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : "Awaiting local source"}</span>;
}
