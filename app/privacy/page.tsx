import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy · Udyam Digital" };

const rows: [string, string, string][] = [
  ["Phone number (verified by SMS code)", "Save your quote and order, sign the order form, send you order updates", "For the contract term"],
  ["Messages you send on WhatsApp or Telegram", "Answer your question and build your plan", "Kept with your conversation; never used for advertising"],
  ["GSTIN / Udyam number, certificates, signatory ID", "Verify your business (KYC), only after you consent", "Images are not stored; extracted fields kept for the contract and statutory period"],
  ["Site address and pincode", "Check fibre availability and book installation", "For the contract term"],
  ["Bill photo (optional)", "Compare your current spend", "Photo not stored; only the monthly amount"],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 text-sm leading-6">
      <h1 className="text-2xl font-semibold">Privacy policy</h1>
      <p className="mt-1 text-muted-foreground">Udyam Digital — hackathon prototype (YTL Hackathon 2026). All business data shown is synthetic. Last updated 6 November 2026.</p>

      <h2 className="mt-8 text-lg font-semibold">What we collect and why</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead><tr className="border-b"><th className="py-2 pr-4">Data</th><th className="py-2 pr-4">Purpose</th><th className="py-2">Retention</th></tr></thead>
          <tbody>{rows.map(([d, p, r]) => <tr key={d} className="border-b align-top"><td className="py-2 pr-4">{d}</td><td className="py-2 pr-4">{p}</td><td className="py-2">{r}</td></tr>)}</tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-semibold">How we use it</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>We collect only what each step needs, and ask for consent before KYC. Marketing messages are off unless you turn them on.</li>
        <li>WhatsApp and Telegram messages are used only to reply to you and to send updates about your own order.</li>
        <li>An AI model (Google Gemini) reads your typed text to understand your needs. It never receives your phone number, GSTIN, PAN or Udyam number. Prices and eligibility are decided by fixed rules, not by the AI.</li>
        <li>Payments are handled by Razorpay; we never see or store card details. SMS codes are sent through 2Factor.</li>
        <li>We do not sell or share your data with anyone else. Identifiers are masked in screens and logs.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Your choices</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>You can withdraw optional consents at any time from your account page.</li>
        <li>To stop chat messages, send <b>STOP</b> on WhatsApp, or block the Telegram bot.</li>
        <li id="delete">
          <b>Delete your data:</b> send <b>&quot;delete my data&quot;</b> on WhatsApp or Telegram, or use <a className="underline" href="/support">Support</a>. We remove your conversations and contact details within 30 days, except records the law requires us to keep.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Contact</h2>
      <p className="mt-2">Questions about this policy: use the <a className="underline" href="/support">Support</a> page.</p>
    </main>
  );
}
