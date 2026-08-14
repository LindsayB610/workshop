import { FolderCog, Palette, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { SettingsPanelView, type WorkshopUpdaterController } from "./SettingsPanel";
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
  const [initialsDraft, setInitialsDraft] = useState(appearance.initials);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);
  useEffect(() => { if (!open) return; const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener); }, [open, onClose]);
  if (!open) return null;
  const parsed = customText ? parseCustomPalette(customText) : null;
  const customTokens = parsed?.ok ? tokensForAppearance({ version: 1, initials: appearance.initials, theme: { kind: "custom", palette: parsed.palette } }) : tokens;
  const validInitials = initialsDraft.trim().toLocaleUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
  const initialsReady = Array.from(validInitials).length === 2;

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
          {section === "appearance" ? <AppearancePanel appearance={appearance} tokens={tokens} customText={customText} parsed={parsed} initialsDraft={initialsDraft} initialsReady={initialsReady} customTokens={customTokens} onInitialsChange={setInitialsDraft} onCustomChange={setCustomText} onSelectPreset={(presetId) => onChangeAppearance({ ...appearance, theme: { kind: "preset", presetId } })} onSaveCustom={() => { if (parsed?.ok && initialsReady) { onChangeAppearance({ version: 1, initials: validInitials, theme: { kind: "custom", palette: parsed.palette } }); setMessage("Custom appearance saved locally."); } }} onSaveInitials={() => { if (initialsReady) { onChangeAppearance({ ...appearance, initials: validInitials }); setMessage("Initials saved locally."); } }} onReset={() => { onChangeAppearance(defaultAppearance); setCustomText(""); setInitialsDraft(defaultAppearance.initials); setMessage("Workshop appearance reset."); }} message={message} /> : section === "folders" ? <FoldersPanel tools={installedTools} getWorkspaceSelection={getWorkspaceSelection} onRequestWorkspace={onRequestWorkspace} onForgetWorkspace={onForgetWorkspace} /> : <section aria-labelledby="updates-heading"><div className="preferences-heading"><div><h3 id="updates-heading">Updates</h3><p>Workshop checks daily while it is open. You stay in charge of every install and restart.</p></div></div><SettingsPanelView updateState={updater.updateState} onCheckForUpdates={() => { void updater.checkNow(); }} onInstallUpdate={() => { void updater.installUpdate(); }} /></section>}
        </div>
      </div>
    </section>
  </div>;
}

