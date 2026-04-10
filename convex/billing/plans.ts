import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { planSlugValidator } from "./validators";

const PLAN_DEFINITIONS = [
  {
    slug: "crucible" as const,
    displayName: "Crucible",
    tagline: "For solo operators shipping fast",
    monthlyPriceUsd: 299,
    stripePriceId: "price_crucible_monthly",
    stripeOveragePriceId: "price_crucible_overage",
    overageRateUsd: 5,
    limits: { maxSeats: 1, maxPrograms: 5, maxSessionsPerMonth: 50 },
    features: [
      "All integrations (GitHub, Jira, Confluence)",
      "Health scoring & daily digests",
      "Audit trail",
      "Email support",
    ],
    isPublic: true,
    sortOrder: 1,
    buyingMotion: "self_serve" as const,
  },
  {
    slug: "forge" as const,
    displayName: "Forge",
    tagline: "For teams that deliver together",
    monthlyPriceUsd: 1800,
    stripePriceId: "price_forge_monthly",
    stripeOveragePriceId: "price_forge_overage",
    overageRateUsd: 4,
    limits: { maxSeats: 10, maxPrograms: -1, maxSessionsPerMonth: 300 },
    features: [
      "All integrations (GitHub, Jira, Confluence)",
      "Health scoring & daily digests",
      "Audit trail",
      "Priority support",
      "Team collaboration",
      "Advanced analytics",
    ],
    isPublic: true,
    sortOrder: 2,
    buyingMotion: "sales_assisted" as const,
  },
  {
    slug: "foundry" as const,
    displayName: "Foundry",
    tagline: "For organizations scaling delivery",
    monthlyPriceUsd: 8000,
    annualPriceUsd: 96000,
    stripePriceId: "price_foundry_monthly",
    stripeAnnualPriceId: "price_foundry_annual",
    stripeOveragePriceId: "price_foundry_overage",
    overageRateUsd: 3,
    limits: { maxSeats: -1, maxPrograms: -1, maxSessionsPerMonth: 1500 },
    features: [
      "All integrations (GitHub, Jira, Confluence)",
      "Health scoring & daily digests",
      "Audit trail",
      "Priority support",
      "Team collaboration",
      "Advanced analytics",
      "Dedicated support",
      "Custom SLA",
      "SSO/SAML",
      "Volume API pricing",
    ],
    isPublic: true,
    sortOrder: 3,
    buyingMotion: "annual_contract" as const,
  },
];

/** Idempotent seeding — creates plans only if they don't exist */
export const seedPricingPlans = internalMutation({
  handler: async (ctx) => {
    for (const plan of PLAN_DEFINITIONS) {
      const existing = await ctx.db
        .query("pricingPlans")
        .withIndex("by_slug", (q) => q.eq("slug", plan.slug))
        .first();
      if (!existing) {
        await ctx.db.insert("pricingPlans", plan);
      }
    }
  },
});

/** Public mutation — idempotent seed check, call from frontend on pricing page mount */
export const ensurePlansSeeded = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("pricingPlans")
      .withIndex("by_slug", (q) => q.eq("slug", "crucible"))
      .first();
    if (existing) return;
    for (const plan of PLAN_DEFINITIONS) {
      await ctx.db.insert("pricingPlans", plan);
    }
  },
});

/** Public query — returns all visible plans sorted by tier */
export const getPricingPlans = query({
  handler: async (ctx) => {
    const plans = await ctx.db.query("pricingPlans").collect();
    return plans.filter((p) => p.isPublic).sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** Get a single plan by slug */
export const getPlanBySlug = query({
  args: { slug: planSlugValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pricingPlans")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/** Internal query — get plan by slug without auth (for use by actions) */
export const getPlanBySlugInternal = internalQuery({
  args: { slug: planSlugValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pricingPlans")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/** Update Stripe price IDs after product creation in Stripe dashboard */
export const updateStripePriceIds = internalMutation({
  args: {
    slug: planSlugValidator,
    stripePriceId: v.optional(v.string()),
    stripeAnnualPriceId: v.optional(v.string()),
    stripeOveragePriceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db
      .query("pricingPlans")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!plan) throw new Error(`Plan not found: ${args.slug}`);

    const updates: Record<string, string> = {};
    if (args.stripePriceId) updates.stripePriceId = args.stripePriceId;
    if (args.stripeAnnualPriceId) updates.stripeAnnualPriceId = args.stripeAnnualPriceId;
    if (args.stripeOveragePriceId) updates.stripeOveragePriceId = args.stripeOveragePriceId;

    await ctx.db.patch(plan._id, updates);
  },
});
