import type { GenericQueryCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

/**
 * Convert a string to a URL-safe slug.
 * Lowercases, replaces non-alphanumeric characters with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate a unique slug within an org by appending `-2`, `-3`, etc. on collision.
 */
export async function generateUniqueSlug(
  ctx: GenericQueryCtx<DataModel>,
  orgId: string,
  name: string,
): Promise<string> {
  const base = slugify(name);
  if (!base) return "program";

  // Check if base slug is available
  const existing = await ctx.db
    .query("programs")
    .withIndex("by_org_slug", (q) => q.eq("orgId", orgId).eq("slug", base))
    .unique();

  if (!existing) return base;

  // Append incrementing suffix until unique
  let suffix = 2;
  while (true) {
    const candidate = `${base}-${suffix}`;
    const collision = await ctx.db
      .query("programs")
      .withIndex("by_org_slug", (q) => q.eq("orgId", orgId).eq("slug", candidate))
      .unique();
    if (!collision) return candidate;
    suffix++;
  }
}
