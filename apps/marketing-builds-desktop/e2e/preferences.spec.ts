import { expect, test } from "@playwright/test";

async function openPreferencesFromHostMenu(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "Workshop" })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("workshop:open-preferences")));
  await expect(page.getByRole("dialog", { name: "Preferences" })).toBeVisible();
}

test.describe("Workshop Preferences", () => {
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
