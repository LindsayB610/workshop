import { expect, test } from "@playwright/test";

for (const { name, readyRole, readyName } of [
  { name: "Slate", readyRole: "navigation", readyName: "Slate sources" },
  { name: "Pulse", readyRole: "heading", readyName: "Advanced private-folder connection" },
] as const) {
  test(`installs, loads, and reopens ${name} without a private workspace`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => {
      if (request.resourceType() === "script") errors.push(`Script failed: ${request.url()}`);
    });
    page.on("response", (response) => {
      if (response.request().resourceType() === "script" && response.status() >= 400) {
        errors.push(`Script returned ${response.status()}: ${response.url()}`);
      }
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Add New Tools" }).click();
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await card.getByRole("button", { name: "Install", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    await expect(page.getByRole(readyRole, { name: readyName, exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Tools", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    await expect(page.getByRole(readyRole, { name: readyName, exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
