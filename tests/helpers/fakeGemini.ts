/**
 * Test double for the Gemini HTTP boundary ONLY. Production code never uses it. It plays the model's role for wording: it "says" the
 * situation the code handed it, keeps required tokens, echoes option labels, and extracts nothing (so tests cannot lean on regex parsing).
 */
export const fakeGemini = {
  geminiConfigured: () => true,
  geminiModel: () => "fake",
  GeminiError: class GeminiError extends Error { constructor(public code: string, m: string) { super(m); } },
  async geminiJson(opts: { parts: { text?: string }[]; schema: { properties?: Record<string, unknown> } }) {
    const t = opts.parts.map((p) => p.text ?? "").join("\n");
    if (opts.schema.properties && "message" in opts.schema.properties) {
      const situation = /Situation: (.*)/.exec(t)?.[1] ?? "";
      const must = JSON.parse(/mustInclude: (\[.*\])/.exec(t)?.[1] ?? "[]") as string[];
      const labels = JSON.parse(/Options to label \(English\): (\[.*\])/.exec(t)?.[1] ?? "null") as string[] | null;
      return { message: `${situation} ${must.join(" ")}`.trim(), ...(labels ? { labels } : {}) };
    }
    return { needs: [], explicitHuman: false, otherNeeds: [], intent: "describe", removeNeeds: [], changedFields: [] };
  },
};
