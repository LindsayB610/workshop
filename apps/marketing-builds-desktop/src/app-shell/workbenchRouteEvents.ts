import type { ToolRoute } from "../tool-registry/types";

export const WORKBENCH_ROUTE_SELECTED_EVENT = "workshop:route-selected";

export type WorkbenchRouteSelectedDetail = {
  toolId: string;
  routeId: string;
  path: string;
  sectionId?: string;
};

export function dispatchWorkbenchRouteSelected(toolId: string, route: ToolRoute) {
  window.dispatchEvent(
    new CustomEvent<WorkbenchRouteSelectedDetail>(WORKBENCH_ROUTE_SELECTED_EVENT, {
      detail: {
        toolId,
        routeId: route.id,
        path: route.path,
        sectionId: route.sectionId,
      },
    }),
  );
}
