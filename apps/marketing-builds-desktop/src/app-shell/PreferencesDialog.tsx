import { FolderCog, Palette, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "../components/ui/button";
import { SettingsPanelView, type WorkshopUpdaterController } from "./SettingsPanel";
import { WorkshopMark } from "./WorkshopMark";
import type { ToolDefinition } from "../tool-registry/types";
import type { ToolWorkspaceSelection, WorkspaceValidationResult } from "../tool-registry/workspaceState";
import { defaultAppearance, parseCustomPalette, themePresets, tokensForAppearance, type AppearancePreference, type ThemeTokens } from "./appearance";

type Props = {
  open: boolean;
  onClose: () => void;
  appearance: AppearancePreference;
  tokens: ThemeTokens;
  onChangeAppearance: (value: AppearancePreference) => void;
  installedTools: ToolDefinition[];
  getWorkspaceSelection: (toolId: string) => ToolWorkspaceSelection;
  onRequestWorkspace: (toolId: string) => WorkspaceValidationResult | undefined;
  onForgetWorkspace: (toolId: string) => void;
  updater: WorkshopUpdaterController;
};

export function PreferencesDialog({ open, onClose, appearance, tokens, onChangeAppearance, installedTools, getWorkspaceSelection, onRequestWorkspace, onForgetWorkspace, updater }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [section, setSection] = useState<"appearance" | "folders" | "updates">("appearance");
  const [customText, setCustomText] = useState(appearance.theme.kind === "custom" ? Object.values(appearance.theme.palette).join("\n") : "");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);
  useEffect(() => { if (!open) return; const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener); }, [open, onClose]);
  if (!open) return null;
  const parsed = customText ? parseCustomPalette(customText) : null;
  const customTokens = parsed?.ok ? tokensForAppearance({ version: 2, theme: { kind: "custom", palette: parsed.palette } }) : tokens;

  return <div className="preferences-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="preferences-dialog" role="dialog" aria-modal="true" aria-labelledby="preferences-title">
      <header className="preferences-topbar"><div><p className="eyebrow">Workshop settings</p><h2 id="preferences-title">Preferences</h2></div><button ref={closeRef} type="button" className="preferences-close" onClick={onClose} aria-label="Close Preferences"><X aria-hidden="true" /></button></header>
      <div className="preferences-layout">
        <nav className="preferences-nav" aria-label="Preferences sections">
          <button type="button" aria-current={section === "appearance" ? "page" : undefined} onClick={() => setSection("appearance")}><Palette aria-hidden="true" />Appearance</button>
          <button type="button" aria-current={section === "folders" ? "page" : undefined} onClick={() => setSection("folders")}><FolderCog aria-hidden="true" />Folders</button>
          <button type="button" aria-current={section === "updates" ? "page" : undefined} onClick={() => setSection("updates")}><RotateCcw aria-hidden="true" />Updates</button>
        </nav>
        <div className="preferences-content">
          {section === "appearance" ? <AppearancePanel appearance={appearance} tokens={tokens} customText={customText} parsed={parsed} customTokens={customTokens} onCustomChange={setCustomText} onSelectPreset={(presetId) => onChangeAppearance({ ...appearance, theme: { kind: "preset", presetId } })} onSaveCustom={() => { if (parsed?.ok) { onChangeAppearance({ version: 2, theme: { kind: "custom", palette: parsed.palette } }); setMessage("Custom appearance saved locally."); } }} onReset={() => { onChangeAppearance(defaultAppearance); setCustomText(""); setMessage("Workshop appearance reset."); }} message={message} /> : section === "folders" ? <FoldersPanel tools={installedTools} getWorkspaceSelection={getWorkspaceSelection} onRequestWorkspace={onRequestWorkspace} onForgetWorkspace={onForgetWorkspace} /> : <section aria-labelledby="updates-heading"><div className="preferences-heading"><div><h3 id="updates-heading">Updates</h3><p>Workshop checks daily while it is open. You stay in charge of every install and restart.</p></div></div><SettingsPanelView updateState={updater.updateState} onCheckForUpdates={() => { void updater.checkNow(); }} onInstallUpdate={() => { void updater.installUpdate(); }} /></section>}
        </div>
      </div>
    </section>
  </div>;
}

