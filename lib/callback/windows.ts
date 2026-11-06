import { REFERENCE_DATE } from "@/lib/config";
import { addBusinessDays } from "@/lib/rules/pricing";

/** Callback slots: the next three working days (Sundays skipped), in three IST windows. "Today" is the dataset's reference date. */
export const CALLBACK_WINDOWS = ["10:00–12:00", "12:00–14:00", "15:00–17:00"] as const;
export type CallbackWindow = (typeof CALLBACK_WINDOWS)[number];
export const callbackDays = (): string[] => [1, 2, 3].map((n) => addBusinessDays(REFERENCE_DATE, n));
export const windowStartHour = (w: CallbackWindow) => w.slice(0, 2);
