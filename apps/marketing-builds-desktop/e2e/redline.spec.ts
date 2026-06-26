import { expect, test, type Page } from "@playwright/test";

async function installTool(page: Page, toolName: "Redline" | "Megaphone") {
  const readyButton = page.getByRole("button", { name: new RegExp(`${toolName} Ready`) });
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
    .filter({ has: page.getByRole("heading", { name: toolName }) })
    .getByRole("button", { name: "Install" })
    .click();
  await expect(readyButton).toBeVisible();
}

async function openRedline(page: Page) {
  await page.goto("/");
  await installTool(page, "Redline");
  await page
    .getByRole("button", {
      name: /Redline Ready Audit client pages against trusted source packets/,
    })
    .click();
  await expect(page.getByText("Workshop / redline")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Redline" })).toBeVisible();
}

test.describe("Redline Workshop integration", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-write"], { origin: "http://127.0.0.1:1420" });
  });

  test("opens Redline from the picker and returns through the Tools button", async ({ page }) => {
    await openRedline(page);

    await expect(page.getByRole("button", { name: "Run Audit" })).toBeVisible();
    const functionNav = page.getByRole("navigation", { name: "Redline functions" });
    await expect(functionNav.getByRole("button", { name: "Review" })).toBeVisible();
    await expect(functionNav.getByRole("button", { name: "Packet" })).toBeVisible();
    await expect(functionNav.getByRole("button", { name: "Onboarding" })).toBeVisible();

    await page.getByRole("button", { name: "Tools", exact: true }).click();

    await expect(page.getByLabel("Workshop tools")).toBeVisible();
    await expect(page.getByRole("button", { name: /Redline Ready/ })).toBeVisible();
    await expect(page.getByText("Workshop / redline")).toHaveCount(0);
  });

  test("disabling Redline hides it until Add New Tools restores it", async ({ page }) => {
    await page.goto("/");
    await installTool(page, "Redline");
    await installTool(page, "Megaphone");

    await page.getByLabel("Redline tool actions").click();
    await page.getByRole("menuitem", { name: "Disable tool" }).click();

    await expect(page.getByRole("button", { name: /Redline Ready/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Megaphone Ready/ })).toBeVisible();
    await expect(page.getByText(/Local client packets stay untouched/)).toBeVisible();

    await page.getByRole("button", { name: "Add New Tools" }).click();
    await expect(page.getByLabel("Add New Tools catalog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Redline" })).toBeVisible();

    await page
      .getByLabel("Add New Tools catalog")
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Redline" }) })
      .getByRole("button", { name: "Install" })
      .click();
    await expect(page.getByRole("button", { name: /Redline Ready/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Megaphone Ready/ })).toBeVisible();
    await expect(page.getByText(/Redline is installed/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add New Tools" })).toBeVisible();
    await expect(page.getByLabel("Add New Tools catalog")).toHaveCount(0);
  });

  test("tool action menu opens docs, workspace, and resets local UI state", async ({
    context,
    page,
  }) => {
    await page.goto("/");
    await installTool(page, "Redline");
    await page.evaluate(() => {
      window.localStorage.setItem("workshop.toolLocalState.redline.activeClient", "fixture");
      window.localStorage.setItem("workshop.toolLocalState.megaphone.activeClient", "demo-megaphone");
    });

    await page.getByLabel("Redline tool actions").click();
    const docsPagePromise = context.waitForEvent("page");
    await page.getByRole("menuitem", { name: "View docs" }).click();
    const docsPage = await docsPagePromise;
    await expect(docsPage).toHaveURL(/\/docs\/tools\/redline\.md$/);
    await docsPage.close();
    await page.bringToFront();

    await page.getByRole("menuitem", { name: "Reset local state" }).click();
    await expect(page.getByText(/Redline local UI state was reset/)).toBeVisible();
    await expect(
      page.evaluate(() => window.localStorage.getItem("workshop.toolLocalState.redline.activeClient")),
    ).resolves.toBeNull();
    await expect(
      page.evaluate(() =>
        window.localStorage.getItem("workshop.toolLocalState.megaphone.activeClient"),
      ),
    ).resolves.toBe("demo-megaphone");

    await page.getByRole("menuitem", { name: "Open workspace" }).click();
    await expect(page.getByText("Workshop / redline")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Redline" })).toBeVisible();
  });

  test("top route buttons switch Redline function screens", async ({ page }) => {
    await openRedline(page);
    const topNav = page.getByRole("navigation", { name: "Redline functions" });

    await topNav.getByRole("button", { name: "Review", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Audit" })).toHaveCount(0);
    await expect(topNav.getByRole("button", { name: "Review" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await topNav.getByRole("button", { name: "Packet", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Packet Health" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Review Queue" })).toHaveCount(0);

    await topNav.getByRole("button", { name: "Audit", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Audit" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Packet Health" })).toHaveCount(0);
    await expect(topNav.getByRole("button", { name: "Audit" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await topNav.getByRole("button", { name: "Onboarding", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Onboarding", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Audit" })).toHaveCount(0);

    await topNav.getByRole("button", { name: "Audit", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Audit" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Onboarding", exact: true })).toHaveCount(0);
  });

  test("client rail switches workspaces and add client opens onboarding", async ({ page }) => {
    await openRedline(page);

    await page.getByRole("button", { name: "Open Fixture Client" }).click();
    await expect(page.getByRole("heading", { name: "Fixture Client" })).toBeVisible();
    await expect(page.getByText("clients/fixture", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Audit" })).toBeVisible();

    await page.getByRole("button", { name: "Add new Redline client" }).click();

    await expect(page.getByRole("heading", { name: "Onboarding", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export Packet" })).toBeVisible();
    await expect(page.getByLabel("Redline onboarding workflow")).toBeVisible();
  });

  test("audit controls run the selected target and enable export actions", async ({ page }) => {
    await openRedline(page);

    await expect(page.getByRole("button", { name: "Export Reports" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Open Reports" })).toBeDisabled();

    await page.getByLabel("Audit target").selectOption({ label: "Queued demo URL" });
    await expect(page.getByText("workshop://demo-redline/landing-page")).toBeVisible();
    await expect(page.getByText("Role: queued_live_url")).toBeVisible();

    await page.getByRole("button", { name: "Snapshot Live URL" }).click();
    await expect(page.getByText(/Saved live snapshot/)).toBeVisible();
    await expect(page.getByLabel("Audit target")).toHaveValue(
      "demo-page-2026-06-23",
    );
    await expect(page.getByText("Role: current_reproducible_audit_target")).toBeVisible();

    await page.getByRole("button", { name: "Open Packet" }).click();
    await page.getByRole("button", { name: "Run Audit" }).click();

    await expect(page.getByText(/audit run completed/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Export Reports" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Open Reports" })).toBeEnabled();

    await page.getByRole("button", { name: "Export Reports" }).click();
    await expect(page.getByText(/Copied .* report files for demo-redline/)).toBeVisible();

    await page.getByRole("button", { name: "Open Reports" }).click();
    await expect(page.getByText(/Copied clients\/demo-redline\/reports/)).toBeVisible();
  });

  test("review filters, artifact buttons, evidence buttons, and copy brief update state", async ({
    page,
  }) => {
    await openRedline(page);
    await page.getByRole("navigation", { name: "Redline functions" }).getByRole("button", { name: "Review" }).click();

    await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();

    await page.getByRole("button", { name: /Manual Review/ }).click();
    await expect(page.getByText("Time-savings claim needs approved proof")).toHaveCount(0);
    await expect(page.getByText("Hero does not name the operational buyer")).toHaveCount(0);

    await page.getByRole("button", { name: /Proof Review/ }).click();
    await page.getByLabel("Priority").selectOption("high");
    await page.getByLabel("Audit mode").selectOption("proof_gap");
    await expect(page.getByText("Time-savings claim needs approved proof")).toBeVisible();
    await expect(page.getByText("Absolute guarantee should be softened")).toHaveCount(0);

    await page.getByRole("button", { name: /Executive summary/ }).click();
    await expect(page.getByText(/Copied clients\/demo-redline\/reports/)).toBeVisible();

    await page.getByRole("button", { name: /Approved proof notes/ }).first().click();
    await expect(page.getByText(/Copied clients\/demo-redline\/canonical/)).toBeVisible();

    await page.getByRole("button", { name: "Copy Brief" }).first().click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  });

  test("packet and onboarding function screens expose their expected actions", async ({ page }) => {
    await openRedline(page);

    await page.getByRole("navigation", { name: "Redline functions" }).getByRole("button", { name: "Packet" }).click();
    await expect(page.getByRole("heading", { name: "Packet Health" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Source Readiness" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Exports" })).toBeVisible();
    await page.getByRole("button", { name: /Executive summary/ }).click();
    await expect(page.getByText(/Copied clients\/demo-redline\/reports/)).toBeVisible();

    await page.getByRole("navigation", { name: "Redline functions" }).getByRole("button", { name: "Onboarding" }).click();
    await page.getByLabel("Client name").fill("Northstar Demo Co. Labs");
    await expect(page.getByRole("heading", { name: "Northstar Demo Co. Labs" })).toBeVisible();

    await page.getByRole("button", { name: "Export Packet" }).click();
    await expect(page.getByText(/Copied .* packet files for demo-onboarding-draft/)).toBeVisible();
  });
});
