/* @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getToolById } from "../tool-registry/tools";
import { getToolViewById, ToolView } from "./toolViews";

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

  it("exposes the fallback view for every registered tool id", () => {
    expect(getToolViewById("redline")).toBeDefined();
    expect(getToolViewById("megaphone")).toBeDefined();
    expect(getToolViewById("pulse")).toBeDefined();
    expect(getToolViewById("slate")).toBeDefined();
    expect(getToolViewById("missing-tool")).toBeUndefined();
  });
});

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
