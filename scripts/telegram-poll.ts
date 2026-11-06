/**
 * Local development without a public URL: long-polls Telegram (outbound only) and forwards each update to the app's own webhook route,
 * with the same secret header Telegram would send — so exactly the production code path runs.
 *   npm run dev            # terminal 1
 *   npm run telegram:poll  # terminal 2   (BASE defaults to http://localhost:3000)
 * Telegram allows either a webhook or polling, so this removes any webhook first. For a deployed site use `npm run setup:channels` instead.
 */
import { readFileSync } from "node:fs";

export {};
const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/\s+#.*$/, "").trim(); }
const TOKEN = env.TELEGRAM_BOT_TOKEN, SECRET = env.TELEGRAM_WEBHOOK_SECRET, BASE = process.env.BASE ?? "http://localhost:3000";
if (!TOKEN || !SECRET) { console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env.local"); process.exit(1); }
const tg = async (method: string, body: unknown) => (await (await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json()) as { ok: boolean; result?: unknown; description?: string };

(async () => {
  const me = await tg("getMe", {}) as { ok: boolean; result?: { username: string } };
  if (!me.ok) { console.error("Token rejected by Telegram"); process.exit(1); }
  await tg("deleteWebhook", { drop_pending_updates: false });
  await tg("setMyCommands", { commands: [{ command: "start", description: "Start / get a plan" }, { command: "track", description: "Track my order" }, { command: "human", description: "Talk to a person" }, { command: "hindi", description: "हिन्दी में बात करें" }, { command: "english", description: "Switch to English" }, { command: "reset", description: "Start over" }] });
  console.log(`Polling for @${me.result!.username} → ${BASE}/api/channels/telegram  (Ctrl+C to stop)`);
  let offset = 0;
  for (;;) {
    try {
      const r = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] }) as { ok: boolean; result?: { update_id: number }[] };
      for (const u of r.result ?? []) {
        offset = u.update_id + 1;
        const res = await fetch(`${BASE}/api/channels/telegram`, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET }, body: JSON.stringify(u) });
        console.log(new Date().toISOString().slice(11, 19), "update", u.update_id, "→", res.status); // never log message text
      }
    } catch (e) { console.error("poll error:", e instanceof Error ? e.message : e); await new Promise((r) => setTimeout(r, 3000)); }
  }
})();
