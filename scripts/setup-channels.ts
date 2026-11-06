/**
 * Registers the chat-channel webhooks after keys are in .env.local and PUBLIC_BASE_URL points at a public https origin.
 *   npm run setup:channels
 * Telegram: setWebhook (with the secret header) + bot commands. Meta: app webhook subscription + WABA subscription when
 * META_APP_ID and META_WA_BUSINESS_ACCOUNT_ID are present. Twilio sandbox: prints the URL to paste (no API for the sandbox).
 * Never prints tokens.
 */
import { readFileSync } from "node:fs";

export {};
const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/\s+#.*$/, "").replace(/^"(.*)"$/, "$1").trim();
}
const base = (env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
const ok = (s: string) => console.log("  ✓", s), bad = (s: string) => console.log("  ✗", s), info = (s: string) => console.log("  ·", s);

(async () => {
  if (!/^https:\/\//.test(base)) { bad("PUBLIC_BASE_URL must be a public https URL (run `npm run tunnel` locally, or use the deployed URL)"); process.exit(1); }
  console.log(`Public base: ${base}\n\nTelegram`);
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET) {
    const call = async (method: string, body: unknown) => (await (await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json()) as { ok: boolean; result?: { username?: string }; description?: string };
    const me = await call("getMe", {});
    if (!me.ok) bad(`token rejected: ${me.description}`);
    else {
      const wh = await call("setWebhook", { url: `${base}/api/channels/telegram`, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["message"], drop_pending_updates: true });
      if (wh.ok) ok(`webhook → ${base}/api/channels/telegram`); else bad(`setWebhook: ${wh.description}`);
      await call("setMyCommands", { commands: [{ command: "start", description: "Start / get a plan" }, { command: "track", description: "Track my order" }, { command: "human", description: "Talk to a person" }, { command: "hindi", description: "हिन्दी में बात करें" }, { command: "english", description: "Switch to English" }, { command: "reset", description: "Start over" }] });
      ok(`bot is https://t.me/${me.result?.username} — share this link with evaluators`);
    }
  } else info("skipped (set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET)");

  console.log("\nWhatsApp — Meta Cloud API");
  if (env.META_WA_TOKEN && env.META_WA_PHONE_NUMBER_ID && env.META_WA_APP_SECRET && env.META_WA_VERIFY_TOKEN) {
    const v = env.META_GRAPH_VERSION || "v23.0";
    const num = await (await fetch(`https://graph.facebook.com/${v}/${env.META_WA_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,code_verification_status`, { headers: { authorization: `Bearer ${env.META_WA_TOKEN}` } })).json() as { display_phone_number?: string; verified_name?: string; error?: { message: string } };
    if (num.error) bad(`token/phone id rejected: ${num.error.message}`); else ok(`number ${num.display_phone_number} (${num.verified_name}) — evaluators message this number`);
    if (env.META_APP_ID) {
      const r = await fetch(`https://graph.facebook.com/${v}/${env.META_APP_ID}/subscriptions`, { method: "POST", body: new URLSearchParams({ object: "whatsapp_business_account", callback_url: `${base}/api/channels/whatsapp/meta`, verify_token: env.META_WA_VERIFY_TOKEN, fields: "messages", access_token: `${env.META_APP_ID}|${env.META_WA_APP_SECRET}` }) });
      const j = (await r.json()) as { success?: boolean; error?: { message: string } };
      if (j.success) ok(`app webhook → ${base}/api/channels/whatsapp/meta`); else bad(`app webhook: ${j.error?.message}`);
    } else info(`set the callback URL by hand: ${base}/api/channels/whatsapp/meta (verify token = META_WA_VERIFY_TOKEN), subscribe to "messages" — or add META_APP_ID and re-run`);
    if (env.META_WA_BUSINESS_ACCOUNT_ID) {
      const j = (await (await fetch(`https://graph.facebook.com/${v}/${env.META_WA_BUSINESS_ACCOUNT_ID}/subscribed_apps`, { method: "POST", headers: { authorization: `Bearer ${env.META_WA_TOKEN}` } })).json()) as { success?: boolean; error?: { message: string } };
      if (j.success) ok("WhatsApp Business Account subscribed to the app"); else bad(`WABA subscribe: ${j.error?.message}`);
    } else info("add META_WA_BUSINESS_ACCOUNT_ID to subscribe the WhatsApp Business Account automatically");
  } else info("skipped (set META_WA_TOKEN, META_WA_PHONE_NUMBER_ID, META_WA_APP_SECRET, META_WA_VERIFY_TOKEN)");

  console.log("\nWhatsApp — Twilio (fallback)");
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) info(`paste ${base}/api/channels/whatsapp into Twilio Console → Messaging → WhatsApp sandbox → "When a message comes in" (POST)`);
  else info("skipped");
  console.log("\nRestart `npm run dev` if you changed .env.local, then check the status panel (Demo → What is live).");
})();
