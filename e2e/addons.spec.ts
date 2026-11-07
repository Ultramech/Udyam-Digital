import { expect, test } from "@playwright/test";
import { newQuote, signInAndSetup } from "./helpers";

test("quote summary opens WhatsApp with current prices and an owner-only resume URL", async ({ page }) => {
  await signInAndSetup(page);
  const id = await newQuote(page.request, "Dental clinic in Bengaluru, 6 staff, one clinic, GST yes, need email and backup");
  await page.goto(`/quote/${id}`);
  await page.getByText("Share with a partner or CA", { exact: true }).click();
  await page.getByRole("button", { name: /Create share link/i }).click();
  const wa = page.getByRole("link", { name: /Send summary to WhatsApp/i });
  const href = await wa.getAttribute("href");
  expect(href).toContain("https://wa.me/?text=");
  const text = decodeURIComponent(new URL(href!).searchParams.get("text") ?? "");
  expect(text).toMatch(/Monthly ₹[\d,]+ \+ GST ₹[\d,]+ \| One-time setup ₹[\d,]+ \+ GST ₹[\d,]+/);
  expect(text).toMatch(/Proforma quote: https?:\/\/[^/]+\/api\/share\/[a-z0-9]{12}\/pdf/);
  const resume = text.match(/Resume your quote: (https?:\/\/[^\s]+)/)?.[1];
  expect(resume).toMatch(/\/api\/share\/[a-z0-9]{12}\/resume$/);
  const localResume = new URL(new URL(resume!).pathname, process.env.BASE ?? "http://localhost:3000");
  const resumed = await page.request.get(localResume.toString(), { maxRedirects: 0 });
  expect(resumed.status()).toBe(307);
  expect(resumed.headers().location).toContain(`/quote/${id}`);
});

test("quiet window and weekly closure persist with site feasibility and partner QR kit downloads", async ({ page }) => {
  await signInAndSetup(page);
  const id = await newQuote(page.request, "Dental clinic in Bengaluru, 6 staff, one clinic, GST yes, need email and backup");
  await page.goto(`/order/${id}/sites`);
  await page.getByLabel("Preferred installation window").selectOption("15:00–17:00");
  await page.getByLabel("Closed day").selectOption("2");
  await page.getByRole("textbox", { name: "Address" }).fill("Clinic 4, MG Road, Bengaluru");
  await page.getByRole("textbox", { name: "Pincode" }).fill("560001");
  await page.getByRole("button", { name: "Check availability" }).click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  const saved = await (await page.request.get(`/api/quote/${id}`)).json();
  expect(saved.quote.sites[0].preferredWindow).toBe("15:00–17:00");
  expect(saved.quote.sites[0].closedWeekdays).toEqual([2]);

  const staff = await page.request.post("/api/ops/session", { data: { id: "P01" } });
  expect(staff.status()).toBe(200);
  await page.goto("/ops/partners");
  const generate = page.getByRole("button", { name: "Generate store counter QR" }).first();
  await expect(generate).toBeVisible();
  await generate.click();
  const download = page.getByRole("link", { name: "Download QR kit" }).first();
  await expect(download).toHaveAttribute("download", /-counter-qr.png$/);
  await expect(page.locator("img[alt^='Store counter referral QR']").first()).toBeVisible();
});

test("remote signer invite is unguessable, 24-hour, and opens the exact order PDF", async ({ page }) => {
  await signInAndSetup(page);
  await page.request.post("/api/ops/session", { data: { id: "OPS1" } });
  await page.request.put("/api/ops/catalogue", { data: { productId: "P19", reset: true, note: "reset isolated e2e fixture" } });
  const id = await newQuote(page.request, "Pharmacy in Indore, 3 staff, one shop, no GST, need billing");
  const feasibility = await page.request.post("/api/feasibility", { data: { quoteId: id, sites: [{ index: 0, address: "Shop 14, MG Road, Indore", pincode: "452008" }] } });
  expect(feasibility.status()).toBe(200);
  expect((await page.request.post("/api/consent", { data: { quoteId: id, purposes: { kyc: true, service: true } } })).status()).toBe(200);
  const lookup = await page.request.post(`/api/kyc/${id}`, { data: { action: "lookup", siteAddress: "Shop 14, MG Road, Indore" } });
  expect(lookup.status()).toBe(200);
  for (const slot of ["address_proof", "signatory_id"]) {
    const upload = await page.request.post(`/api/kyc/${id}`, { data: { action: "specimen", applicant: "D01", slot } });
    expect(upload.status(), await upload.text()).toBe(200);
  }
  const orderRes = await page.request.post("/api/orders", { data: { quoteId: id, businessName: "Sharma Medical", lang: "en" } });
  expect(orderRes.status(), await orderRes.text()).toBe(200);
  const order = await orderRes.json();
  expect((await page.request.post(`/api/orders/${order.orderId}/esign`, { data: { t: order.token, step: "prepare" } })).status()).toBe(200);
  const inviteRes = await page.request.post(`/api/orders/${order.orderId}/esign`, { data: { t: order.token, step: "remote", signerPhone: "9876500066" } });
  expect(inviteRes.status(), await inviteRes.text()).toBe(200);
  const invite = await inviteRes.json();
  expect(invite.expiresInHours).toBe(24);
  expect(invite.whatsapp).toContain("https://wa.me/919876500066");
  const detailsRes = await page.request.get(new URL(invite.link).pathname.replace("/remote-sign/", "/api/remote-sign/"));
  expect(detailsRes.status()).toBe(200);
  const details = await detailsRes.json();
  expect(details.expiresAt).toBeGreaterThan(Date.now());
  const pdf = await page.request.get(details.pdf);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
});
