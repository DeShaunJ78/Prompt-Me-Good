import { db, userTiers, usageRecords, topupPurchases } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";

export const VALID_FEATURES = [
  "spec_pack", "companion_message", "bug_translator",
  "question_translator", "feature_builder", "live_render", "repo_doctor",
] as const;

export type Feature = (typeof VALID_FEATURES)[number];

export const USAGE_LIMITS: Record<string, Record<Feature, number>> = {
  free:    { spec_pack: 3,   companion_message: 10,  bug_translator: 3,  question_translator: 3,  feature_builder: 0,  live_render: 0,  repo_doctor: 0  },
  builder: { spec_pack: 30,  companion_message: 100, bug_translator: 30, question_translator: 30, feature_builder: 20, live_render: 5,  repo_doctor: 0  },
  pro:     { spec_pack: 100, companion_message: 500, bug_translator: 100, question_translator: 100, feature_builder: 75, live_render: 50, repo_doctor: 10 },
};

export const FEATURE_LABELS: Record<Feature, string> = {
  spec_pack:           "Spec Packs",
  companion_message:   "Build Companion messages",
  bug_translator:      "Bug Translator uses",
  question_translator: "AI Question Translator uses",
  feature_builder:     "Feature Builder uses",
  live_render:         "Live Renders",
  repo_doctor:         "Repo Doctor runs",
};

export const TOP_UP_PACKS: Record<string, { feature: Feature | null; amount: number; priceCents: number; label: string; description: string }> = {
  spec_pack_bundle:     { feature: "spec_pack",         amount: 10, priceCents: 499,  label: "Spec Pack Bundle",     description: "+10 Spec Packs" },
  companion_boost:      { feature: "companion_message",  amount: 50, priceCents: 299,  label: "Companion Boost",      description: "+50 Build Companion messages" },
  render_pack:          { feature: "live_render",        amount: 10, priceCents: 499,  label: "Render Pack",          description: "+10 Live Renders" },
  repo_doctor_run:      { feature: "repo_doctor",        amount: 3,  priceCents: 599,  label: "Repo Doctor Run",      description: "+3 Repo Doctor analyses" },
  builder_boost_bundle: { feature: null,                 amount: 0,  priceCents: 1499, label: "Builder Boost Bundle", description: "Spec packs + companion + renders + repo doctor" },
};

export function periodStartOf(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function periodEndOf(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseCredits(raw: string): Record<string, number> {
  try { return JSON.parse(raw) as Record<string, number>; } catch { return {}; }
}

async function getTierRow(userId: string) {
  const [row] = await db.select().from(userTiers).where(eq(userTiers.userId, userId));
  if (row) return row;
  const [created] = await db.insert(userTiers)
    .values({ userId, tier: "free", specPacksThisMonth: 0, monthResetAt: new Date(), credits: "{}" })
    .returning();
  return created;
}

async function upsertUsage(userId: string, feature: string, count: number, start: Date, end: Date) {
  const [existing] = await db
    .select({ id: usageRecords.id })
    .from(usageRecords)
    .where(and(
      eq(usageRecords.userId, userId),
      eq(usageRecords.feature, feature),
      gte(usageRecords.periodStart, start),
    ));

  if (existing) {
    await db.update(usageRecords)
      .set({ count, updatedAt: new Date() })
      .where(eq(usageRecords.id, existing.id));
  } else {
    await db.insert(usageRecords)
      .values({ userId, feature, count, periodStart: start, periodEnd: end });
  }
}

export async function getFeatureUsage(userId: string, feature: Feature): Promise<number> {
  const start = periodStartOf();
  const [record] = await db
    .select({ count: usageRecords.count })
    .from(usageRecords)
    .where(and(
      eq(usageRecords.userId, userId),
      eq(usageRecords.feature, feature),
      gte(usageRecords.periodStart, start),
    ));
  return record?.count ?? 0;
}

export async function getAllFeatureUsage(userId: string): Promise<Record<Feature, number>> {
  const start = periodStartOf();
  const records = await db
    .select({ feature: usageRecords.feature, count: usageRecords.count })
    .from(usageRecords)
    .where(and(eq(usageRecords.userId, userId), gte(usageRecords.periodStart, start)));

  const result: Record<string, number> = {};
  for (const f of VALID_FEATURES) result[f] = 0;
  for (const r of records) result[r.feature] = r.count;
  return result as Record<Feature, number>;
}

function isAdminOrActiveFounder(row: { isAdmin: boolean; founderAccess: boolean; founderAccessExpiry: Date | null }): boolean {
  if (row.isAdmin) return true;
  if (row.founderAccess && row.founderAccessExpiry && new Date() < new Date(row.founderAccessExpiry)) return true;
  return false;
}

export async function checkAndIncrement(
  userId: string,
  feature: Feature,
): Promise<{ allowed: boolean; used: number; limit: number; credits: number }> {
  const tierRow = await getTierRow(userId);

  // Admins and active founders always get through — still record usage for analytics
  if (isAdminOrActiveFounder(tierRow)) {
    const start = periodStartOf();
    const end   = periodEndOf();
    const used  = await getFeatureUsage(userId, feature);
    await upsertUsage(userId, feature, used + 1, start, end);
    return { allowed: true, used: used + 1, limit: Infinity, credits: 0 };
  }

  const tier    = tierRow.tier as "free" | "builder" | "pro";
  const limits  = USAGE_LIMITS[tier] ?? USAGE_LIMITS.free;
  const limit   = limits[feature] ?? 0;
  const creds   = parseCredits(tierRow.credits);
  const credits = creds[feature] ?? 0;

  const start = periodStartOf();
  const end   = periodEndOf();
  const used  = await getFeatureUsage(userId, feature);

  if (used < limit) {
    await upsertUsage(userId, feature, used + 1, start, end);
    return { allowed: true, used: used + 1, limit, credits };
  }

  if (credits > 0) {
    const updated = { ...creds, [feature]: credits - 1 };
    await db.update(userTiers)
      .set({ credits: JSON.stringify(updated), updatedAt: new Date() })
      .where(eq(userTiers.userId, userId));
    return { allowed: true, used, limit, credits: credits - 1 };
  }

  return { allowed: false, used, limit, credits: 0 };
}

export async function addCredits(userId: string, creditsToAdd: Record<string, number>): Promise<void> {
  const tierRow = await getTierRow(userId);
  const existing = parseCredits(tierRow.credits);
  const updated  = { ...existing };
  for (const [feature, amount] of Object.entries(creditsToAdd)) {
    updated[feature] = (updated[feature] ?? 0) + amount;
  }
  await db.update(userTiers)
    .set({ credits: JSON.stringify(updated), updatedAt: new Date() })
    .where(eq(userTiers.userId, userId));
}

export async function getPackPurchaseCount(userId: string, pack: string): Promise<number> {
  const start = periodStartOf();
  const rows = await db
    .select({ id: topupPurchases.id })
    .from(topupPurchases)
    .where(and(
      eq(topupPurchases.userId, userId),
      eq(topupPurchases.pack, pack),
      gte(topupPurchases.periodStart, start),
    ));
  return rows.length;
}

export async function recordTopupPurchase(
  userId: string,
  pack: string,
  feature: string | null,
  creditAdded: number,
  priceCents: number,
): Promise<void> {
  await db.insert(topupPurchases).values({
    userId,
    pack,
    feature: feature ?? undefined,
    creditAdded,
    priceCents,
    periodStart: periodStartOf(),
  });
}
