/* @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getToolById } from "../tool-registry/tools";
import {
  getToolViewById,
  lazyExternalToolView,
  ToolView,
  type ExternalWorkshopToolViewProps,
} from "./toolViews";

afterEach(() => cleanup());

describe("tool views", () => {
  it("renders Redline through the shared tool view registry", () => {
    const redline = getToolById("redline");

    if (!redline) {
      throw new Error("Redline tool is not registered.");
    }

    const markup = renderToStaticMarkup(<ToolView tool={redline} />);

    expect(markup).toContain("Client workspaces");
    expect(markup).toContain("Run Audit");
  });

  it("renders Megaphone through the shared tool view registry", () => {
    const megaphone = getToolById("megaphone");

    if (!megaphone) {
      throw new Error("Megaphone tool is not registered.");
    }

    const markup = renderToStaticMarkup(<ToolView tool={megaphone} />);

    expect(markup).toContain("Megaphone");
    expect(markup).toContain("Client Mode");
    expect(markup).not.toContain("Active Post Package");
    expect(markup).not.toContain("empty-tool");
  });

  it("loads Pulse through the shared tool view registry", async () => {
    const pulse = getToolById("pulse");

    if (!pulse) {
      throw new Error("Pulse tool is not registered.");
    }

    const activeView = render(<ToolView activeRouteId="reminders" tool={pulse} />);

    expect(await screen.findByText(/Persistent reminders are acknowledged from Android/)).toBeTruthy();
    expect(screen.queryByText("Service URL")).toBeNull();
    activeView.unmount();

    render(<ToolView activeRouteId="settings" tool={pulse} />);
    expect(await screen.findByLabelText("Pulse private folder")).toBeTruthy();
    expect(screen.getByText("Connect Pulse")).toBeTruthy();
  });

  it("loads the external Slate plugin through the shared adapter", async () => {
    const slate = getToolById("slate");

    if (!slate) {
      throw new Error("Slate tool is not registered.");
    }

    render(<ToolView tool={slate} />);

    expect(await screen.findByRole("heading", { name: "Slate" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage documents" })).toBeTruthy();
  });

  it("passes a connected workspace to the external Slate plugin", async () => {
    const slate = getToolById("slate");

    if (!slate) {
      throw new Error("Slate tool is not registered.");
    }

    render(
      <ToolView
        tool={slate}
        workspaceRoot="/Users/example/slate-private"
        onClearWorkspaceRequest={() => undefined}
      />,
    );

    expect((await screen.findAllByRole("button", { name: "Manage documents" })).length).toBeGreaterThan(0);
  });

  it("passes the optional generic folder browser to an external plugin without persisting a browse result", async () => {
    const slate = getToolById("slate");
    if (!slate) {
      throw new Error("Slate tool is not registered.");
    }

    const browseWorkspaceRoot = vi.fn().mockResolvedValue({
      ok: true,
      root: "/Users/example/workshop-private/slate",
    });
    const onSetWorkspaceRequest = vi.fn().mockReturnValue({ ok: true });
    const Adapter = lazyExternalToolView(async () => ({
      WorkshopToolView: BrowseAwarePlugin,
    }));
    const user = userEvent.setup();

    render(
      <Adapter
        tool={slate}
        browseWorkspaceRoot={browseWorkspaceRoot}
        onSetWorkspaceRequest={onSetWorkspaceRequest}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Browse private folder" }));
    expect(browseWorkspaceRoot).toHaveBeenCalledOnce();
    expect(onSetWorkspaceRequest).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Connect private folder" }));
    expect(onSetWorkspaceRequest).toHaveBeenCalledWith("slate", "/Users/example/workshop-private/slate");
  });

  it("continues rendering external plugins that do not use the optional folder browser", async () => {
    const slate = getToolById("slate");
    if (!slate) {
      throw new Error("Slate tool is not registered.");
    }

    const Adapter = lazyExternalToolView(async () => ({ WorkshopToolView: NoBrowsePlugin }));
    render(<Adapter tool={slate} />);

    expect(await screen.findByText("Plugin without folder browsing")).toBeTruthy();
  });

  it("passes the optional Markdown-file browser to Slate's package adapter without persisting a browse result", async () => {
    const slate = getToolById("slate");
    if (!slate) {
      throw new Error("Slate tool is not registered.");
    }

    const browseMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      path: "/Users/example/workshop-private/slate/notes.md",
    });
    const onSetWorkspaceRequest = vi.fn().mockReturnValue({ ok: true });
    const Adapter = lazyExternalToolView(async () => ({
      WorkshopToolView: MarkdownBrowseAwarePlugin,
    }));
    const user = userEvent.setup();

    render(
      <Adapter
        tool={slate}
        browseMarkdownFile={browseMarkdownFile}
        onSetWorkspaceRequest={onSetWorkspaceRequest}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Browse Markdown file" }));
    expect(browseMarkdownFile).toHaveBeenCalledWith("/Users/example/workshop-private/slate/current.md");
    expect(onSetWorkspaceRequest).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Connect private folder" }));
    expect(onSetWorkspaceRequest).toHaveBeenCalledWith("slate", "/Users/example/workshop-private/slate");
  });

  it("exposes the fallback view for every registered tool id", () => {
    expect(getToolViewById("redline")).toBeDefined();
    expect(getToolViewById("megaphone")).toBeDefined();
    expect(getToolViewById("pulse")).toBeDefined();
    expect(getToolViewById("slate")).toBeDefined();
    expect(getToolViewById("missing-tool")).toBeUndefined();
  });
});

const BrowseAwarePlugin: ComponentType<ExternalWorkshopToolViewProps> = ({
  browseWorkspaceRoot,
  requestWorkspaceRoot,
}) => (
  <>
    <button type="button" onClick={() => { void browseWorkspaceRoot?.(); }}>Browse private folder</button>
    <button type="button" onClick={() => requestWorkspaceRoot("/Users/example/workshop-private/slate")}>Connect private folder</button>
  </>
);

const NoBrowsePlugin: ComponentType<ExternalWorkshopToolViewProps> = () => (
  <p>Plugin without folder browsing</p>
);

const MarkdownBrowseAwarePlugin: ComponentType<ExternalWorkshopToolViewProps> = ({
  browseMarkdownFile,
  requestWorkspaceRoot,
}) => (
  <>
    <button type="button" onClick={() => { void browseMarkdownFile?.("/Users/example/workshop-private/slate/current.md"); }}>Browse Markdown file</button>
    <button type="button" onClick={() => requestWorkspaceRoot("/Users/example/workshop-private/slate")}>Connect private folder</button>
  </>
);

type ElementProps = {
  children?: ReactNode;
  [key: string]: unknown;
};

function findButtonByText(element: ReactElement, text: string): ReactElement | undefined {
  const expanded = expandElement(element);
  return findElement(expanded, (candidate) => {
    return candidate.type === "button" && elementText(candidate).includes(text);
  });
}

function expandElement(node: ReactNode): ReactNode {
  if (!isValidElement(node)) {
    return node;
  }

  if (typeof node.type === "function") {
    const Component = node.type as (props: ElementProps) => ReactNode;
    return expandElement(Component(node.props as ElementProps));
  }

  const props = node.props as ElementProps;

  return {
    ...node,
    props: {
      ...props,
      children: expandChildren(props.children),
    },
  };
}

function expandChildren(children: ReactNode): ReactNode {
  if (Array.isArray(children)) {
    return children.map(expandElement);
  }

  return expandElement(children);
}

function findElement(
  node: ReactNode,
  predicate: (candidate: ReactElement) => boolean,
): ReactElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) {
        return match;
      }
    }
    return undefined;
  }

  if (!isValidElement(node)) {
    return undefined;
  }

  if (predicate(node)) {
    return node;
  }

  return findElement((node.props as ElementProps).children, predicate);
}

function elementText(node: ReactNode): string {
  if (Array.isArray(node)) {
    return node.map(elementText).join("");
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (!isValidElement(node)) {
    return "";
  }

  return elementText((node.props as ElementProps).children);
}
