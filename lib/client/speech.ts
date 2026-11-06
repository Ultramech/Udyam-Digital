/** Browser text-to-speech for the advisor's replies (Web Speech API — nothing leaves the device). Pure helpers are exported for tests. */
export const SPEECH_LANG: Record<string, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN", ta: "ta-IN" };

/** What is worth reading aloud: markup, links and emoji removed so the voice doesn't spell out symbols. */
export function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[ \t]+/g, " ").replace(/\n{2,}/g, ". ").replace(/\n/g, ". ")
    .replace(/\s+([.,;:!?])/g, "$1").replace(/([.!?])\s*\./g, "$1")
    .trim();
}

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** Speaks `text`; returns false when this device has no voice for the language (so the UI can say so instead of staying silent). */
export function speak(text: string, lang: string): boolean {
  if (!speechSupported()) return false;
  const tag = SPEECH_LANG[lang] ?? "en-IN";
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.replace("_", "-").toLowerCase() === tag.toLowerCase()) ?? voices.find((v) => v.lang.toLowerCase().startsWith(tag.slice(0, 2)));
  if (voices.length && !voice) return false;
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = tag; if (voice) u.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}
export const stopSpeaking = () => { if (speechSupported()) window.speechSynthesis.cancel(); };
