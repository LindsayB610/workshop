import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { AlertCircle, Archive, Check, Clock3, FolderKey, Rows3, TableProperties } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";
import type { ToolViewProps } from "../types";
import { isSlateLocalPreview, readSlateSource, startSlateWatch, type SlateSourceBundle, type SlateSourceName, type SlateSourceSnapshot } from "./slateBridge";
import { buildUcTabs, formatFreezerDate, parseFreezerStorage, parseOpportunityTracking, parseUcMarkdown, splitUcIntro, type FreezerRow, type OpportunityRow, type SlateListItem, type SlateSection } from "./slateModel";

type SlateView = "home" | SlateSourceName;

export function SlateTool({ onSetWorkspaceRequest, tool, workspaceRoot }: ToolViewProps) {
  const [bundle, setBundle] = useState<SlateSourceBundle | null>(null);
  const [errors, setErrors] = useState<Partial<Record<SlateSourceName, string>>>({});
  const [loadingSources, setLoadingSources] = useState<SlateSourceName[]>([]);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [setupRoot, setSetupRoot] = useState("");
  const [view, setView] = useState<SlateView>("home");
  const requestVersions = useRef<Record<SlateSourceName, number>>({ uc: 0, freezer: 0, opportunities: 0 });
  const hasPrivateRoot = isSlateLocalPreview || Boolean(workspaceRoot?.startsWith("/"));

  const load = useCallback(async (quiet = false) => {
    if (!isSlateLocalPreview && !workspaceRoot?.startsWith("/")) return;
    if (!quiet) setLoadingSources(["uc", "freezer", "opportunities"]);
    const sourceNames: SlateSourceName[] = ["uc", "freezer", "opportunities"];
    const requestIds = sourceNames.map((source) => ++requestVersions.current[source]);
    const results = await Promise.allSettled(sourceNames.map((source) => readSlateSource(workspaceRoot ?? "", source)));
    const currentSources = sourceNames.filter((source, index) => requestVersions.current[source] === requestIds[index]);
    setBundle((previous) => {
      const next = mergeSlateSourceResults(previous, sourceNames, results, currentSources);
      return slateBundlesMatch(previous, next) ? previous : next;
    });
    setErrors((previous) => sourceNames.reduce((next, source, index) => {
      if (requestVersions.current[source] !== requestIds[index]) return next;
      const result = results[index];
      return withSlateSourceError(next, source, result.status === "fulfilled" ? null : slateReadError(result.reason));
    }, previous));
    if (!quiet) {
      setLoadingSources((previous) => previous.filter((source) => {
        const index = sourceNames.indexOf(source);
        return index !== -1 && requestVersions.current[source] !== requestIds[index];
      }));
    }
  }, [workspaceRoot]);

  const reloadSource = useCallback(async (source: SlateSourceName) => {
    if (!isSlateLocalPreview && !workspaceRoot?.startsWith("/")) return;
    const requestId = ++requestVersions.current[source];
    setLoadingSources((previous) => addSlateLoadingSource(previous, source));
    try {
      const next = await readSlateSource(workspaceRoot ?? "", source);
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
    if (!hasPrivateRoot || (!workspaceRoot && !isSlateLocalPreview)) return;
    const selectedRoot = workspaceRoot ?? "";
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    const refresh = createSlateRefreshHandler(reloadSource);
    setWatchError(null);

    void (async () => {
      if (isSlateLocalPreview) {
        void load();
        return;
      }
      try {
        const stop = await listen<SlateSourceChange>("local-markdown://source-changed", (event) => {
          if (shouldHandleSlateSourceChange(selectedRoot, event.payload)) refresh.onSourceChanged(event.payload.source);
        });
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
        void startSlateWatch(selectedRoot).catch((cause: unknown) => {
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

  useEffect(() => {
    if (!isSlateLocalPreview) return;
    const timer = window.setInterval(() => void load(true), 250);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!hasPrivateRoot) {
    return (
      <SlateSetup
        root={setupRoot}
        onRootChange={setSetupRoot}
        onConnect={() => onSetWorkspaceRequest?.(tool.id, setupRoot)}
      />
    );
  }

  return <SlateContent view={view} onSelectView={setView} bundle={bundle} error={view === "home" ? watchError : watchError ?? errors[view] ?? null} loading={view !== "home" && loadingSources.includes(view)} />;
}

export function SlateSetup({
  root,
  onRootChange,
  onConnect,
}: {
  root: string;
  onRootChange: (root: string) => void;
  onConnect: () => void;
}) {
  const hasRoot = root.trim().startsWith("/");
  return (
    <Panel className="slate-setup" id="slate-setup">
      <div className="slate-setup-mark"><FolderKey size={22} aria-hidden="true" /></div>
      <div>
        <p className="eyebrow">One-time local setup</p>
        <h2>Where is your Slate folder?</h2>
        <p>Paste the folder that contains <code>slate.config.json</code>. That private file holds Slate’s fixed local source paths.</p>
      </div>
      <label className="slate-root-field">
        <span>Slate folder</span>
        <input
          aria-label="Slate private folder"
          autoCapitalize="off"
          autoComplete="off"
          placeholder="/Users/you/.../workshop-private/slate"
          spellCheck={false}
          value={root}
          onChange={(event) => onRootChange(event.target.value)}
        />
      </label>
      <div className="slate-setup-actions">
        <Button disabled={!hasRoot} onClick={onConnect}>
          <Check size={16} aria-hidden="true" />
          Connect Slate
        </Button>
        <span>Slate reads only the files listed in that private config.</span>
      </div>
    </Panel>
  );
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
    opportunities: previous?.opportunities ?? fallback,
  };
  for (const [index, source] of sourceNames.entries()) {
    const result = results[index];
    if (acceptedSources.includes(source) && result.status === "fulfilled") next[source] = result.value;
  }
  return next;
}

export function slateBundlesMatch(left: SlateSourceBundle | null, right: SlateSourceBundle): boolean {
  return Boolean(
    left &&
    left.uc.updatedAt === right.uc.updatedAt &&
    left.uc.contents === right.uc.contents &&
    left.freezer.updatedAt === right.freezer.updatedAt &&
    left.freezer.contents === right.freezer.contents &&
    left.opportunities.updatedAt === right.opportunities.updatedAt &&
    left.opportunities.contents === right.opportunities.contents,
  );
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
      debounce = setTimeout(() => void reloadSource(source), 100);
    },
    dispose() {
      clearTimeout(debounce);
    },
  };
}

export function SlateContent({
  view,
  onSelectView,
  bundle,
  error,
  loading,
}: {
  view: SlateView;
  onSelectView: (view: SlateView) => void;
  bundle: SlateSourceBundle | null;
  error: string | null;
  loading: boolean;
}) {
  const title = view === "uc" ? "UC task ledger" : view === "freezer" ? "Chest freezer inventory" : view === "opportunities" ? "Opportunities" : "Slate";
  return (
    <div className="slate-tool">
      <header className="slate-header" id="slate-summary">
        <div>
          <p className="eyebrow">Slate · local reference desk</p>
          <h1>{title}</h1>
        </div>
        <div className="slate-summary-actions">
          <Badge tone={error ? "red" : "pink"}>{error ? "Needs attention" : "Watching local files"}</Badge>
        </div>
      </header>

      {view !== "home" ? <button className="slate-back" type="button" onClick={() => onSelectView("home")}>‹ Slate</button> : null}
      {loading ? <p className="slate-status" role="status">Refreshing local sources…</p> : null}
      {error ? <p className="slate-status slate-status-error" role="alert"><AlertCircle size={16} aria-hidden="true" /> {error}</p> : null}
      {view === "home" ? <SlateHome onSelectView={onSelectView} /> : null}
      {view === "uc" ? <UcPanel sections={bundle ? parseUcMarkdown(bundle.uc.contents) : []} updatedAt={bundle?.uc.updatedAt} /> : null}
      {view === "freezer" ? <FreezerPanel contents={bundle?.freezer.contents} updatedAt={bundle?.freezer.updatedAt} /> : null}
      {view === "opportunities" ? <OpportunitiesPanel contents={bundle?.opportunities.contents} updatedAt={bundle?.opportunities.updatedAt} /> : null}
    </div>
  );
}

function SlateHome({ onSelectView }: { onSelectView: (view: SlateView) => void }) {
  return <div className="slate-home" aria-label="Slate sources">
    <button className="slate-home-choice" type="button" onClick={() => onSelectView("uc")}><Rows3 size={22} aria-hidden="true" /><span><strong>UC</strong><small>Current operating state</small></span></button>
    <button className="slate-home-choice" type="button" onClick={() => onSelectView("freezer")}><Archive size={22} aria-hidden="true" /><span><strong>Freezer</strong><small>Chest freezer inventory</small></span></button>
    <button className="slate-home-choice" type="button" onClick={() => onSelectView("opportunities")}><TableProperties size={22} aria-hidden="true" /><span><strong>Opportunities</strong><small>Opportunity tracking table</small></span></button>
  </div>;
}

function UcPanel({ sections, updatedAt }: { sections: SlateSection[]; updatedAt?: number }) {
  const { intro, tabSections } = splitUcIntro(sections);
  const tabs = buildUcTabs(tabSections);
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  return (
    <Panel className="slate-uc" id="slate-uc">
      <div className="slate-panel-heading"><div><p className="eyebrow">Live task list</p><p className="slate-panel-note">Updates whenever the local file changes.</p></div><LastUpdated updatedAt={updatedAt} /></div>
      {intro ? <UcIntro section={intro} /> : null}
      {tabs.length ? <><div className="slate-uc-tabs" role="tablist" aria-label="UC sections">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={tab.id === activeTab?.id} className={tab.id === activeTab?.id ? "is-active" : ""} onClick={() => setActiveTabId(tab.id)}>{tab.label}</button>)}</div><div className="slate-sections" role="tabpanel">{activeTab?.sections.map((section, index) => <UcSection key={`${section.level}-${section.heading}-${index}`} section={section} showEmptyState={activeTab.sections.length === 1} />)}</div></> : <div className="empty-tool"><Rows3 size={22} aria-hidden="true" /><h3>UC is loading</h3><p>Slate will display the configured local task ledger here.</p></div>}
    </Panel>
  );
}

function UcIntro({ section }: { section: SlateSection }) {
  return <div className="slate-uc-intro"><h2>{section.heading}</h2></div>;
}

function UcSection({ section, showEmptyState }: { section: SlateSection; showEmptyState: boolean }) {
  const Heading = (`h${Math.min(section.level + 1, 4)}`) as "h2" | "h3" | "h4";
  const isEmpty = !section.paragraphs.length && !section.items.length;
  return <>{section.dividerBefore ? <hr className="slate-divider" /> : null}<section className={`slate-section slate-section-level-${section.level}`}><div className="slate-section-title"><Heading>{section.heading}</Heading></div>{section.paragraphs.map((paragraph, index) => <p key={index} className="slate-context" dangerouslySetInnerHTML={{ __html: paragraph.html }} />)}{section.items.length ? <SlateList items={section.items} /> : null}{isEmpty && showEmptyState ? <p className="slate-context">No tasks or supporting context in this section.</p> : null}</section></>;
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
    return <List className={`slate-list ${group[0].ordered ? "slate-list-ordered" : "slate-list-unordered"}`} key={`${group[0].ordered}-${groupIndex}`}>{group.map((item, index) => <li key={`${item.text}-${index}`}><span dangerouslySetInnerHTML={{ __html: item.html }} />{item.children.length ? <SlateList items={item.children} /> : null}</li>)}</List>;
  })}</>;
}

function FreezerPanel({ contents, updatedAt }: { contents?: string; updatedAt?: number }) {
  if (!contents?.trim()) {
    return <Panel className="slate-freezer" id="slate-freezer"><Archive size={24} aria-hidden="true" /><h2>Awaiting freezer inventory</h2><p className="slate-context">Slate will show the configured local freezer source here.</p><LastUpdated updatedAt={updatedAt} /></Panel>;
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
    <div className="slate-panel-heading"><div><p className="eyebrow">Live inventory</p><p className="slate-panel-note">Source order is preserved.</p></div><LastUpdated updatedAt={updatedAt} /></div>
    {rows.length ? <div className="slate-table-scroll"><table className="slate-storage-table"><thead><tr><th scope="col">Item</th><th scope="col">Count</th><th scope="col">Weight</th><th scope="col">Date Stored</th><th scope="col">Storage</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.item}-${index}`}><th scope="row">{row.item}</th><td>{row.count || "—"}</td><td>{row.weight ?? "—"}</td><td>{formatFreezerDate(row.dateStored)}</td><td><span className="slate-storage-label">{row.storage || "—"}</span></td></tr>)}</tbody></table></div> : <p className="slate-context">The Storage Table is present but has no inventory rows.</p>}
  </Panel>;
}

function OpportunitiesPanel({ contents, updatedAt }: { contents?: string; updatedAt?: number }) {
  if (!contents?.trim()) return <Panel className="slate-freezer" id="slate-opportunities"><TableProperties size={24} aria-hidden="true" /><h2>Awaiting opportunities</h2><p className="slate-context">Slate will show the configured opportunity table here.</p><LastUpdated updatedAt={updatedAt} /></Panel>;
  try {
    return <OpportunitiesTable rows={parseOpportunityTracking(contents)} updatedAt={updatedAt} />;
  } catch (cause) {
    return <Panel className="slate-freezer" id="slate-opportunities"><TableProperties size={24} aria-hidden="true" /><h2>Opportunities</h2><p className="slate-status slate-status-error" role="alert"><AlertCircle size={16} aria-hidden="true" /> {cause instanceof Error ? cause.message : "Slate could not parse the opportunity table."}</p><LastUpdated updatedAt={updatedAt} /></Panel>;
  }
}

function OpportunitiesTable({ rows, updatedAt }: { rows: OpportunityRow[]; updatedAt?: number }) {
  return <Panel className="slate-freezer" id="slate-opportunities"><div className="slate-panel-heading"><div><p className="eyebrow">Live opportunity tracking</p><p className="slate-panel-note">Source order is preserved.</p></div><LastUpdated updatedAt={updatedAt} /></div>{rows.length ? <div className="slate-table-scroll"><table className="slate-storage-table slate-opportunities-table"><thead><tr><th scope="col">Status</th><th scope="col">Name</th><th scope="col">Org / Context</th><th scope="col">Last Contact</th><th scope="col">Notes</th><th scope="col">Next Action</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.name}-${index}`}><td>{row.status || "—"}</td><th scope="row">{row.name || "—"}</th><td>{row.context || "—"}</td><td>{row.lastContact || "—"}</td><td>{row.notes || "—"}</td><td>{row.nextAction || "—"}</td></tr>)}</tbody></table></div> : <p className="slate-context">The Opportunity Table is present but has no rows.</p>}</Panel>;
}

function LastUpdated({ updatedAt }: { updatedAt?: number }) {
  return <span className="slate-updated"><Clock3 size={15} aria-hidden="true" />{updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : "Awaiting local source"}</span>;
}
