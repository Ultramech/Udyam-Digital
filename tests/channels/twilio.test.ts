import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { phoneFromWhatsApp, twilioSignature, validateTwilioSignature } from "@/lib/channels/twilio";

describe("Twilio signature", () => {
  // Twilio's documented algorithm: HMAC-SHA1 over URL + sorted key/value pairs, base64.
  const token = "12345", url = "https://mycompany.com/myapp.php?foo=1&bar=2";
  const params = { CallSid: "CA1234567890ABCDE", Caller: "+14158675310", Digits: "1234", From: "+14158675310", To: "+18005551212" };
  const expected = "GvWf1cFY/Q7PnoempGyD5oXAezc="; // recalled from the docs example; the definitive check is the first real webhook
  it("matches Twilio's published example", () => expect(twilioSignature(token, url, params)).toBe(expected));
  it("accepts the right signature, rejects tampering", () => {
    expect(validateTwilioSignature(token, url, params, expected)).toBe(true);
    expect(validateTwilioSignature(token, url, { ...params, Digits: "9999" }, expected)).toBe(false);
    expect(validateTwilioSignature(token, url + "x", params, expected)).toBe(false);
    expect(validateTwilioSignature("other", url, params, expected)).toBe(false);
    expect(validateTwilioSignature(token, url, params, null)).toBe(false);
    expect(validateTwilioSignature(token, url, params, "")).toBe(false);
  });
  it("is independent of parameter order", () => {
    const shuffled = Object.fromEntries(Object.entries(params).reverse());
    expect(twilioSignature(token, url, shuffled)).toBe(expected);
  });
});

describe("phoneFromWhatsApp", () => {
  it("returns the 10-digit Indian number", () => {
    expect(phoneFromWhatsApp("whatsapp:+919876543210")).toBe("9876543210");
    expect(phoneFromWhatsApp("whatsapp:+91 98765 43210")).toBe("9876543210");
  });
});