function AppearancePanel({ appearance, tokens, customText, parsed, customTokens, onCustomChange, onSelectPreset, onSaveCustom, onReset, message }: { appearance: AppearancePreference; tokens: ThemeTokens; customText: string; parsed: ReturnType<typeof parseCustomPalette> | null; customTokens: ThemeTokens; onCustomChange: (value: string) => void; onSelectPreset: (id: string) => void; onSaveCustom: () => void; onReset: () => void; message: string | null }) {
  const [tab, setTab] = useState<"presets" | "custom">("presets");
  return <section aria-labelledby="appearance-heading"><div className="preferences-heading"><div><h3 id="appearance-heading">Appearance</h3><p>One dark Workshop, ten deliberate moods. Apps can inherit the same semantic tokens when they are ready.</p></div><BrandPreview tokens={tokens} /></div>
    <div className="preferences-tabs" role="tablist" aria-label="Appearance modes"><button type="button" role="tab" aria-selected={tab === "presets"} onClick={() => setTab("presets")}>Curated palettes</button><button type="button" role="tab" aria-selected={tab === "custom"} onClick={() => setTab("custom")}>Custom palette</button></div>
    {tab === "presets" ? <fieldset className="preset-fieldset"><legend>Choose a palette</legend><div className="preset-grid" role="radiogroup" aria-label="Workshop palette presets">{themePresets.map((preset) => <button key={preset.id} type="button" role="radio" aria-checked={appearance.theme.kind === "preset" && appearance.theme.presetId === preset.id} className="preset-card" style={presetCardStyle(preset.tokens)} onClick={() => onSelectPreset(preset.id)}><span className="preset-card-summary"><span className="preset-swatch"><WorkshopMark label="" tokens={preset.tokens} /></span><span className="preset-card-copy"><strong>{preset.name}</strong><small>{preset.description}</small></span><em>{appearance.theme.kind === "preset" && appearance.theme.presetId === preset.id ? "Selected" : "Select"}</em></span><span className="preset-token-list" aria-label={`${preset.name} palette colors`}><span><i className="preset-token-dot preset-token-canvas" />canvas <b>{preset.tokens.canvas}</b></span><span><i className="preset-token-dot preset-token-surface" />surface <b>{preset.tokens.surface}</b></span><span><i className="preset-token-dot preset-token-primary" />primary <b>{preset.tokens.accent}</b></span><span><i className="preset-token-dot preset-token-warm" />warm <b>{preset.tokens.accentWarm}</b></span></span></button>)}</div></fieldset> : <section className="custom-editor" aria-labelledby="custom-heading"><div><h4 id="custom-heading">Paste four hex colors</h4><p>Canvas, surface, primary accent, warm accent — commas, spaces, or new lines all work.</p></div><textarea aria-label="Custom palette hex values" value={customText} placeholder={'#070707\n#171717\n#FF1B8D\n#FFDD00'} onChange={(event) => onCustomChange(event.target.value)} />{customText && !parsed?.ok ? <p className="field-error" role="alert">{parsed?.message}</p> : null}<div className="custom-preview"><BrandPreview tokens={customTokens} /><span>Preview only until saved.</span><Button variant="primary" disabled={!parsed?.ok} onClick={onSaveCustom}>Save custom palette</Button></div></section>}
    <div className="preferences-footer"><Button variant="ghost" onClick={onReset}><RotateCcw size={16} aria-hidden="true" />Reset Workshop appearance</Button>{message ? <p role="status">{message}</p> : null}</div>
  </section>;
}

function BrandPreview({ tokens }: { tokens: ThemeTokens }) { return <WorkshopMark className="preferences-mark" tokens={tokens} />; }

function presetCardStyle(tokens: ThemeTokens) {
  return {
    "--preset-canvas": tokens.canvas,
    "--preset-surface": tokens.surface,
    "--preset-accent": tokens.accent,
    "--preset-warm": tokens.accentWarm,
  } as CSSProperties;
}

function FoldersPanel({ tools, getWorkspaceSelection, onRequestWorkspace, onForgetWorkspace }: { tools: ToolDefinition[]; getWorkspaceSelection: Props["getWorkspaceSelection"]; onRequestWorkspace: Props["onRequestWorkspace"]; onForgetWorkspace: Props["onForgetWorkspace"] }) {
  return <section aria-labelledby="folders-heading"><div className="preferences-heading"><div><h3 id="folders-heading">Folders</h3><p>Workshop remembers selections locally. Changing or forgetting one never edits, moves, discovers, or deletes private files.</p></div></div><div className="folder-list">{tools.length ? tools.map((tool) => { const selection = getWorkspaceSelection(tool.id); const managedInsideTool = ["connection", "plugin-config"].includes(tool.privateWorkspace.kind); return <article key={tool.id} className="folder-row"><div><h4>{tool.displayName}</h4><p>{managedInsideTool ? "This app manages its private connection inside its own view." : selection.mode === "external" ? selection.root : "No private folder remembered."}</p><small>{managedInsideTool ? "Connection state is separate from a remembered path." : selection.mode === "external" ? "Remembered locally; reauthorize if macOS access was revoked." : "Using the app’s bundled/demo state."}</small></div><div className="folder-actions">{!managedInsideTool ? <><Button variant="secondary" onClick={() => { const result = onRequestWorkspace(tool.id); if (result && !result.ok) window.alert(result.message); }}>{selection.mode === "external" ? "Change / reconnect" : "Choose folder"}</Button>{selection.mode === "external" ? <Button variant="ghost" onClick={() => { if (window.confirm(`Forget the saved ${tool.displayName} folder? Its files will not be touched.`)) onForgetWorkspace(tool.id); }}>Forget</Button> : null}</> : <span className="folder-managed">Managed in app</span>}</div></article>; }) : <p className="folder-empty">Install an app first; its private-folder settings will appear here.</p>}</div></section>;
}
