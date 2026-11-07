import { expect, test, type Page } from "@playwright/test";
import { newQuote, noSideScroll, signInAndSetup } from "./helpers";

/**
 * Blueprint features added 2026-11-06, driven in a real browser at phone size against a running app. Real services throughout:
 * rules engine, registries, India Post directory, document-reader (Gemini) — including its honest failure when unavailable.
 * The ONLY seam is /api/demo/verify (ALLOW_TEST_VERIFY=1, refused in production), standing in for the SMS code a human types.
 */

const staff = (page: Page, id: string) => page.request.post("/api/ops/session", { data: { id } });
const monthlyBar = (page: Page) => page.locator(".fixed.bottom-0 .text-2xl").first();

test.describe("Catalogue (customer)", () => {
  test("browse all 25, search, filter by category, no sideways scroll", async ({ page }) => {
    await signInAndSetup(page);
    await page.goto("/catalogue");
    const count = page.locator("#all-h");
    await expect(count).toContainText("(25)");
    // the list starts short and opens fully on request
    await expect(page.locator("#all-services li")).toHaveCount(6);
    await page.getByRole("button", { name: /Show all 25 services/ }).click();
    await expect(page.locator("#all-services li")).toHaveCount(25);
    await page.getByRole("textbox", { name: "Search" }).fill("cctv");
    // the camera itself, plus Fixed IP whose benefit is "For CCTV viewing" — search covers benefits, not just names
    await expect(count).toContainText("(2)");
    await expect(page.getByText("Cloud CCTV camera")).toBeVisible();
    await expect(page.getByText("Fixed IP address")).toBeVisible();
    await page.getByRole("textbox", { name: "Search" }).fill("");
    await page.getByRole("button", { name: "Security", exact: true }).click();
    await expect(count).toContainText("(3)");
    // tags filter on catalogue facts: every "Free setup" row really has no setup fee
    await page.getByRole("button", { name: "All", exact: true }).first().click();
    await page.getByRole("group", { name: "Filter by tag" }).getByRole("button", { name: "Free setup" }).click();
    await expect(count).toContainText("(13)"); // the catalogue has 13 products with setup = 0
    await noSideScroll(page);
  });

  test("with a quote: every product shows its status for THIS business, and Add puts it in the plan", async ({ page }) => {
    await signInAndSetup(page);
    const request = page.request;
    const qid = await newQuote(request, "Kirana store in Indore, 2 staff, one shop, no GST, need billing");
    await page.goto(`/catalogue?quote=${qid}`);
    await expect(page.getByText("In plan").first()).toBeVisible();
    // GST-only product is explained, not hidden
    await page.getByRole("textbox", { name: "Search" }).fill("bulk sms");
    await expect(page.getByText(/needs a GST number/)).toBeVisible();
    await page.getByRole("textbox", { name: "Search" }).fill("");
    await page.getByRole("button", { name: "Only what I can get" }).click();
    const add = page.getByRole("button", { name: /^Add to my plan:/ }).first();
    await add.click();
    await expect(page.getByText("Added to your plan")).toBeVisible();
    const view = await (await request.get(`/api/quote/${qid}`)).json();
    expect(view.quote.version).toBeGreaterThan(1);
  });
});

