import { expect, test } from "@playwright/test";
import { newQuote, noSideScroll, signInAndSetup } from "./helpers";

test.describe("Customer journey (phone)", () => {
  test("start screens: splash → welcome slides → Get Started opens log in; plans can be explored first; Hindi switch", async ({ page }) => {
    await page.goto("/");
    // the red splash first, then the welcome (a tap skips the splash)
    await expect(page.getByRole("heading", { level: 1, name: /Your Business\.\s*Better Connected\./ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /one place/ })).toBeVisible({ timeout: 8000 });
    await noSideScroll(page);
    await page.getByRole("tab", { name: "2" }).click();
    await expect(page.getByText("One clear price,")).toBeVisible();
    await page.getByRole("combobox", { name: "Language" }).selectOption("hi");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await page.getByRole("combobox", { name: "Language" }).selectOption("en");

    await page.getByRole("link", { name: "Explore plans first" }).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/");
    await page.getByRole("button", { name: "Get Started" }).click(); // no splash the second time in a visit
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in to your Business Account" })).toBeVisible();
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.getByRole("heading", { name: "Create your Business Account" })).toBeVisible();
    await noSideScroll(page);
  });

  test("signed out: every customer page sends you to sign in first, and comes back after", async ({ page }) => {
    for (const path of ["/advisor", "/catalogue", "/quote/QT-AAAAAA", "/support", "/account", "/track/UD-AAAAAA?t=x"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/[?]/g, "\\?")}`));
    }
    expect((await page.request.post("/api/advisor", { data: { text: "pharmacy in Indore", lang: "en" } })).status()).toBe(401);
  });

  test("signed in but profile not set up: pages send you to setup; APIs refuse", async ({ page }) => {
    await page.request.post("/api/demo/verify", { data: { phone: `9${String(Date.now()).slice(-9)}` } });
    await page.goto("/advisor");
    await expect(page).toHaveURL(/\/account\/setup\?next=%2Fadvisor/);
    expect((await page.request.post("/api/advisor", { data: { text: "pharmacy in Indore", lang: "en" } })).status()).toBe(403);
  });

  test("advisor: one message → a plan with one monthly price; a follow-up question gets an answer, not the plan again", async ({ page }) => {
    await signInAndSetup(page);
    await page.goto("/advisor");
    const box = page.getByPlaceholder(/business/i);
    await expect(box).toBeEnabled(); // the page is live once the input accepts text (the greeting is model-worded, so no fixed text to wait for)
    const send = page.getByRole("button", { name: "Send" });
    await box.fill("I run a pharmacy in Indore with 3 staff and one shop. No GST. I need billing and CCTV.");
    await send.click();
    await expect(page.getByText(/₹[\d,]+/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Customise & buy/i })).toBeVisible();
    const bubbles = await page.locator("[data-role='assistant'], .whitespace-pre-wrap").count();
    await expect(send).toBeDisabled(); // empty box after sending
    await box.fill("how long will installation take?");
    await send.click();
    await expect.poll(async () => page.locator("[data-role='assistant'], .whitespace-pre-wrap").count()).toBeGreaterThan(bubbles);
    await noSideScroll(page);
  });

  test("quote → share link → the decision-maker sees the same live plan without logging in", async ({ page, browser }) => {
    await signInAndSetup(page);
    const qid = await newQuote(page.request, "Dental clinic in Bengaluru, 6 staff, one clinic, GST yes, need email and backup");
    await page.goto(`/quote/${qid}`);
    await page.getByText("Share with a partner or CA", { exact: true }).click();
    await page.getByRole("button", { name: /Create share link/i }).click();
    const url = await page.getByRole("textbox", { name: "Share link" }).inputValue();
    expect(url).toMatch(/\/p\/[a-z0-9]{12}$/);
    const partner = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); // a different, signed-out person
    await partner.goto(new URL(url).pathname);
    await expect(partner.getByText(/A plan shared with you/i)).toBeVisible();
    await expect(partner.getByText(/\/month \+ GST/)).toBeVisible();
    await noSideScroll(partner);
  });

  test("feasibility uses the real India Post directory for a real pincode", async ({ page }) => {
    await signInAndSetup(page);
    const qid = await newQuote(page.request, "Pharmacy in Delhi, 3 staff, one shop, no GST, need billing");
    const f = await (await page.request.post("/api/feasibility", { data: { quoteId: qid, sites: [{ index: 0, address: "Shop 1, Connaught Place, Delhi", pincode: "110001" }] } })).json();
    expect(f.perSite[0].area?.district).toBe("Central Delhi");
    expect(f.perSite[0].basis).toBe("post_office");
  });

  test("a wrong tracking link explains itself instead of erroring", async ({ page }) => {
    await signInAndSetup(page);
    await page.goto("/track/UD-NOPE00?t=wrong");
    await expect(page.getByText(/tracking link|ट्रैकिंग लिंक/i)).toBeVisible();
  });
});

test.describe("Guards (server-side, not just UI)", () => {
  test("payment and signature shortcuts are closed; forged tokens are refused", async ({ request }) => {
    expect((await request.post("/api/orders/UD-NOPE00/pay", { data: { t: "x", outcome: "success" } })).status()).toBeGreaterThanOrEqual(400);
    expect((await request.put("/api/otp", { data: { otpId: "OTP-FAKE", code: "123456" } })).status()).toBeGreaterThanOrEqual(400);
    expect((await request.post("/api/channels/telegram", { data: { update_id: 1 } })).status()).toBeGreaterThanOrEqual(403);
  });

  test("status panel lists every component with an honest mode", async ({ request }) => {
    const s = await (await request.get("/api/status")).json();
    const ids = s.services.map((x: { id: string }) => x.id);
    for (const id of ["advisor_ai", "document_ai", "otp", "payments", "esign", "feasibility", "scheduling", "whatsapp", "telegram", "digilocker"]) expect(ids).toContain(id);
    for (const x of s.services) expect(["live", "not_configured", "simulated"]).toContain(x.mode);
  });
});

test.describe("Ops console", () => {
  test("ops sign-in → overview with live metrics and the CX scorecard", async ({ page, request }) => {
    await page.request.post("/api/ops/session", { data: { id: "OPS1" } });
    await page.goto("/ops");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("CX scorecard")).toBeVisible();
    void request;
  });
  test("customers cannot read ops data", async ({ request }) => {
    expect((await request.get("/api/ops/overview")).status()).toBe(401);
  });
});
