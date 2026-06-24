import type { ToolDefinition } from "../tool-registry/types";

export function ToolLogo({ tool }: { tool: ToolDefinition }) {
  return (
    <span className={`tool-logo tool-logo-${tool.logoVariant}`} aria-hidden="true">
      <span className="tool-logo-frame">
        <span className="tool-logo-line tool-logo-line-a" />
        <span className="tool-logo-line tool-logo-line-b" />
        <span className="tool-logo-dot tool-logo-dot-a" />
        <span className="tool-logo-dot tool-logo-dot-b" />
      </span>
    </span>
  );
}
