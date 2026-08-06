import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { getToolById } from "../tool-registry/tools";
import { getToolViewById, ToolView } from "./toolViews";

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

  it("renders Pulse through the shared tool view registry", () => {
    const pulse = getToolById("pulse");

    if (!pulse) {
      throw new Error("Pulse tool is not registered.");
    }

    const activeMarkup = renderToStaticMarkup(<ToolView activeRouteId="reminders" tool={pulse} />);
    const settingsMarkup = renderToStaticMarkup(<ToolView activeRouteId="settings" tool={pulse} />);

    expect(activeMarkup).toContain("Pulse");
    expect(activeMarkup).toContain("Persistent reminders are acknowledged from Android");
    expect(activeMarkup).not.toContain("Service URL");
    expect(settingsMarkup).toContain('aria-label="Pulse private folder"');
    expect(settingsMarkup).toContain("Connect Pulse");
  });

  it("renders the external Slate plugin through the shared adapter", () => {
    const slate = getToolById("slate");

    if (!slate) {
      throw new Error("Slate tool is not registered.");
    }

    const markup = renderToStaticMarkup(<ToolView tool={slate} />);

    expect(markup).toContain('aria-label="Slate private folder"');
    expect(markup).toContain("Connect Slate");
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
