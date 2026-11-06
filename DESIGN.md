# Design system

Operate mode (see PRODUCT.md). v2: a confident Airtel-red super-app look, taken from the reference screens: near-white page with a soft pink wash, red gradient hero cards, pink-tinted icon chips, rounded cards with soft shadow, and a rich marketing landing. (v1, the quiet paper-and-ink version, lives on `main`.)

## Principles
1. One screen, one job, one primary action. The single red button on a screen is the thing to do next.
2. Red is the Airtel signal: primary actions, the hero surface, active tabs and icon chips. Ink is text. Green means live, done or success. Amber means waiting. Blue is informational.
3. Numbers are the content: prices and dates are large, tabular and never decorated.
4. Sentence case everywhere. No tracked capitals, no eyebrows, no emoji as icons, no product codes.
5. Minimum 44px touch targets, 16px body text, 12px smallest text.

## Tokens (app/globals.css, declared once at :root)
| Role | Token | Value (oklch) |
|---|---|---|
| Page | `--paper` / `--background` | 0.972 0.008 85 (warm paper) |
| Text | `--ink` / `--foreground` | 0.2 0.012 60 |
| Surface | `--card` | 0.995 0.003 85 |
| Primary action | `--primary` | 0.55 0.22 27 (Airtel red) |
| Quiet fill | `--secondary`, `--muted` | 0.94 / 0.95, hue 85 |
| Border / input | `--border` / `--input` | 0.89 / 0.8, hue 80 |
| Live, done | `--success`, `--success-soft` | 0.46 0.1 160 |
| Waiting | `--warning`, `--warning-soft` | 0.5 0.11 70 |
| Info | `--info`, `--info-soft` | 0.46 0.1 245 |

Radius: `--radius` 0.75rem. Cards and rows use `rounded-2xl`, buttons and inputs `rounded-xl`, status chips and pills `rounded-full`. Surfaces are flat with a 1px hairline border: no shadows.

## Type
Plus Jakarta Sans, with Noto Sans Devanagari and Noto Sans Tamil as fallbacks so Hindi, Marathi and Tamil sit on the same baseline. Page title 26px/800. Section title 16px/700. Body 15 to 16px. Prices use `.price-xl` (36px, 800, tabular). Use `.num` for any figure that should align.

## Structure
- **Signed out:** light bar (brand, language, Sign in). Welcome, Sign in, Privacy, Connect.
- **Browsing (signed in):** five tabs on phones (Home, Plans, Orders, Help, Account), a left rail from 768px.
- **Buying (a `step` is passed to `CustomerShell`):** focused bar with back, the current step and a person one tap away. No tabs.
- **Operations console:** `dense` wrapper keeps controls compact; same tokens.

## Components
`components/customer/kit.tsx`: `PageTitle`, `SectionTitle`, `OrderStatus`, `StageTrack`, `Row`, `Empty`, `Collapse`.
`components/customer/app-nav.tsx`: `TabBar`, `SideRail`, `BrowseBar`, `PublicBar`, `FlowBar`, `LanguageSwitch`.
Dark "hero" card (`bg-foreground text-background`, rounded-3xl): the one thing to know now, with the one red action. Used on Home, Quote and Tracker.
Secondary tools go inside `Collapse` (a `details` element) so they never crowd the main decision; cards inside are flattened.

## Copy
New app copy lives in `lib/i18n/app-copy.ts` (English, Hindi, Marathi, Tamil for every key) and wins over the older dictionaries.

## Not done on purpose
No dark mode, no animation beyond colour and a single typing indicator, no photographs or illustrations, and no invented metrics or testimonials.
