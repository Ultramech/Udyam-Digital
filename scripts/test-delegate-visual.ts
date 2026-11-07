import { chromium, devices } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const outDir = "/Users/gauranggarg/Desktop/Airtel/shots/delegate";
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Owner context (Mobile)
  const ownerCtx = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
    baseURL: "http://localhost:3000",
  });
  const ownerPage = ownerCtx.newPage ? await ownerCtx.newPage() : await ownerCtx.newPage();

  console.log("1. Signing in owner...");
  const phone = "98765" + Math.floor(10000 + Math.random() * 90000);
  const vres = await ownerPage.request.post("/api/demo/verify", { data: { phone } });
  console.log("verify status:", vres.status());
  const sres = await ownerPage.request.post("/api/me/setup", {
    data: {
      name: "Rakesh Sharma",
      profileType: "owner",
      email: "rakesh@example.com",
      business: {
        name: "Sharma Medical Store",
        type: "Pharmacy",
        typeOther: "",
        city: "Indore",
        cityOther: "",
        employees: "3",
        sites: "1",
        address: "Shop 4, MG Road, Rajwada",
        pincode: "452001",
        gstin: "",
        udyam: "",
      },
    },
  });
  console.log("setup status:", sres.status());

  console.log("2. Creating quote via advisor...");
  const ares = await ownerPage.request.post("/api/advisor", {
    data: { text: "Kirana store in Indore, 3 staff, one shop, need internet and billing", lang: "en" },
  });
  console.log("ares status:", ares.status());
  const adata = await ares.json();
  console.log("adata:", adata);
  const qres = await ownerPage.request.post("/api/quote", {
    data: { conversationId: adata.conversationId },
  });
  console.log("qres status:", qres.status());
  const qdata = await qres.json();
  console.log("qdata:", qdata);
  const qid = qdata.quote.id;
  console.log("Quote ID:", qid);

  // Consent
  await ownerPage.request.post("/api/consent", {
    data: {
      quoteId: qid,
      lang: "en",
      purposes: { kyc: true, service: true, digilocker: false, marketing: false },
    },
  });

  // Navigate owner to KYC page
  console.log("3. Navigating owner to /order/" + qid + "/kyc");
  await ownerPage.goto(`/order/${qid}/kyc`);
  await ownerPage.waitForLoadState("networkidle");
  await ownerPage.screenshot({ path: path.join(outDir, "01-owner-kyc-page.png"), fullPage: true });

  // Click "Send a link" in the DelegateCard
  console.log("4. Opening delegate link form...");
  const sendLinkBtn = ownerPage.getByRole("button", { name: /Send a link/i });
  await sendLinkBtn.click();
  await ownerPage.waitForTimeout(500);
  await ownerPage.screenshot({ path: path.join(outDir, "02-owner-delegate-form.png"), fullPage: true });

  // Select "My CA or accountant"
  console.log("5. Selecting CA and creating link...");
  await ownerPage.getByRole("button", { name: /My CA or accountant/i }).click();
  await ownerPage.waitForTimeout(300);
  await ownerPage.getByRole("button", { name: /Create link/i }).click();
  await ownerPage.waitForTimeout(1000);
  await ownerPage.screenshot({ path: path.join(outDir, "03-owner-link-ready.png"), fullPage: true });

  // Get the link path
  const linkTextEl = await ownerPage.locator("p.break-all").first();
  const linkUrl = await linkTextEl.innerText();
  console.log("Generated Link URL:", linkUrl);
  const linkPath = new URL(linkUrl).pathname;

  // 2. CA context (Separate context, no cookies, separate person on mobile)
  console.log("6. Opening CA context on mobile phone...");
  const caCtx = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
    baseURL: "http://localhost:3000",
  });
  const caPage = await caCtx.newPage();
  await caPage.goto(linkPath);
  await caPage.waitForLoadState("networkidle");
  await caPage.screenshot({ path: path.join(outDir, "04-ca-phone-view.png"), fullPage: true });

  // CA uploads signatory ID document
  console.log("7. CA uploading ID document...");
  const firstInput = caPage.locator('input[type="file"]').first();
  await firstInput.setInputFiles("/Users/gauranggarg/Desktop/Airtel/data/kyc_documents/K01_signatory_id.png");
  console.log("7b. Waiting for upload response / result card...");
  await caPage.waitForTimeout(4000);
  await caPage.screenshot({ path: path.join(outDir, "05-ca-after-upload.png"), fullPage: true });

  // 3. Back to owner page to check auto-refresh / updated status
  console.log("8. Checking owner view for updated status...");
  await ownerPage.waitForTimeout(4000);
  await ownerPage.screenshot({ path: path.join(outDir, "06-owner-status-updated.png"), fullPage: true });

  await browser.close();
  console.log("Done! All screenshots captured in", outDir);
}

run().catch((e) => {
  console.error("Error running visual test:", e);
  process.exit(1);
});
