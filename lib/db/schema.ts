/**
 * Database schema (SQLite / libSQL — the same file runs locally and on Turso). Source of truth for `drizzle-kit generate`.
 *
 * Two families of tables:
 *  1. Identity & profile — fully relational (users, their sessions, businesses, locations, staff, rate limits).
 *  2. Workflow records (quotes, orders, KYC cases, tickets…) — typed, indexed columns for everything we filter or join on, plus
 *     a JSON `data` column holding the full aggregate. The app reads/writes them through lib/db/store.ts; a unit test keeps the
 *     store's column extractors and these definitions in sync.
 *
 * Conventions: ids are text (prefixed, e.g. UD-ABC234); times are integer epoch milliseconds; booleans are integers 0/1.
 */
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(cast(unixepoch('subsec') * 1000 as integer))`;
const created = () => integer("created_at").notNull().default(now);
const updated = () => integer("updated_at").notNull().default(now);

// ============================================================================================ identity & profile

/** A business owner (or their authorised person). Identity = a mobile number verified by OTP. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull(), // 10-digit Indian mobile, verified
  name: text("name"),
  email: text("email"),
  lang: text("lang").notNull().default("en"),
  /** who is using the account for the business — decides who may sign orders (owner/director/authorised signatory) */
  profileType: text("profile_type", { enum: ["owner", "director", "manager", "accountant", "other"] }).notNull().default("owner"),
  /** set when the first-time profile setup is completed (or skipped) */
  onboardedAt: integer("onboarded_at"),
  /** channels the owner allows for SERVICE updates about their own orders (not marketing) */
  notifyWhatsapp: integer("notify_whatsapp", { mode: "boolean" }).notNull().default(true),
  notifySms: integer("notify_sms", { mode: "boolean" }).notNull().default(true),
  notifyEmail: integer("notify_email", { mode: "boolean" }).notNull().default(false),
  /** marketing is separate and off by default (DPDP: purpose-specific, affirmative consent) */
  marketingOptIn: integer("marketing_opt_in", { mode: "boolean" }).notNull().default(false),
  phoneVerifiedAt: integer("phone_verified_at"),
  lastLoginAt: integer("last_login_at"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("users_phone_uq").on(t.phone)]);

/** Signed-in customer sessions. The cookie holds a random token; only its SHA-256 is stored. */
export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  userAgent: text("user_agent"),
  ipPrefix: text("ip_prefix"), // first octets only — enough to recognise a device, not to locate a person
  createdAt: created(),
  lastSeenAt: integer("last_seen_at").notNull().default(now),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
}, (t) => [uniqueIndex("user_sessions_token_uq").on(t.tokenHash), index("user_sessions_user_idx").on(t.userId)]);

/** A business an owner runs. One account can hold several businesses. */
export const businesses = sqliteTable("businesses", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  businessType: text("business_type"),
  segment: text("segment"), // micro | prof | multi | mfg (derived by the rules engine)
  city: text("city"),
  employees: integer("employees"),
  sites: integer("sites"),
  /** registry-verified identifiers; masked everywhere they are displayed */
  gstin: text("gstin"),
  gstStatus: text("gst_status"),
  udyam: text("udyam"),
  verifiedAt: integer("verified_at"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("businesses_owner_idx").on(t.ownerUserId), index("businesses_gstin_idx").on(t.gstin)]);

/** Branches / service addresses of a business. */
export const businessLocations = sqliteTable("business_locations", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  label: text("label"),
  address: text("address").notNull(),
  pincode: text("pincode"),
  fibreFeasible: integer("fibre_feasible", { mode: "boolean" }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("business_locations_business_idx").on(t.businessId)]);

/** Back-office users: sales reps, channel partners, operations/KYC, admins. */
export const staffUsers = sqliteTable("staff_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["rep", "partner", "ops", "admin"] }).notNull(),
  /** scrypt$N$r$p$salt$hash — null for demo accounts that can only be used when DEMO_MODE=true */
  passwordHash: text("password_hash"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  cities: text("cities"), // JSON array: territory used for lead assignment
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  lastLoginAt: integer("last_login_at"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("staff_users_email_uq").on(t.email)]);

export const staffSessions = sqliteTable("staff_sessions", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull().references(() => staffUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  userAgent: text("user_agent"),
  createdAt: created(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
}, (t) => [uniqueIndex("staff_sessions_token_uq").on(t.tokenHash), index("staff_sessions_staff_idx").on(t.staffId)]);

/** Fixed-window counters for login / OTP throttling (key = purpose + subject). */
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: integer("window_start").notNull(),
});

// ============================================================================================ workflow records
// Every table: id (pk), data (full JSON aggregate), created_at, updated_at, plus indexed columns.

const doc = () => ({ id: text("id").primaryKey(), data: text("data", { mode: "text" }).notNull(), createdAt: created(), updatedAt: updated() });

/** Anonymous visitor sessions (exploring needs no login); linked to a user after OTP. */
export const visitorSessions = sqliteTable("visitor_sessions", { ...doc(), userId: text("user_id"), verified: integer("verified").notNull().default(0) },
  (t) => [index("visitor_sessions_user_idx").on(t.userId)]);
export const conversations = sqliteTable("conversations", { ...doc(), sessionId: text("session_id"), userId: text("user_id"), leadId: text("lead_id") },
  (t) => [index("conversations_session_idx").on(t.sessionId), index("conversations_user_idx").on(t.userId)]);
export const leads = sqliteTable("leads", { ...doc(), status: text("status"), ownerId: text("owner_id"), level: text("level"), orderId: text("order_id") },
  (t) => [index("leads_status_idx").on(t.status), index("leads_owner_idx").on(t.ownerId), index("leads_created_idx").on(t.createdAt)]);
export const quotes = sqliteTable("quotes", { ...doc(), sessionId: text("session_id"), userId: text("user_id"), businessId: text("business_id"), orderId: text("order_id") },
  (t) => [index("quotes_session_idx").on(t.sessionId), index("quotes_user_idx").on(t.userId), index("quotes_created_idx").on(t.createdAt)]);
export const consents = sqliteTable("consents", { ...doc(), quoteId: text("quote_id"), sessionId: text("session_id") },
  (t) => [index("consents_quote_idx").on(t.quoteId)]);
export const kycCases = sqliteTable("kyc_cases", { ...doc(), quoteId: text("quote_id"), status: text("status") },
  (t) => [index("kyc_cases_quote_idx").on(t.quoteId), index("kyc_cases_status_idx").on(t.status)]);
export const orders = sqliteTable("orders", {
  ...doc(), userId: text("user_id"), businessId: text("business_id"), quoteId: text("quote_id"),
  stage: text("stage"), paymentStatus: text("payment_status"), kycStatus: text("kyc_status"), cancelled: integer("cancelled").notNull().default(0),
}, (t) => [index("orders_user_idx").on(t.userId), index("orders_business_idx").on(t.businessId), index("orders_stage_idx").on(t.stage), index("orders_created_idx").on(t.createdAt)]);
export const orderEvents = sqliteTable("order_events", { ...doc(), orderId: text("order_id") },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)]);
export const auditLogs = sqliteTable("audit_logs", { ...doc(), actor: text("actor"), entity: text("entity"), entityId: text("entity_id") },
  (t) => [index("audit_logs_actor_idx").on(t.actor), index("audit_logs_entity_idx").on(t.entity, t.entityId), index("audit_logs_created_idx").on(t.createdAt)]);
export const supportTickets = sqliteTable("support_tickets", { ...doc(), userId: text("user_id"), sessionId: text("session_id"), orderId: text("order_id"), status: text("status") },
  (t) => [index("support_tickets_user_idx").on(t.userId), index("support_tickets_session_idx").on(t.sessionId), index("support_tickets_status_idx").on(t.status)]);
export const otpChallenges = sqliteTable("otp_challenges", doc());
export const kvAnalytics = sqliteTable("kv_analytics", doc());
export const documents = sqliteTable("documents", doc());
export const pincodeCache = sqliteTable("pincode_cache", doc());
export const coverageOverrides = sqliteTable("coverage_overrides", doc());
export const engineers = sqliteTable("engineers", doc());
export const bookings = sqliteTable("bookings", { ...doc(), orderId: text("order_id") }, (t) => [index("bookings_order_idx").on(t.orderId)]);
export const oauthStates = sqliteTable("oauth_states", doc());
export const telegramLinks = sqliteTable("telegram_links", doc());
export const channelOptouts = sqliteTable("channel_optouts", doc());
export const shares = sqliteTable("shares", { ...doc(), quoteId: text("quote_id") }, (t) => [index("shares_quote_idx").on(t.quoteId)]);
export const referrals = sqliteTable("referrals", doc());
export const catalogueOverrides = sqliteTable("catalogue_overrides", doc());
export const catalogueChanges = sqliteTable("catalogue_changes", { ...doc(), productId: text("product_id") }, (t) => [index("catalogue_changes_product_idx").on(t.productId)]);
export const kycFileFingerprints = sqliteTable("kyc_file_fingerprints", doc());
