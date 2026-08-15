/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => undefined),
}));

import { App } from "./App";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Workshop host workflow", () => {
  it("installs an app, opens it, and opens host Preferences from the native event contract", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText("Choose apps from Add New Tools.")).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Install" })[0]);
    expect(await screen.findByText(/is installed\. Local workspaces were not changed/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Slate/ }));
    expect(await screen.findByRole("heading", { name: "Slate" })).toBeTruthy();

    window.dispatchEvent(new Event("workshop:open-preferences"));
    expect(await screen.findByRole("dialog", { name: "Preferences" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Close Preferences" }));
    expect(screen.queryByRole("dialog", { name: "Preferences" })).toBeNull();
  });
});