test.describe("Quote: packages, digital score, report", () => {
  test("Basic / Recommended / Premium side by side; choosing one re-prices the plan", async ({ page }) => {
    await signInAndSetup(page);
    const request = page.request;
    const qid = await newQuote(request, "Pharmacy in Indore, 4 staff, one shop, GST yes, need billing, CCTV and WhatsApp");
    await page.goto(`/quote/${qid}`);
    await page.locator("summary", { hasText: "Compare packages" }).click();
    const table = page.getByRole("table", { name: "Package comparison" });
    await expect(table.getByText("Selected")).toBeVisible();
    const before = await monthlyBar(page).innerText();
    await table.getByRole("button", { name: "Choose" }).first().click(); // Basic
    await expect.poll(async () => monthlyBar(page).innerText()).not.toBe(before);
    const v = await (await request.get(`/api/quote/${qid}`)).json();
    expect(v.packages.find((p: { id: string }) => p.id === "basic").current).toBe(true);
    await table.getByRole("button", { name: "Choose" }).last().click(); // Premium
    await expect.poll(async () => (await (await request.get(`/api/quote/${qid}`)).json()).packages.find((p: { id: string }) => p.id === "premium").current).toBe(true);
    await noSideScroll(page);
  });

  test("digital score before → after, roadmap, and a real PDF business report", async ({ page }) => {
    await signInAndSetup(page);
    const request = page.request;
    const qid = await newQuote(request, "CA firm in Pune, 8 staff, one office, GST yes, need email and backup");
    await page.goto(`/quote/${qid}`);
    await page.getByText("Your digital score", { exact: true }).first().click();
    await page.getByRole("button", { name: /Biggest gaps and your roadmap/ }).click();
    await expect(page.getByText(/advisory score, not an official certification/)).toBeVisible();
    const pdf = await request.get(`/api/quote/${qid}/report`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    const bytes = await pdf.body();
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(3000);
  });
});

test.describe("Onboarding up to documents (real registries + India Post + honest reader)", () => {
  test("sites → consent → KYC registry lookup; bad upload refused; reader outage reported honestly", async ({ page }) => {
    await signInAndSetup(page);
    const request = page.request;
    const qid = await newQuote(request, "Bakery in Nagpur, 3 staff, one shop, GST yes, need billing");
    await page.goto(`/order/${qid}/sites`);
    await page.getByLabel("Address").fill("Shop/Unit 80, Civil Lines, Nagpur, Maharashtra");
    await page.getByLabel("Pincode").fill("440001");
    await page.getByRole("button", { name: "Check availability" }).click();
    await expect(page.getByText(/Nagpur/).first()).toBeVisible(); // India Post resolved the district
    await page.getByRole("button", { name: /Continue|consent|आगे/i }).last().click();
    await expect(page).toHaveURL(new RegExp(`/order/${qid}/consent`));
    await page.getByRole("button", { name: "I agree — continue" }).click();
    await expect(page).toHaveURL(new RegExp(`/order/${qid}/kyc`));
    await page.getByLabel("GST number (GSTIN)").fill("27XUIXG0767D1ZP");
    await page.getByRole("button", { name: "Look up" }).first().click();
    await expect(page.getByText(/Arjun Opticals|Active/).first()).toBeVisible({ timeout: 20_000 });
    // a non-image renamed .png is refused from its bytes
    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles({ name: "id.png", mimeType: "image/png", buffer: Buffer.from("not really an image") });
    await expect(page.getByText(/PNG\/JPG photo or a PDF/)).toBeVisible();
    // a real specimen goes to the real reader; if the reader is out of quota the app says so (never a fake extraction)
    await input.setInputFiles("data/kyc_documents/K03_signatory_id.png");
    await expect(page.getByText(/Document reading isn't available right now|What we read/)).toBeVisible({ timeout: 90_000 });
    await noSideScroll(page);
  });
});

test.describe("Support: assistant → person → reply → notification", () => {
  test("owner raises a request, ops replies with full context, owner sees it on Help and in Notifications", async ({ browser }) => {
    const owner = await browser.newPage();
    await signInAndSetup(owner);
    await owner.goto("/support");
    await owner.getByRole("textbox", { name: "Your question" }).fill("My invoice amount looks wrong, please check");
    await owner.getByRole("button", { name: "Ask" }).click();
    await expect(owner.getByText(/raise a request|Send to a person|pick it above/).first()).toBeVisible();
    await owner.getByRole("button", { name: "Send to a person" }).click();
    await expect(owner.getByText(/Request TK-[A-Z0-9]{6} sent/)).toBeVisible();
    const id = (await owner.getByText(/^TK-[A-Z0-9]{6}/).first().innerText()).slice(0, 9);
    await expect(owner.getByText("Received")).toBeVisible();

    const ops = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await staff(ops, "OPS1");
    await ops.goto("/ops/support");
    await ops.getByRole("button", { name: new RegExp(id) }).click();
    await expect(ops.getByText("Handoff context")).toBeVisible();
    await expect(ops.getByText(/invoice amount looks wrong/).first()).toBeVisible();
    await ops.getByPlaceholder(/Reply to the owner/).fill("Checked: GST is shown separately; your plan total is correct.");
    await ops.getByRole("button", { name: "Send reply" }).click();
    await expect(ops.getByText("Reply sent")).toBeVisible();

    await owner.reload();
    await expect(owner.getByText(/GST is shown separately/)).toBeVisible({ timeout: 20_000 });
    await expect(owner.getByText("Being handled")).toBeVisible();
    await expect(owner.getByRole("link", { name: /Notifications, \d+ unread/ })).toBeVisible({ timeout: 40_000 });
    await owner.goto("/notifications");
    await expect(owner.getByText(/GST is shown separately/)).toBeVisible();
    await noSideScroll(owner);
  });
});

test.describe("Ops console: new screens and role gates", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("analytics reproduces the case funnel and filters change it", async ({ page }) => {
    await staff(page, "OPS1");
    await page.goto("/ops/analytics");
    const tile = (label: string) => page.getByText(label, { exact: true }).locator("xpath=following-sibling::div[1]");
    await expect(tile("Leads")).toHaveText("5,000");
    await expect(tile("Lead → activation")).toHaveText("7.4%");
    await expect(tile("Days to activate")).toHaveText("17.6");
    await expect(page.getByText(/Pilot targets \(proposed, not results\)/)).toBeVisible();
    await expect(page.getByText(/cross-validated AUC/)).toBeVisible();
    await page.getByRole("combobox", { name: "All segments" }).selectOption("Micro retail & services");
    await expect(tile("Leads")).not.toHaveText("5,000");
  });

  test("catalogue admin: out-of-band price refused; pause shows up for customers; history + audit recorded; reset", async ({ page }) => {
    await signInAndSetup(page);
    const request = page.request;
    test.setTimeout(240_000); // two live advisor turns; slow when the AI provider is rate-limiting
    await staff(page, "OPS1");
    await page.goto("/ops/catalogue");
    await page.getByLabel("P19 indicative price").fill("99999");
    await page.getByLabel("P19 reason").fill("e2e band check");
    await page.locator("tr", { has: page.getByLabel("P19 reason") }).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/within the published band/)).toBeVisible();
    await page.reload();
    await page.getByLabel("P19 paused").click();
    await page.getByLabel("P19 reason").fill("e2e pause");
    await page.locator("tr", { has: page.getByLabel("P19 reason") }).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/P19: 1 change\(s\) saved/)).toBeVisible();
    await expect(page.getByRole("cell", { name: "e2e pause" }).first()).toBeVisible(); // history accumulates across runs

    const qid = await newQuote(request, "Kirana store in Indore, 2 staff, one shop, no GST, need billing");
    const v = await (await request.get(`/api/quote/${qid}`)).json();
    expect(v.quote.lines.some((l: { productId: string }) => l.productId === "P19")).toBe(false);
    expect(v.exclusions.concat(v.catalogue.filter((c: { state: string }) => c.state === "unavailable").map((c: { productId: string; reason: { code: string } }) => ({ productId: c.productId, code: c.reason.code })))
      .some((e: { productId: string; code: string }) => e.productId === "P19" && e.code === "EXCL_PAUSED")).toBe(true);

    await page.locator("tr", { has: page.getByLabel("P19 reason") }).getByRole("button", { name: "Reset" }).click();
    await expect(page.getByText(/P19: 1 change\(s\) saved/)).toBeVisible();
    const after = await (await request.get(`/api/quote/${await newQuote(request, "Kirana store in Indore, 2 staff, one shop, no GST, need billing")}`)).json();
    expect(after.quote.lines.some((l: { productId: string }) => l.productId === "P19")).toBe(true);

    await staff(page, "ADM1");
    await page.goto("/ops/audit");
    await expect(page.getByRole("cell", { name: "catalogue.update" }).first()).toBeVisible();
  });

  test("roles: partners don't see Support/Catalogue; reps can't open the audit log; customers screen masks phones", async ({ page }) => {
    await staff(page, "P01");
    await page.goto("/ops");
    const nav = page.getByRole("navigation", { name: "Operations" });
    await expect(nav.getByRole("link", { name: "Partner book" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Catalogue" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Support" })).toHaveCount(0);
    expect((await page.request.get("/api/ops/catalogue")).status()).toBe(403);
    await staff(page, "R01");
    expect((await page.request.get("/api/ops/audit")).status()).toBe(403);
    await page.goto("/ops/customers");
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
    const html = await page.content();
    expect(html).not.toMatch(/\b[6-9]\d{9}\b/); // no full mobile number anywhere on the page
  });
});
