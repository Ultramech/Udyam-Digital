import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useTempDb } from "./helpers";

vi.mock("server-only", () => ({}));

type D = typeof import("@/lib/delegate");
type S = typeof import("@/lib/db/store");
let D: D, S: S;
beforeAll(async () => { useTempDb(); D = await import("@/lib/delegate"); S = await import("@/lib/db/store"); });
afterEach(() => { vi.useRealTimers(); });

describe("delegate links: send one job to the right person", () => {
  it("creates a link that names exactly the documents it may add, and stores only a hash of the token", async () => {
    const { token, ref } = await D.createDelegate("QT-A", "My CA", ["gst_certificate", "udyam_certificate", "gst_certificate"], "Priya");
    const d = await D.resolveDelegate(token);
    expect(d).toMatchObject({ quoteId: "QT-A", label: "My CA", slots: ["gst_certificate", "udyam_certificate"], ownerFirstName: "Priya", uploaded: [] }); // duplicates folded
    expect(ref).toHaveLength(12);
    // the raw token is the credential: it must never be written to the database
    const rows = await S.listBy<{ key: string }>("share", "quote_id", "QT-A");
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("refuses things that are not a real link", async () => {
    expect(await D.resolveDelegate("not-a-token")).toBeNull();
    expect(await D.resolveDelegate("a".repeat(32))).toBeNull(); // right shape, never issued
    expect(await D.resolveDelegate("../../etc/passwd")).toBeNull();
  });

  it("cleans the label the owner types, so it can't carry markup into the delegate's page", async () => {
    const { token } = await D.createDelegate("QT-B", "  <script>alert(1)</script> Ramesh & Co  ", ["signatory_id"], null);
    const d = await D.resolveDelegate(token);
    expect(d?.label).not.toMatch(/[<>()]/); // no markup characters survive
    expect(d?.label).toContain("Ramesh & Co");
    expect(d!.label.length).toBeLessThanOrEqual(40);
  });

  it("records which documents came back, and reports a clear state for the owner's list", async () => {
    const { token } = await D.createDelegate("QT-C", "Partner or director", ["signatory_id", "address_proof"], "Asha");
    expect((await D.listDelegates("QT-C"))[0].state).toBe("waiting");
    await D.recordDelegateUpload(token, "signatory_id");
    expect((await D.listDelegates("QT-C"))[0].state).toBe("partly");
    await D.recordDelegateUpload(token, "address_proof");
    expect((await D.listDelegates("QT-C"))[0].state).toBe("done");
  });

  it("stops working after 48 hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T10:00:00Z"));
    const { token } = await D.createDelegate("QT-D", "My CA", ["gst_certificate"], null);
    vi.setSystemTime(new Date("2026-11-09T09:59:00Z"));
    expect(await D.resolveDelegate(token)).not.toBeNull(); // 47h59m
    vi.setSystemTime(new Date("2026-11-09T10:01:00Z"));
    expect(await D.resolveDelegate(token)).toBeNull();
    expect((await D.listDelegates("QT-D"))[0].state).toBe("expired");
  });

  it("the owner can cancel it at once; only the owner's own quote can be touched", async () => {
    const { token, ref } = await D.createDelegate("QT-E", "My CA", ["gst_certificate"], null);
    expect(await D.revokeDelegate("QT-SOMEONE-ELSE", ref)).toBe(false); // another quote can't cancel it
    expect(await D.resolveDelegate(token)).not.toBeNull();
    expect(await D.revokeDelegate("QT-E", ref)).toBe(true);
    expect(await D.resolveDelegate(token)).toBeNull();
    expect((await D.listDelegates("QT-E"))[0].state).toBe("cancelled");
    expect(await D.revokeDelegate("QT-E", ref)).toBe(false); // already cancelled
  });

  it("caps how many links can be open at once, so a quote can't be turned into a public upload form", async () => {
    for (let i = 0; i < 5; i++) await D.createDelegate("QT-F", `Helper ${i}`, ["gst_certificate"], null);
    await expect(D.createDelegate("QT-F", "One too many", ["gst_certificate"], null)).rejects.toThrow("TOO_MANY_LINKS");
    const [first] = await D.listDelegates("QT-F");
    await D.revokeDelegate("QT-F", first.ref);
    await expect(D.createDelegate("QT-F", "Fits now", ["gst_certificate"], null)).resolves.toBeTruthy(); // cancelling frees a slot
  });

  it("refuses a link with no documents, and ignores unknown document names", async () => {
    await expect(D.createDelegate("QT-G", "My CA", [], null)).rejects.toThrow("NO_SLOTS");
    await expect(D.createDelegate("QT-G", "My CA", ["passport" as never], null)).rejects.toThrow("NO_SLOTS");
  });

  it("never exposes the storage key or token in what the owner's list returns", async () => {
    const { token } = await D.createDelegate("QT-H", "My CA", ["gst_certificate"], null);
    const out = JSON.stringify(await D.listDelegates("QT-H"));
    expect(out).not.toContain(token);
    expect(out).not.toContain("dlg-");
  });
});
