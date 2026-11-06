# Home: the whole problem (design brief v3)

## Who opens this and why
An owner of a small shop, clinic or office, on a phone, between customers. They come back for one of six reasons. The Home screen has to answer all six without scrolling forever.
1. **Where am I?** What is done, what is next, when does my service go live. (Setup progress.)
2. **Do something now.** Buy, check fibre, track, get help. (Quick actions and search.)
3. **What is in it for me?** Rewards for finishing steps and referring others. (Udyam Coins, tiers, earn list.)
4. **Is my business getting better?** A measured digital score, not a vague promise. (Growth.)
5. **What should I buy next?** Plans and products that fit this business. (Curated for you, Explore.)
6. **Reach a person or a bot.** WhatsApp, Telegram, callback. (Chat channels, help.)

## Analogous product
Airtel Thanks, the Airtel super-app: service status first, then payments, rewards and offers, then help with complaint tracking. We borrow the idea of one place with many entry points and a visible rewards loop. We do not borrow its density of banners.

## Information architecture (top to bottom)
1. Top bar: menu (side panel), brand, notifications, profile.
2. Search: services, plans, help topics, pages.
3. Greeting with business name and reward tier.
4. Setup card (the existing "next step"), now with its five steps visible.
5. Quick actions (8).
6. Udyam Coins: balance, tier progress, the next things to earn.
7. Growth: digital score, before and after the plan.
8. Ask the advisor (existing).
9. Curated for you: plans picked by the rules engine for this business, each with the reason.
10. Explore products: categories and a product shelf.
11. Group and multi-branch plans, and Refer and earn.
12. Fibre check, recent orders (existing).
13. Chat on WhatsApp or Telegram, with QR codes (existing channels).
14. Help (existing).

## What is real and what is not (no invented numbers)
- **Coins** are computed from real records: profile completed, plan created, KYC verified, first paid order, services live, a referral that became a paid order. Nothing is awarded for anything that did not happen. Coins are a record of progress; what they can be redeemed for is not promised here.
- **Digital score** is the app's measured maturity score for the plan.
- **Curated for you** is the rules engine's output for the owner's saved business profile, with its own reasons.
- **Group plan** means the existing multi-location bundle (one bill, all shops) and the "plan for a new branch" flow. There is no group-buying backend and none is implied.
- **Savings** are shown only where a real bill comparison exists.

## Side panel
Profile and tier, then Home, Plans, Orders, Rewards, Notifications, Help, Account; the two bots; language; demo tools; sign out.
