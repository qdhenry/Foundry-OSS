"use node";

import Stripe from "stripe";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

const TIERS = [
  {
    slug: "crucible" as const,
    name: "Foundry Crucible",
    description: "For solo operators shipping fast",
    monthlyUsd: 29900,
    overageUsd: 500,
  },
  {
    slug: "forge" as const,
    name: "Foundry Forge",
    description: "For teams that deliver together",
    monthlyUsd: 180000,
    overageUsd: 400,
  },
  {
    slug: "foundry" as const,
    name: "Foundry Enterprise",
    description: "For organizations scaling delivery",
    monthlyUsd: 800000,
    overageUsd: 300,
  },
];

/** One-time action to create Stripe products, billing meter, prices, and update Convex pricingPlans */
export const provisionStripeProducts = internalAction({
  handler: async (ctx) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // Create a shared billing meter for session overage (Stripe 2025+ requires meters for metered pricing)
    let meter: Stripe.Billing.Meter;
    const existingMeters = await stripe.billing.meters.list({ limit: 100 });
    const foundMeter = existingMeters.data.find((m) => m.event_name === "foundry_session_overage");

    if (foundMeter) {
      meter = foundMeter;
      console.log(`[stripe-setup] Meter exists: ${meter.id}`);
    } else {
      meter = await stripe.billing.meters.create({
        display_name: "Foundry Session Overage",
        event_name: "foundry_session_overage",
        default_aggregation: { formula: "sum" },
      });
      console.log(`[stripe-setup] Created meter: ${meter.id}`);
    }

    for (const tier of TIERS) {
      // Idempotent: check if product already exists
      const existing = await stripe.products.search({
        query: `metadata["foundry_slug"]:"${tier.slug}"`,
      });

      let product: Stripe.Product;
      if (existing.data.length > 0) {
        product = existing.data[0];
        console.log(`[stripe-setup] Product exists: ${tier.slug} → ${product.id}`);
      } else {
        product = await stripe.products.create({
          name: tier.name,
          description: tier.description,
          metadata: { foundry_slug: tier.slug },
        });
        console.log(`[stripe-setup] Created product: ${tier.slug} → ${product.id}`);
      }

      // Create monthly recurring price
      const monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: tier.monthlyUsd,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { foundry_slug: tier.slug, type: "monthly" },
      });
      console.log(`[stripe-setup] Monthly price: ${tier.slug} → ${monthlyPrice.id}`);

      // Create metered overage price backed by the billing meter
      const overagePrice = await stripe.prices.create({
        product: product.id,
        unit_amount: tier.overageUsd,
        currency: "usd",
        recurring: { interval: "month", meter: meter.id, usage_type: "metered" },
        metadata: { foundry_slug: tier.slug, type: "overage" },
      });
      console.log(`[stripe-setup] Overage price: ${tier.slug} → ${overagePrice.id}`);

      // Update Convex pricingPlans with real Stripe IDs
      await ctx.runMutation(internal.billing.plans.updateStripePriceIds, {
        slug: tier.slug,
        stripePriceId: monthlyPrice.id,
        stripeOveragePriceId: overagePrice.id,
      });
      console.log(`[stripe-setup] Updated DB for ${tier.slug}`);
    }

    console.log("[stripe-setup] Done — all 3 tiers provisioned.");
  },
});