function AppearancePanel({ appearance, tokens, customText, parsed, initialsDraft, initialsReady, customTokens, onInitialsChange, onCustomChange, onSelectPreset, onSaveCustom, onSaveInitials, onReset, message }: { appearance: AppearancePreference; tokens: ThemeTokens; customText: string; parsed: ReturnType<typeof parseCustomPalette> | null; initialsDraft: string; initialsReady: boolean; customTokens: ThemeTokens; onInitialsChange: (value: string) => void; onCustomChange: (value: string) => void; onSelectPreset: (id: string) => void; onSaveCustom: () => void; onSaveInitials: () => void; onReset: () => void; message: string | null }) {
  const [tab, setTab] = useState<"presets" | "custom">("presets");
  return <section aria-labelledby="appearance-heading"><div className="preferences-heading"><div><h3 id="appearance-heading">Appearance</h3><p>One dark Workshop, ten deliberate moods. Apps can inherit the same semantic tokens when they are ready.</p></div><BrandPreview initials={appearance.initials} tokens={tokens} /></div>
    <div className="preferences-tabs" role="tablist" aria-label="Appearance modes"><button type="button" role="tab" aria-selected={tab === "presets"} onClick={() => setTab("presets")}>Curated palettes</button><button type="button" role="tab" aria-selected={tab === "custom"} onClick={() => setTab("custom")}>Custom palette</button></div>
    {tab === "presets" ? <fieldset className="preset-fieldset"><legend>Choose a palette</legend><div className="preset-grid" role="radiogroup" aria-label="Workshop palette presets">{themePresets.map((preset) => <button key={preset.id} type="button" role="radio" aria-checked={appearance.theme.kind === "preset" && appearance.theme.presetId === preset.id} className="preset-card" onClick={() => onSelectPreset(preset.id)}><span className="preset-swatch" style={{ background: `linear-gradient(135deg, ${preset.tokens.gradientStart}, ${preset.tokens.gradientEnd})` }} /><span><strong>{preset.name}</strong><small>{preset.description}</small></span><em>{appearance.theme.kind === "preset" && appearance.theme.presetId === preset.id ? "Selected" : "Select"}</em></button>)}</div></fieldset> : <section className="custom-editor" aria-labelledby="custom-heading"><div><h4 id="custom-heading">Paste four hex colors</h4><p>Canvas, surface, primary accent, warm accent — commas, spaces, or new lines all work.</p></div><textarea aria-label="Custom palette hex values" value={customText} placeholder={'#070707\n#171717\n#FF1B8D\n#FFDD00'} onChange={(event) => onCustomChange(event.target.value)} />{customText && !parsed?.ok ? <p className="field-error" role="alert">{parsed?.message}</p> : null}<div className="custom-preview"><BrandPreview initials={initialsReady ? initialsDraft.toLocaleUpperCase().replace(/[^\p{L}\p{N}]/gu, "") : appearance.initials} tokens={customTokens} /><span>Preview only until saved.</span><Button variant="primary" disabled={!parsed?.ok || !initialsReady} onClick={onSaveCustom}>Save custom palette</Button></div></section>}
    <section className="initials-editor" aria-labelledby="initials-heading"><div><h4 id="initials-heading">Personal mark</h4><p>Exactly two letters or numerals. The app mark updates at runtime; the signed app icon and Dock artwork do not.</p></div><div><label htmlFor="workshop-initials">Initials</label><input id="workshop-initials" value={initialsDraft} maxLength={8} onChange={(event) => onInitialsChange(event.target.value)} aria-describedby="initials-error" />{!initialsReady ? <small id="initials-error" className="field-error">Use exactly two visible letters or numerals.</small> : null}<Button variant="secondary" disabled={!initialsReady} onClick={onSaveInitials}>Save initials</Button></div><BrandPreview initials={initialsReady ? initialsDraft.trim().toLocaleUpperCase().replace(/[^\p{L}\p{N}]/gu, "") : appearance.initials} tokens={tokens} /></section>
    <div className="preferences-footer"><Button variant="ghost" onClick={onReset}><RotateCcw size={16} aria-hidden="true" />Reset Workshop appearance</Button>{message ? <p role="status">{message}</p> : null}</div>
  </section>;
}

function BrandPreview({ initials, tokens }: { initials: string; tokens: ThemeTokens }) { return <div className="brand-mark preferences-mark" style={{ background: `linear-gradient(135deg, ${tokens.gradientStart}, ${tokens.gradientEnd})` }} aria-label={`${initials} personal brand mark`}>{initials}</div>; }

function FoldersPanel({ tools, getWorkspaceSelection, onRequestWorkspace, onForgetWorkspace }: { tools: ToolDefinition[]; getWorkspaceSelection: Props["getWorkspaceSelection"]; onRequestWorkspace: Props["onRequestWorkspace"]; onForgetWorkspace: Props["onForgetWorkspace"] }) {
  return <section aria-labelledby="folders-heading"><div className="preferences-heading"><div><h3 id="folders-heading">Folders</h3><p>Workshop remembers selections locally. Changing or forgetting one never edits, moves, discovers, or deletes private files.</p></div></div><div className="folder-list">{tools.length ? tools.map((tool) => { const selection = getWorkspaceSelection(tool.id); const managedInsideTool = ["connection", "plugin-config"].includes(tool.privateWorkspace.kind); return <article key={tool.id} className="folder-row"><div><h4>{tool.displayName}</h4><p>{managedInsideTool ? "This app manages its private connection inside its own view." : selection.mode === "external" ? selection.root : "No private folder remembered."}</p><small>{managedInsideTool ? "Connection state is separate from a remembered path." : selection.mode === "external" ? "Remembered locally; reauthorize if macOS access was revoked." : "Using the app’s bundled/demo state."}</small></div><div className="folder-actions">{!managedInsideTool ? <><Button variant="secondary" onClick={() => { const result = onRequestWorkspace(tool.id); if (result && !result.ok) window.alert(result.message); }}>{selection.mode === "external" ? "Change / reconnect" : "Choose folder"}</Button>{selection.mode === "external" ? <Button variant="ghost" onClick={() => { if (window.confirm(`Forget the saved ${tool.displayName} folder? Its files will not be touched.`)) onForgetWorkspace(tool.id); }}>Forget</Button> : null}</> : <span className="folder-managed">Managed in app</span>}</div></article>; }) : <p className="folder-empty">Install an app first; its private-folder settings will appear here.</p>}</div></section>;
}
