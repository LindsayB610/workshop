/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultAppearance, themePresets, tokensForAppearance } from "./appearance";
import { PreferencesDialog } from "./PreferencesDialog";
import type { WorkshopUpdaterController } from "./SettingsPanel";
import { tools } from "../tool-registry/tools";
import { defaultToolWorkspaceState, getWorkspaceSelection } from "../tool-registry/workspaceState";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

afterEach(() => cleanup());

function renderDialog() {
  let appearance = defaultAppearance;
  const onChangeAppearance = vi.fn((next) => { appearance = next; });
  const state = defaultToolWorkspaceState(tools);
  return { onChangeAppearance, ...render(<PreferencesDialog open onClose={vi.fn()} appearance={appearance} tokens={tokensForAppearance(appearance)} onChangeAppearance={onChangeAppearance} installedTools={tools.filter((tool) => tool.id === "slate")} getWorkspaceSelection={(id) => getWorkspaceSelection(tools, state, id)} onRequestWorkspace={vi.fn(() => ({ ok: true as const, normalizedRoot: "/Users/example/slate-private" }))} onForgetWorkspace={vi.fn()} updater={updater} />) };
}

const updater: WorkshopUpdaterController = { updateState: { currentVersion: "0.1.5", status: "not_available" }, checkNow: vi.fn(async () => undefined), installUpdate: vi.fn(async () => undefined) };
const styleSheet = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../styles/app.css"), "utf8");

describe("Workshop Preferences", () => {
  it("exposes real radio cards and saves a selected preset immediately", async () => {
    const user = userEvent.setup(); const { onChangeAppearance } = renderDialog();
    expect(screen.getAllByRole("radio")).toHaveLength(10);
    expect(screen.getAllByRole("radio").map((card) => card.textContent)).toEqual(expect.arrayContaining(themePresets.map((preset) => expect.stringContaining(preset.name))));
    const lagoon = screen.getByRole("radio", { name: /lagoon/i });
    expect(lagoon.getAttribute("aria-checked")).toBe("false");
    await user.click(lagoon);
    expect(onChangeAppearance).toHaveBeenCalledWith(expect.objectContaining({ theme: { kind: "preset", presetId: "lagoon" } }));
  });

  it("renders each palette as a complete themed card rather than a two-color dot", () => {
    renderDialog();
    const workshop = screen.getByRole("radio", { name: /workshop/i });
    expect(workshop.textContent).toContain("canvas #000000");
    expect(workshop.textContent).toContain("primary #ff1b8d");
    expect(workshop.textContent).toContain("warm #ffdd00");
    expect(workshop.querySelector(".preset-swatch")?.textContent).toBe("LB");
  });

  it("uses one selected-card border instead of stacking an inset ring and focus outline", () => {
    expect(styleSheet).toContain('.preset-card[aria-checked="true"] { border-color: var(--workshop-focus-ring); }');
    expect(styleSheet).not.toContain('box-shadow: inset 0 0 0 2px var(--workshop-focus-ring)');
    expect(styleSheet).toContain('.preset-card[aria-checked="true"]:focus-visible { outline: 0; }');
  });

  it("keeps invalid custom draft visible and blocks its save", async () => {
    const user = userEvent.setup(); renderDialog();
    await user.click(screen.getByRole("tab", { name: /custom palette/i }));
    const field = screen.getByLabelText("Custom palette hex values");
    await user.type(field, "#000 #111 #222");
    expect(screen.getByRole("alert").textContent).toContain("exactly four hex colors");
    expect((screen.getByRole("button", { name: /save custom palette/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((field as HTMLTextAreaElement).value).toBe("#000 #111 #222");
  });

  it("supports keyboard focus and close behavior without changing active content", () => {
    const onClose = vi.fn(); const state = defaultToolWorkspaceState(tools);
    render(<PreferencesDialog open onClose={onClose} appearance={defaultAppearance} tokens={tokensForAppearance(defaultAppearance)} onChangeAppearance={vi.fn()} installedTools={[]} getWorkspaceSelection={(id) => getWorkspaceSelection(tools, state, id)} onRequestWorkspace={vi.fn()} onForgetWorkspace={vi.fn()} updater={updater} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /close preferences/i }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps folder actions generic and requires confirmation before forgetting", async () => {
    const user = userEvent.setup(); const forget = vi.fn(); const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const state = defaultToolWorkspaceState(tools);
    state.selections = [{ ...getWorkspaceSelection(tools, state, "slate"), mode: "external", root: "/Users/example/slate-private", label: "Slate folder" }];
    render(<PreferencesDialog open onClose={vi.fn()} appearance={defaultAppearance} tokens={tokensForAppearance(defaultAppearance)} onChangeAppearance={vi.fn()} installedTools={tools.filter((tool) => tool.id === "slate")} getWorkspaceSelection={(id) => getWorkspaceSelection(tools, state, id)} onRequestWorkspace={vi.fn()} onForgetWorkspace={forget} updater={updater} />);
    await user.click(screen.getByRole("button", { name: /folders/i }));
    await user.click(screen.getByRole("button", { name: "Forget" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("files will not be touched"));
    expect(forget).toHaveBeenCalledWith("slate");
  });

  it("offers a manual, explicit update check from Preferences", async () => {
    const user = userEvent.setup(); renderDialog();
    await user.click(screen.getByRole("button", { name: "Updates" }));
    await user.click(screen.getByRole("button", { name: "Check for updates" }));
    expect(updater.checkNow).toHaveBeenCalled();
  });
});
