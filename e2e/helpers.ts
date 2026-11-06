import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** A fresh, valid Indian mobile per call (tests never collide). */
export const freshPhone = () => `9${String(Date.now()).slice(-9)}`;

/** A complete, valid profile (pincode 452001 = Indore GPO, checked live against India Post by the server). */
export const VALID_SETUP = {
  name: "Rakesh Sharma", profileType: "owner", email: "",
  business: { name: "Sharma Medical Store", type: "Pharmacy", typeOther: "", city: "Indore", cityOther: "", employees: "3", sites: "1", address: "Shop 4, MG Road, Rajwada", pincode: "452001", gstin: "", udyam: "" },
};

/**
 * Signs this browser context in and completes profile setup — the state every customer page now requires.
 * /api/demo/verify (ALLOW_TEST_VERIFY=1, refused in production) stands in ONLY for typing the SMS code; everything after it is the
 * real account path. Use page.request afterwards so API calls share the browser's cookies.
 */
export async function signInAndSetup(page: Page, phone = freshPhone()) {
  expect((await page.request.post("/api/demo/verify", { data: { phone } })).status()).toBe(200);
  const r = await page.request.post("/api/me/setup", { data: VALID_SETUP });
  expect(r.status(), await r.text()).toBe(200);
  return phone;
}

export async function newQuote(request: APIRequestContext, text: string) {
  const a = await (await request.post("/api/advisor", { data: { text, lang: "en" } })).json();
  const q = await (await request.post("/api/quote", { data: { conversationId: a.conversationId } })).json();
  return q.quote.id as string;
}

export const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
