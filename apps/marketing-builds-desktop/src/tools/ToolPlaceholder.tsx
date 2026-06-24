import { Hammer } from "lucide-react";
import { Panel } from "../components/ui/panel";
import type { ToolViewProps } from "./types";

export function ToolPlaceholder({ tool }: ToolViewProps) {
  return (
    <Panel>
      <div className="empty-tool">
        <Hammer size={22} aria-hidden="true" />
        <p className="eyebrow">{tool.status}</p>
        <h2>{tool.displayName}</h2>
        <p>{tool.description}</p>
      </div>
    </Panel>
  );
}
