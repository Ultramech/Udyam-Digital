import { expect, test } from "@playwright/test";
import { newQuote, noSideScroll, signInAndSetup } from "./helpers";

/**
 * "Send it to the right person": the owner gives a CA or partner a link; they act from their own phone, with no account.
 * The delegate runs in a SEPARATE browser context (no cookies), exactly like a real second person.
 */
test.describe("Delegate links", () => {
  test("a CA with no account can add only the documents asked for; the owner can cancel", async ({ page, browser }) => {
    await signInAndSetup(page);
    const owner = page.request;
    const qid = await newQuote(owner, "Bakery in Nagpur, 3 staff, one shop, GST yes, need billing");
    expect((await owner.post("/api/consent", { data: { quoteId: qid, lang: "en", purposes: { kyc: true, service: true, digilocker: false, marketing: false } } })).status()).toBe(200);

    // the owner makes a link for the CA covering two documents
    const made = await owner.post("/api/delegate", { data: { quoteId: qid, label: "My CA", slots: ["gst_certificate", "signatory_id"] } });
    expect(made.status(), await made.text()).toBe(200);
    const { path, ref } = await made.json();
    expect(path).toMatch(/^\/d\/[A-Za-z0-9]{20,}$/);
    const token = path.split("/").pop() as string;

    // a different person, on a different phone: no cookies at all
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: test.info().project.use.baseURL });
    const ca = await ctx.newPage();
    await ca.goto(path);
    await expect(ca.getByRole("heading", { name: /needs your help/i })).toBeVisible();
    await expect(ca.getByText("GST certificate")).toBeVisible();
    await expect(ca.getByText("Your ID")).toBeVisible();
    await expect(ca.getByText("Shop address proof")).toHaveCount(0); // only what was asked for
    await noSideScroll(ca);

    // what the link reveals is minimal: no phone, GSTIN, address or anything read from a document
    const info = await (await ctx.request.get(`/api/d/${token}`)).text();
    expect(info).not.toMatch(/\b9\d{9}\b|\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z0-9][A-Z0-9]\b|Rajwada|MG Road/);
    expect(JSON.parse(info).slots).toHaveLength(2);

    // it cannot add a document it was not asked for, and a made-up link does nothing
    const wrongSlot = await ctx.request.post(`/api/d/${token}/doc`, { multipart: { slot: "address_proof", file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } } });
    expect(wrongSlot.status()).toBe(403);
    expect((await ctx.request.get(`/api/d/${"z".repeat(32)}`)).status()).toBe(404);
    // and the owner's private endpoints stay closed to a person with no account
    expect((await ctx.request.get(`/api/delegate?quoteId=${qid}`)).status()).toBeGreaterThanOrEqual(401);
    expect((await ctx.request.get(`/api/kyc/${qid}`)).status()).toBeGreaterThanOrEqual(401);

    // a renamed non-image is refused from its bytes; a deliberately blurred certificate is sent back for retaking, in plain words
    const input = ca.locator('input[type="file"]').first();
    await input.setInputFiles({ name: "gst.png", mimeType: "image/png", buffer: Buffer.from("not really an image") });
    await expect(ca.locator("p[role=alert]")).toContainText(/PNG or JPG|PDF/);
    await input.setInputFiles("data/kyc_documents/K04_gst_certificate.png");
    await expect(ca.getByText(/send this one again/i)).toBeVisible({ timeout: 30_000 });

    // the owner sees the link and what came back, then cancels it
    const mine = await (await owner.get(`/api/delegate?quoteId=${qid}`)).json();
    expect(mine.delegates).toHaveLength(1);
    expect(mine.delegates[0]).toMatchObject({ label: "My CA", state: "partly" });
    expect(JSON.stringify(mine)).not.toContain(token); // the owner's list never carries the secret
    expect((await owner.delete(`/api/delegate/${ref}?quoteId=${qid}`)).status()).toBe(200);

    await ca.reload();
    await expect(ca.getByText(/no longer works/i)).toBeVisible();
    const afterCancel = await ctx.request.post(`/api/d/${token}/doc`, { multipart: { slot: "gst_certificate", file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } } });
    expect(afterCancel.status()).toBe(404);
    await ctx.close();
  });

  test("another signed-in user cannot create, list or cancel links on someone else's quote", async ({ page, browser }) => {
    await signInAndSetup(page);
    const qid = await newQuote(page.request, "Clinic in Pune, 4 staff, one site");
    await page.request.post("/api/consent", { data: { quoteId: qid, lang: "en", purposes: { kyc: true, service: true, digilocker: false, marketing: false } } });
    const made = await (await page.request.post("/api/delegate", { data: { quoteId: qid, label: "My CA", slots: ["gst_certificate"] } })).json();

    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const other = await ctx.newPage();
    await signInAndSetup(other);
    expect((await other.request.post("/api/delegate", { data: { quoteId: qid, label: "Intruder", slots: ["gst_certificate"] } })).status()).toBe(404);
    expect((await other.request.get(`/api/delegate?quoteId=${qid}`)).status()).toBe(404);
    expect((await other.request.delete(`/api/delegate/${made.ref}?quoteId=${qid}`)).status()).toBe(404);
    await ctx.close();
  });
});
