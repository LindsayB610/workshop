import { expect, test, type Page } from "@playwright/test";

async function installMegaphone(page: Page) {
  const readyButton = page.getByRole("button", { name: /Megaphone Ready/ });
  if ((await readyButton.count()) > 0) {
    return;
  }

  const catalog = page.getByLabel("Add New Tools catalog");
  if ((await catalog.count()) === 0) {
    await page.getByRole("button", { name: "Add New Tools" }).click();
  }
  await expect(catalog).toBeVisible();
  await catalog
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Megaphone" }) })
    .getByRole("button", { name: "Install" })
    .click();
  await expect(readyButton).toBeVisible();
}

async function openMegaphone(page: Page) {
  await page.goto("/");
  await installMegaphone(page);
  await page
    .getByRole("button", {
      name: "Megaphone Ready Plan and shape campaign messages across channels from one source brief.",
    })
    .click();
  await expect(page.getByText("Workshop / megaphone")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Megaphone" })).toBeVisible();
}

test.describe("Megaphone Workshop integration", () => {
  test("opens Megaphone and route buttons switch function screens", async ({ page }) => {
    await openMegaphone(page);

    for (const [label, sectionId, visibleHeading, hiddenSectionId] of [
      ["Sources", "megaphone-sources", "Client Mode", "megaphone-briefs"],
      ["Onboarding", "megaphone-onboarding", "New Client Onboarding", "megaphone-sources"],
      ["Strategy", "megaphone-strategy", "Strategy", "megaphone-onboarding"],
      ["Briefs", "megaphone-briefs", "Active Post Package", "megaphone-strategy"],
      ["Drafts", "megaphone-drafts", "Generated Artifacts", "megaphone-briefs"],
      ["Calendar", "megaphone-calendar", "Calendar", "megaphone-drafts"],
      ["Measurement", "megaphone-measurement", "Measurement", "megaphone-calendar"],
    ] as const) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.getByRole("navigation", { name: "Megaphone functions" })).toContainText(
        label,
      );
      await expect(
        page.getByRole("navigation", { name: "Megaphone functions" }).getByRole("button", {
          name: label,
          exact: true,
        }),
      ).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByText("Workshop / megaphone")).toBeVisible();
      await expect(page.getByLabel("Workshop tools")).toHaveCount(0);
      await expect(page.locator(`#${sectionId}`)).toBeVisible();
      await expect(page.getByText(visibleHeading, { exact: false }).first()).toBeVisible();
      await expect(page.locator(`#${hiddenSectionId}`)).toHaveCount(0);
    }
  });

  test("Tools is the intentional route back to the tool picker", async ({ page }) => {
    await openMegaphone(page);

    await page.getByRole("button", { name: "Tools", exact: true }).click();

    await expect(page.getByLabel("Workshop tools")).toBeVisible();
    await expect(page.getByRole("button", { name: /Megaphone Ready/ })).toBeVisible();
    await expect(page.getByText("Workshop / megaphone")).toHaveCount(0);
  });

  test("client switching updates packet context and clears stale action state", async ({ page }) => {
    await openMegaphone(page);

    await page.getByRole("button", { name: "Load Client Folder" }).click();
    await expect(
      page.getByText("Client folder loading is available in the packaged Workshop app."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Brightbeam Analytics", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Brightbeam Analytics" })).toBeVisible();
    await expect(page.locator("#megaphone-sources").getByText("Brand client", { exact: true })).toBeVisible();
    await expect(
      page.locator("#megaphone-sources").getByText("company LinkedIn page", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("#megaphone-sources").getByText("clients/brightbeam")).toBeVisible();
    await expect(page.locator("#megaphone-sources").getByText("evaluation_guide")).toBeVisible();
    await expect(
      page.getByText("Client folder loading is available in the packaged Workshop app."),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create Brief" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Export Package" })).toBeDisabled();

    await page.getByRole("button", { name: "Avery Stone", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Avery Stone" })).toBeVisible();
    await expect(
      page.locator("#megaphone-sources").getByText("Influencer client", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("#megaphone-sources").getByText("personal LinkedIn account", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("#megaphone-sources").getByText("not personal voice mimicry")).toBeVisible();
    await expect(
      page.locator("#megaphone-sources").getByText("clients/demo-influencer"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "what to inspect before hiring workflow narrative consulting help",
      }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Briefs", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "what to inspect before hiring workflow narrative consulting help",
      }),
    ).toBeVisible();
  });

  test("post type controls update example retrieval policy and empty states", async ({ page }) => {
    await openMegaphone(page);
    await page.getByRole("button", { name: "Briefs", exact: true }).click();

    await expect(page.getByLabel("Example retrieval controls")).toContainText(
      "Exact post-type examples only",
    );
    await page.getByRole("button", { name: "evaluation_guide", exact: true }).click();
    await expect(page.locator("#megaphone-briefs").getByText("evaluation_guide").first()).toBeVisible();
    await page.getByLabel("Allow adjacent post-type examples").check();
    await expect(page.getByLabel("Example retrieval controls")).toContainText(
      "Adjacent retrieval is enabled",
    );

    await page.getByRole("button", { name: "Sources", exact: true }).click();
    await page.getByRole("button", { name: "Brightbeam Analytics", exact: true }).click();
    await page.getByRole("button", { name: "Briefs", exact: true }).click();
    await expect(page.getByLabel("Example retrieval controls")).toContainText(
      "No client-local example corpus is imported yet",
    );
    await expect(page.locator("#megaphone-briefs").getByText("evaluation_guide").first()).toBeVisible();
    await expect(page.getByLabel("Allow adjacent post-type examples")).not.toBeChecked();
  });

  test("onboarding controls expose detail changes and clipboard export feedback", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-write"], { origin: "http://127.0.0.1:1420" });
    await openMegaphone(page);
    await page.getByRole("button", { name: "Onboarding", exact: true }).click();

    await page.getByRole("button", { name: "Research needs_input" }).click();
    await expect(page.getByRole("heading", { name: "Research" })).toBeVisible();
    await expect(
      page.getByText("Imported research can upgrade caveat mode; placeholders keep the packet loadable."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Export Client Packet" }).click();
    await expect(
      page.getByText("No onboarding export files are configured for this Megaphone client."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Sources", exact: true }).click();
    await page.getByRole("button", { name: "Avery Stone", exact: true }).click();
    await page.getByRole("button", { name: "Onboarding", exact: true }).click();
    await page.getByRole("button", { name: "Export Client Packet" }).click();
    await expect(page.getByRole("button", { name: "Packet Exported" })).toBeVisible();
    await expect(page.getByText("Copied 3 onboarding files for demo-influencer.")).toBeVisible();
    await expect(page.getByText("Exported Packet Files")).toBeVisible();
  });

  test("Megaphone remains reachable at a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await openMegaphone(page);

    await expect(page.getByRole("navigation", { name: "Megaphone functions" })).toBeVisible();
    await page.getByRole("button", { name: "Measurement", exact: true }).click();
    await expect(
      page.locator("#megaphone-measurement").getByRole("heading", { name: "Measurement" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Load Client Folder" })).toHaveCount(0);
  });
});
