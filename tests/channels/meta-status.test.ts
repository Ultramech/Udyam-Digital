import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseInbound, parseStatuses } from "@/lib/channels/meta";

describe("Meta delivery receipts", () => {
  const payload = { entry: [{ changes: [{ value: { statuses: [
    { id: "wamid.A", status: "delivered", timestamp: "1793961400" },
    { id: "wamid.B", status: "failed", timestamp: "1793961401", errors: [{ code: 131047, title: "Re-engagement message" }] },
  ] } }] }] };
  it("reads delivered/failed receipts with Meta's error code, and no user messages", () => {
    expect(parseStatuses(payload)).toEqual([
      { id: "wamid.A", status: "delivered", at: 1793961400000, errorCode: undefined },
      { id: "wamid.B", status: "failed", at: 1793961401000, errorCode: 131047 },
    ]);
    expect(parseInbound(payload)).toEqual([]);
  });
});
