import { expect, test } from "@playwright/test";

async function openPreferencesFromHostMenu(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "Workshop" })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("workshop:open-preferences")));
  await expect(page.getByRole("dialog", { name: "Preferences" })).toBeVisible();
}

test.describe("Workshop Preferences", () => {
  test("migrates a personalized v1 appearance into the fixed, theme-aware Workshop mark", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem(
        "workshop.appearance.v1",
        JSON.stringify({ version: 1, initials: "LB", theme: { kind: "preset", presetId: "lagoon" } }),
      );
    });
    await page.goto("/");

    const shelfMark = page.getByLabel("Workshop mark");
    await expect(shelfMark).toHaveAttribute("style", /--workshop-mark-w: #2bb7e8/);
    await expect(shelfMark).toHaveAttribute("style", /--workshop-mark-inlay: #62e6bd/);
    await expect(page.getByText("LB", { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("workshop.appearance.v1") ?? "{}"))).toEqual({ version: 2, theme: { kind: "preset", presetId: "lagoon" } });

    await openPreferencesFromHostMenu(page);
    await expect(page.getByLabel("Initials")).toHaveCount(0);
    await expect(page.getByText("Personal mark", { exact: true })).toHaveCount(0);
  });

  test("keeps the shelf intact while applying an accessible preset and validating custom input", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/");
    await openPreferencesFromHostMenu(page);
    await page.getByRole("radio", { name: /Lagoon/ }).click();
    await expect(page.getByRole("radio", { name: /Lagoon/ })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("tab", { name: "Custom palette" }).click();
    await page.getByLabel("Custom palette hex values").fill("#000 #111 #222");
    await expect(page.getByRole("alert")).toContainText("exactly four hex colors");
    await expect(page.getByRole("button", { name: "Save custom palette" })).toBeDisabled();
    await page.getByRole("button", { name: "Close Preferences" }).click();
    await expect(page.getByRole("dialog", { name: "Preferences" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Workshop" })).toBeVisible();
  });

  test("manages folder selections through the host without exposing a private file browser", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/");
    await openPreferencesFromHostMenu(page);
    await page.getByRole("button", { name: "Folders" }).click();
    await expect(page.getByRole("heading", { name: "Folders" })).toBeVisible();
    await expect(page.getByText("Changing or forgetting one never edits, moves, discovers, or deletes private files.")).toBeVisible();
    await expect(page.getByText("Install an app first; its private-folder settings will appear here.")).toBeVisible();
  });

  test("repairs only the affected version-four shelf while keeping the catalog closed", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem(
        "workshop.toolInstallState.v2",
        JSON.stringify({ schemaVersion: 4, enabledToolIds: [] }),
      );
    });
    await page.goto("/");

    await expect(page.getByRole("button", { name: /^Slate/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pulse/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add New Tools" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByLabel("Add New Tools catalog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Install" })).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(window.localStorage.getItem("workshop.toolInstallState.v2") ?? "{}")),
      )
      .toEqual({ schemaVersion: 5, enabledToolIds: ["slate", "pulse"] });
  });

  test("offers a manual update check without installing anything automatically", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/");
    await openPreferencesFromHostMenu(page);
    await page.getByRole("button", { name: "Updates" }).click();
    await page.getByRole("button", { name: "Check for updates" }).click();
    await expect(page.getByRole("region", { name: "Workshop update status" })).toContainText("you're up to date");
    await expect(page.getByRole("button", { name: /install and restart/i })).toHaveCount(0);
  });
});
