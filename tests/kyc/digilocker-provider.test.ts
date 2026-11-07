import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AggregatorError, _resetToken, aggregatorMode, fetchDocument, sessionStatus, startSession } from "@/lib/digilocker/aggregator";
import { readDigilockerAadhaarXml, aadhaarAsDocument } from "@/lib/kyc/aadhaar";
import { runKyc } from "@/lib/kyc/validate";
import { GST_ALL, TODAY, lookups } from "./helpers";

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };
let calls: Call[] = [];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function mockFetch(handler: (c: Call) => Response) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const c: Call = { url, method: init.method ?? "GET", headers: (init.headers ?? {}) as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    return handler(c);
  }));
}

beforeEach(() => { calls = []; _resetToken(); process.env.SANDBOX_API_KEY = "key_test_abc"; process.env.SANDBOX_API_SECRET = "secret_test_xyz"; delete process.env.SANDBOX_API_BASE; });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.SANDBOX_API_KEY; delete process.env.SANDBOX_API_SECRET; });

describe("DigiLocker through the licensed provider", () => {
  it("picks the free test host for key_test keys and the production host for key_live keys", () => {
    expect(aggregatorMode()).toBe("test");
    process.env.SANDBOX_API_KEY = "key_live_abc";
    expect(aggregatorMode()).toBe("live");
    delete process.env.SANDBOX_API_SECRET;
    expect(aggregatorMode()).toBeNull();
  });

  it("authenticates once (secret only on that call), then starts a DigiLocker session asking for Aadhaar only", async () => {
    mockFetch((c) => c.url.endsWith("/authenticate")
      ? json({ code: 200, data: { access_token: "tok123" } })
      : json({ code: 200, data: { session_id: "sess-1", authorization_url: "https://digilocker.example/authorize?x=1" } }));
    const s = await startSession("digilocker", "https://app.example/api/digilocker/callback?s=abc");
    expect(s).toEqual({ sessionId: "sess-1", url: "https://digilocker.example/authorize?x=1" });
    expect(calls[0].url).toBe("https://test-api.sandbox.co.in/authenticate");
    expect(calls[0].headers["x-api-secret"]).toBe("secret_test_xyz");
    expect(calls[1].url).toBe("https://test-api.sandbox.co.in/kyc/digilocker/sessions/init");
    expect(calls[1].headers.authorization).toBe("tok123"); // no "Bearer"
    expect(calls[1].headers["x-api-secret"]).toBeUndefined(); // the secret is never sent beyond authenticate
    expect(calls[1].body).toMatchObject({ doc_types: ["aadhaar"], redirect_url: "https://app.example/api/digilocker/callback?s=abc", flow: "signin" });
    await startSession("entitylocker", "https://app.example/cb");
    expect(calls.filter((c) => c.url.endsWith("/authenticate"))).toHaveLength(1); // token reused
    expect(calls[calls.length - 1].url).toContain("/kyc/entitylocker/sessions/init");
  });

  it("re-authenticates once if the token is rejected, then gives up on a second 401", async () => {
    let n = 0;
    mockFetch((c) => c.url.endsWith("/authenticate") ? json({ data: { access_token: `t${++n}` } }) : json({}, 401));
    await expect(sessionStatus("digilocker", "s")).rejects.toMatchObject({ code: "AUTH" });
    expect(n).toBe(2);
  });

  it("reads status and downloads the first consented file into memory", async () => {
    mockFetch((c) => {
      if (c.url.endsWith("/authenticate")) return json({ data: { access_token: "t" } });
      if (c.url.endsWith("/status")) return json({ data: { status: "succeeded", documents_consented: ["aadhaar"] } });
      if (c.url.includes("/documents/aadhaar")) return json({ data: { files: [{ url: "https://files.example/a.xml", size: 10, metadata: { ContentType: "application/xml" } }] } });
      return new Response("<x/>", { status: 200, headers: { "content-type": "application/xml" } });
    });
    expect(await sessionStatus("digilocker", "sess-1")).toEqual({ status: "succeeded", consented: ["aadhaar"] });
    const f = await fetchDocument("digilocker", "sess-1", "aadhaar");
    expect(f?.mime).toBe("application/xml");
    expect(f?.buf.toString()).toBe("<x/>");
  });

  it("returns null when nothing was shared, and refuses an oversized file", async () => {
    mockFetch((c) => c.url.endsWith("/authenticate") ? json({ data: { access_token: "t" } }) : json({ data: { files: [] } }));
    expect(await fetchDocument("digilocker", "s", "aadhaar")).toBeNull();
    mockFetch((c) => c.url.endsWith("/authenticate") ? json({ data: { access_token: "t" } }) : json({ data: { files: [{ url: "https://f/x", size: 99_000_000 }] } }));
    await expect(fetchDocument("digilocker", "s", "aadhaar")).rejects.toBeInstanceOf(AggregatorError);
  });

  it("without keys, nothing is called", async () => {
    delete process.env.SANDBOX_API_KEY;
    mockFetch(() => json({}));
    await expect(startSession("digilocker", "https://x/y")).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(calls).toHaveLength(0);
  });
});

describe("DigiLocker Aadhaar XML", () => {
  const xml = `<Certificate><CertificateData><KycRes><UidData uid="xxxxxxxx3632" tkn="t"><Poi dob="14-03-1981" gender="M" name="Ramesh Kumar Sharma"/>
    <Poa co="S/O Ganesh Sharma" country="India" dist="Indore" house="Shop 4" lm="Near Temple" loc="Rajwada" pc="452001" po="Rajwada" state="Madhya Pradesh" street="MG Road" subdist="Indore" vtc="Indore"/>
    <Pht>ZmFrZQ==</Pht></UidData></KycRes></CertificateData></Certificate>`;

  it("keeps only name, address, last 4 and birth year", () => {
    const a = readDigilockerAadhaarXml(xml);
    expect(a).toMatchObject({ name: "Ramesh Kumar Sharma", last4: "3632", birthYear: "1981", pincode: "452001", state: "Madhya Pradesh" });
    expect(a.address).toContain("Near Temple");
    expect(JSON.stringify(a)).not.toMatch(/ZmFrZQ|14-03-1981/);
  });

  it("refuses something that is not an Aadhaar XML", () => {
    expect(() => readDigilockerAadhaarXml("<html><body>login</body></html>")).toThrow();
  });

  it("feeds the same KYC rules, labelled as DigiLocker, and a mismatching proprietor name goes to review", () => {
    const prop = GST_ALL.find((r) => r.constitution === "Proprietorship" && r.status === "Active")!;
    const doc = aadhaarAsDocument("signatory_id", readDigilockerAadhaarXml(xml), "digilocker_aadhaar");
    expect(doc.source).toBe("digilocker_aadhaar");
    const r = runKyc({ today: TODAY, entered: { gstin: prop.gstin }, claimsUdyam: false, docs: { signatory_id: doc }, lookups });
    expect(r.checks.some((c) => c.code === "SIGNATORY_NOT_LINKED" && c.severity === "review")).toBe(true);
    expect(r.checks.some((c) => c.code === "FIELD_MISSING")).toBe(false);
  });
});
