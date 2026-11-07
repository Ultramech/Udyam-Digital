import { expect, test } from "@playwright/test";
import { freshPhone, noSideScroll, signInAndSetup } from "./helpers";

/** Customer account + staff login screens at phone size. The only seam is /api/demo/verify (skips the SMS a human types). */
test.describe("Customer account", () => {
  test("signed out: /account requires sign-in (redirect to /login with next)", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
    await expect(page.getByRole("heading", { name: "Log in to your Business Account" })).toBeVisible();
    await expect(page.getByLabel("Mobile number")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send OTP" })).toBeVisible();
    await noSideScroll(page);
  });

  test("sign-up: OTP → setup refuses invalid details field by field → valid details unlock the app and return to where you were", async ({ page }) => {
    await page.goto("/login?next=/catalogue");
    await page.request.post("/api/demo/verify", { data: { phone: freshPhone() } }); // stands in for typing the SMS code
    await page.reload();
    await expect(page).toHaveURL(/\/account\/setup\?next=%2Fcatalogue/);
    // there is no way past setup without completing it
    await expect(page.getByRole("button", { name: /Skip/ })).toHaveCount(0);

    // step 1: an invalid name is refused, then a valid name + business name move on
    await page.getByLabel(/Full name/).fill("R2D2 123");
    await page.getByLabel(/Business name/).fill("Iyer Dental Care");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Use letters only/)).toBeVisible();
    await page.getByLabel(/Full name/).fill("Priya Iyer");
    await page.getByRole("button", { name: "Continue" }).click();

    // step 2: empty business profile fields are refused
    await expect(page.getByRole("heading", { name: "Business Profile" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose your type of business.")).toBeVisible();
    await expect(page.getByText("Choose your city.")).toBeVisible();
    await page.getByLabel(/Type of business/).selectOption("Dental clinic");
    await page.getByLabel(/People working/).fill("6");
    await page.getByLabel(/^City/).selectOption("Chennai");
    await page.getByLabel(/You are the/).selectOption({ label: "Partner / director" });
    await page.getByRole("button", { name: "Continue" }).click();

    // step 3: malformed address / pincode / GSTIN / email are refused
    await expect(page.getByRole("heading", { name: "Business Details" })).toBeVisible();
    await page.getByLabel(/Business address/).fill("short");
    await page.getByLabel(/Pincode/).fill("012345");
    await page.getByLabel(/GSTIN/).fill("27ABCDE1234F1Z9");
    await page.getByLabel(/Email/).fill("priya@");
    await page.getByRole("button", { name: "Finish and continue" }).click();
    await expect(page.getByText(/Enter the full address/)).toBeVisible();
    await expect(page.getByText(/doesn't start with 0/)).toBeVisible();
    await expect(page.getByText(/fails its check digit/)).toBeVisible();
    await expect(page.getByText(/doesn't look like an email/)).toBeVisible();

    // a real pincode that India Post doesn't know is refused by the server
    await page.getByLabel(/Business address/).fill("12, 2nd Main Road, Adyar");
    await page.getByLabel(/GSTIN/).fill("");
    await page.getByLabel(/Email/).fill("priya.iyer@example.in");
    await page.getByLabel(/Pincode/).fill("999999");
    await page.getByRole("button", { name: "Finish and continue" }).click();
    await expect(page.getByText(/India Post has no such pincode|Couldn't save/)).toBeVisible({ timeout: 20_000 });

    // valid → done, and back to where they were headed
    await page.getByLabel(/Pincode/).fill("600020");
    await page.getByRole("button", { name: "Finish and continue" }).click();
    await expect(page).toHaveURL(/\/catalogue$/, { timeout: 20_000 });
    const me = await (await page.request.get("/api/me")).json();
    expect(me.user).toMatchObject({ name: "Priya Iyer", email: "priya.iyer@example.in", profileType: "director", onboarded: true });
    expect(me.businesses[0]).toMatchObject({ name: "Iyer Dental Care", businessType: "Dental clinic", city: "Chennai", employees: 6 });
    expect(me.businesses[0].locations[0]).toMatchObject({ address: "12, 2nd Main Road, Adyar", pincode: "600020" });
    await noSideScroll(page);
  });

  test("signed in: edit profile, add another business + location, see devices, sign out → locked again", async ({ page }) => {
    await signInAndSetup(page);
    await page.goto("/account");
    await expect(page.getByRole("button", { name: /Sharma Medical Store/ })).toBeVisible(); // business header, created by setup
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Account" })).toHaveAttribute("aria-current", "page"); // the Account tab is the current place

    // Business profile tile → edit name
    await page.getByRole("button", { name: "Business profile" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Your name").fill("Rakesh K Sharma");
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    // from there to businesses & locations → add another business
    await sheet.getByRole("button", { name: "Businesses & locations" }).click();
    await expect(sheet.getByText("Sharma Medical Store")).toBeVisible();
    await sheet.getByRole("button", { name: "Add business" }).click();
    await sheet.getByLabel("Business name").fill("Sharma Wellness Pharmacy");
    await sheet.getByLabel("Business type").fill("pharmacy");
    await sheet.getByLabel("City").fill("Indore");
    await sheet.getByLabel("Staff").fill("2");
    await sheet.getByRole("button", { name: "Save business" }).click();
    await expect(sheet.getByText("Sharma Wellness Pharmacy")).toBeVisible();
    await page.keyboard.press("Escape");

    // Team & access tile → signed-in devices
    await page.getByRole("button", { name: "Team & access" }).click();
    await expect(page.getByRole("dialog").getByText("This device")).toBeVisible();
    await page.keyboard.press("Escape");

    // dark mode switch applies to the whole app
    await page.getByRole("switch", { name: "Dark mode" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("switch", { name: "Dark mode" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    const exp = await page.request.get("/api/me/export");
    expect(exp.headers()["content-disposition"]).toContain("attachment");
    expect((await exp.json()).businesses.map((b: { name: string }) => b.name)).toEqual(expect.arrayContaining(["Sharma Medical Store", "Sharma Wellness Pharmacy"]));
    await noSideScroll(page);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get("/api/me")).status()).toBe(401);
  });

  test("/login returns to ?next once signed in and set up", async ({ page }) => {
    await signInAndSetup(page);
    await page.goto("/login?next=/support");
    await expect(page).toHaveURL(/\/support$/);
  });
});

test.describe("Staff login", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test("wrong password is refused; demo accounts work in DEMO_MODE; Team page lists staff for admins only", async ({ page }) => {
    await page.goto("/ops/login");
    await page.getByLabel("Work email").fill("nobody@accel.example");
    await page.getByLabel("Password").fill("wrong-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email or password is wrong.")).toBeVisible();
    await page.getByRole("button", { name: /Demo Admin/ }).click();
    await expect(page).toHaveURL(/\/ops$/);
    await page.goto("/ops/team");
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
    await expect(page.getByText("Kavita Menon")).toBeVisible();
    // a forged id cookie is not a session
    await page.context().clearCookies();
    await page.context().addCookies([{ name: "ud_staff", value: "ADM1", url: page.url() }]);
    expect((await page.request.get("/api/ops/team")).status()).toBe(401);
  });
});
